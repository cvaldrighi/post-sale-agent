# Design

## Context

O schema `retrieval` e o usuário `retrieval_service` já existem; a extensão `vector` está ativa. Os
outros serviços definiram os padrões (chave de API, problem+json, logs JSON com correlation ID). No
studying-rag (estudo anterior) apareceram três problemas que este serviço evita de propósito: modelo
de embeddings que truncava em 128 tokens, trechos sem o contexto do documento e o RRF com rank
padrão para itens ausentes. Motivação em proposal.md; comportamento nas specs.

## Goals / Non-Goals

**Goals:**
- Um serviço Python pequeno e idiomático, fácil de explicar para quem vem do Node.
- Busca que funcione bem em português, inclusive com sinônimos e com termos exatos.

**Non-Goals:**
- Reranker, PDFs, ingestão assíncrona e edição de políticas por interface.

## Decisions

### 1. Stack Python, com o equivalente em Node
| Papel | Python | Equivalente no Node |
|---|---|---|
| Versão, ambiente e dependências | `uv` + `pyproject.toml` + `uv.lock` | `npm` + `package.json` + `package-lock.json` |
| Framework HTTP | FastAPI | NestJS |
| Validação e DTOs | Pydantic | class-validator |
| Configuração validada | pydantic-settings | `@nestjs/config` + `validateEnv` |
| Banco | SQLAlchemy 2 + psycopg 3 + pgvector | TypeORM + pg |
| Migrations | Alembic | migrations do TypeORM |
| Testes | pytest + TestClient do FastAPI | Jest + supertest |
| Lint e formatação | ruff | oxlint + prettier |

### 2. LangChain só para componentes
- `MarkdownHeaderTextSplitter` (divide pelas seções) e `RecursiveCharacterTextSplitter` (divide
  seções longas, com sobreposição).
- `OllamaEmbeddings` e `BedrockEmbeddings`. A classe base `Embeddings` do LangChain faz o papel da
  interface de provedor; nos testes, `DeterministicFakeEmbedding` dá vetores previsíveis sem modelo.
- A busca é SQL próprio (decisão 5): o `PGVector` do LangChain não faz a busca híbrida que queremos.

### 3. Embeddings multilíngues com 1024 dimensões
`bge-m3` no Ollama (padrão): multilíngue, entrada de até 8.192 tokens, sem prefixos especiais. No
Bedrock, Titan Text Embeddings V2 com `dimensions=1024`. A coluna é `vector(1024)` nos dois casos.
- Alternativa: `nomic-embed-text`. Descartada: treinado principalmente em inglês.
- Cada trecho guarda `embedding_model`; a busca filtra pelo modelo configurado. Trocar de modelo
  exige reingerir (`ingest --force`), mas nunca mistura vetores de espaços diferentes.

### 4. Trechos com contexto
Primeiro divide pelos títulos (`#`, `##`, `###`); seções acima de ~1000 caracteres são subdivididas
com sobreposição de ~150. Cada trecho guarda `context` (`Título > Seção`) e `content` (o texto). O
embedding é gerado de `context + "\n\n" + content`, e o full-text indexa os dois.

### 5. Busca híbrida em uma query, com RRF padrão
Duas listas de até 20 candidatos: por distância de cosseno (índice HNSW) e por `ts_rank` com
`websearch_to_tsquery('portuguese', ...)` (índice GIN numa coluna `tsvector` gerada). A fusão é
`score = Σ 1 / (60 + posição)`; um trecho ausente de uma lista simplesmente não soma nada dela (RRF
clássico).
- Os termos são ligados por E (padrão do `websearch_to_tsquery`, que também aceita aspas e `-termo`).
  Testamos OU: quase todo trecho casava, com `ts_rank` empatado, e essa lista sem informação
  derrubava o melhor resultado semântico ("em quanto tempo vocês devolvem o meu dinheiro?" tirava
  "Estornos > Prazo para Pix" do 1º lugar). Com E, a lista de palavras reforça termos exatos e,
  numa pergunta natural, quase não casa nada e a semântica decide.
- Alternativa: busca só vetorial. Descartada: perde termos exatos ("Pix", "CDC").

### 6. Ingestão idempotente
`documents` guarda `content_hash` (SHA-256). Mesmo hash: nada a fazer. Hash diferente: numa
transação, apaga os trechos do documento e insere os novos. O comando
`uv run python -m retrieval.ingest data/policies` usa o nome do arquivo como `source`.

### 7. Tabelas
- `documents`: `id`, `source` (único), `title`, `content_hash`, `created_at`, `updated_at`.
- `chunks`: `id` (identity), `document_id` (FK, cascade), `chunk_index`, `context`, `content`,
  `embedding vector(1024)`, `embedding_model`, `search_vector tsvector` gerada
  (`to_tsvector('portuguese', context || ' ' || content)`).
- Índices: HNSW `vector_cosine_ops` em `embedding`; GIN em `search_vector`.

### 8. Contrato code-first com teste de divergência
O FastAPI gera o OpenAPI dos modelos Pydantic. `uv run python -m retrieval.export_openapi` grava
`contracts/retrieval.json`; um teste compara o arquivo com o gerado e falha se diferirem. A `api`
vai gerar os tipos TypeScript desse arquivo (change seguinte).

### 9. Operação igual aos outros serviços
Chave em `x-api-key` comparada em tempo constante (`hmac.compare_digest`), `GET /health` público,
middleware de correlation ID com `contextvars` (o "AsyncLocalStorage" do Python), logs JSON e
handlers de exceção que respondem problem+json. Porta 8000.

### 10. Testes
- Unitários: divisão em trechos e montagem do contexto.
- Integração com o Postgres do Compose (banco real, embeddings falsos): ingestão, reingestão,
  busca por termo exato, isolamento por modelo e chave de API. Os dados do schema `retrieval` são
  limpos antes de cada teste.
- Um teste opcional (marcado, só roda com o Ollama ativo) confere a busca por sinônimo com o `bge-m3`.

## Risks / Trade-offs

- [Testes compartilham o banco com o ambiente local] → limpam só o schema `retrieval`; em produção,
  banco de teste separado.
- [Ingestão depende do Ollama ativo] → erro claro se o provedor não responder; o container só ingere
  na inicialização se `INGEST_ON_STARTUP=true`.
- [Políticas fictícias] → escritas com base no Código de Defesa do Consumidor, para soarem reais.

## Em produção

- Chaves separadas para leitura (a `api`) e escrita (a ingestão), ou ingestão só por um processo interno.
- Ingestão assíncrona: documento no S3 → evento → fila (SQS) → worker que gera os embeddings.
- Reranker para bases grandes, e avaliação da busca (recall@k) a cada mudança de modelo ou de chunking.
- Alternativas gerenciadas: Bedrock Knowledge Bases ou OpenSearch Serverless.

## Migration Plan

Serviço novo. Migrations com Alembic na inicialização; carga das políticas com o comando de ingestão.
