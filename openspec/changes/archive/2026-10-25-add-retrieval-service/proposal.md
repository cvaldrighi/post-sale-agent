# Proposal

## Why

O agente consulta pedidos e pagamentos, mas não conhece as regras da loja: não sabe se um pedido
atrasado pode ser cancelado nem em quanto tempo um estorno cai. Essas regras vivem em documentos de
texto, que não se consultam por chave como um pedido, e sim pelo significado da pergunta. Esta change
cria o serviço `retrieval`, que indexa as políticas da loja e responde buscas semânticas, como base
para a ferramenta de políticas do agente (change seguinte).

## What Changes

- Novo serviço `services/retrieval` em Python, com as políticas da loja em Markdown.
- Ingestão: divide cada documento pelas seções, gera embeddings e grava no Postgres (pgvector).
  Reingerir um documento alterado substitui os trechos antigos; um documento igual é ignorado.
- Busca híbrida: semântica (vetores) e por palavras (full-text em português), combinadas com RRF.
- Cada resultado traz o documento e a seção de origem, para o agente poder citar a fonte.
- Provedor de embeddings configurável: Ollama (`bge-m3`, padrão) ou Bedrock (Titan V2).
- Chave de API, health check, correlation ID e erros em problem+json, como nos outros serviços.
- Contrato OpenAPI gerado do código (code-first) e versionado em `contracts/retrieval.json`.

## Capabilities

### New Capabilities
- `policy-ingestion`: como os documentos de política entram na base e são atualizados.
- `policy-search`: a busca nas políticas e o formato dos resultados.
- `retrieval-service-operations`: acesso, saúde, rastreamento, erros e contrato do serviço.

### Modified Capabilities
<!-- Nenhuma. -->

## Impact

- Novo diretório `services/retrieval` (Python 3.12, uv) e arquivo `contracts/retrieval.json`.
- Tabelas no schema `retrieval` (usuário `retrieval_service`).
- `docker-compose.yml` ganha o serviço `retrieval`; `.env.example` ganha `RETRIEVAL_API_KEY`.

## Fora do escopo

- A ferramenta `search_policies` na `api` e o novo prompt: change `add-policy-search-tool`.
- Reranker (cross-encoder), upload de PDF e ingestão assíncrona por fila.
- Painel para editar políticas e permissões separadas de leitura e escrita.
