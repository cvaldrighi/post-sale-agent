# retrieval

Busca nas políticas da loja (trocas, cancelamento, estornos, prazos e garantia) para o agente
responder com base no texto oficial, citando de onde veio cada trecho. É a parte de **RAG** do
projeto: a `api` pergunta, o `retrieval` devolve os trechos mais relevantes.

Python 3.12 · FastAPI · SQLAlchemy · PostgreSQL + pgvector (schema `retrieval`) · LangChain
(componentes) · Ollama ou Amazon Bedrock

## Endpoints

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/health` | não | Saúde do serviço e do banco |
| `GET` | `/docs` | não | Swagger UI gerado pelo FastAPI |
| `POST` | `/documents` | `x-api-key` | Indexa (ou reindexa) uma política. 201 se é nova, 200 se já existia |
| `POST` | `/search` | `x-api-key` | Busca os trechos mais relevantes para uma pergunta (`topK` de 1 a 20, padrão 5) |

O contrato fica em [`contracts/retrieval.json`](../../contracts/retrieval.json). Aqui ele é
**code-first**: gerado a partir dos modelos Pydantic, ao contrário do `orders`, em que o YAML vem
antes do código. Um teste falha se o arquivo ficar diferente do código.

## Como funciona

**Ingestão** (`ingestion.py`, `chunking.py`)
1. O Markdown é dividido pelas seções (`#`, `##`, `###`); seções longas são subdivididas em pedaços
   de até 1000 caracteres, com 150 de sobreposição.
2. Cada trecho guarda o seu contexto ("Política de Estornos > Prazo para Pix"). O embedding é gerado
   do contexto + texto, assim um trecho curto como "em até 1 dia útil" não perde o assunto.
3. O documento guarda o hash SHA-256 do conteúdo: o mesmo texto não é reprocessado. Texto alterado
   troca todos os trechos numa transação, sem duplicar.

**Busca híbrida** (`search.py`, uma única query SQL)
- **Semântica:** distância de cosseno entre o embedding da pergunta e o dos trechos (índice HNSW do
  pgvector). Acha sinônimos: "devolver o dinheiro" encontra "estorno".
- **Por palavras:** full-text do Postgres em português (índice GIN), exigindo todos os termos.
  Reforça termos exatos como "Pix" ou "CDC".
- **Fusão (RRF):** `score = Σ 1 / (60 + posição)` nas duas listas. Só são comparados trechos gerados
  com o mesmo modelo de embeddings da pergunta.

Para entender por que um resultado veio (ou não veio), o comando `explain` mostra as três listas
lado a lado:

```bash
uv run python -m retrieval.explain "em quanto tempo vocês devolvem o meu dinheiro?"
```

## Provedores de embeddings

| `EMBEDDINGS_PROVIDER` | Modelo padrão | Observação |
|---|---|---|
| `ollama` (padrão) | `bge-m3` | Na máquina host: `ollama pull bge-m3` |
| `bedrock` | `amazon.titan-embed-text-v2:0` | Com `dimensions=1024` |

Os dois geram vetores de 1024 dimensões, então a tabela é a mesma. Ao trocar de modelo, rode a
ingestão com `--force`: vetores de modelos diferentes não são comparáveis.

## Python para quem vem do Node

| Papel | Python (aqui) | Node (`api` e `orders`) |
|---|---|---|
| Versão, dependências e scripts | `uv` + `pyproject.toml` + `uv.lock` | `npm` + `package.json` + `package-lock.json` |
| Pasta das dependências | `.venv` | `node_modules` |
| Rodar um comando do projeto | `uv run <comando>` | `npx <comando>` / `npm run` |
| Framework HTTP | FastAPI | NestJS |
| Injeção de dependência | `Depends(...)` | providers no construtor |
| Validação e DTOs | Pydantic | class-validator / Zod |
| Configuração validada | pydantic-settings | `@nestjs/config` + `validateEnv` |
| ORM | SQLAlchemy 2 + psycopg 3 | TypeORM + pg |
| Migrations | Alembic | migrations do TypeORM |
| Testes | pytest + `TestClient` | Jest + supertest |
| Lint e formatação | ruff | oxlint + prettier |

## Rodando

Com Docker (a partir da raiz do repositório, com o Ollama rodando no host). Na inicialização o
container aplica as migrations e indexa `data/policies`:

```bash
docker compose up -d --build retrieval
docker compose ps          # retrieval deve ficar "healthy"
```

Localmente, para desenvolver ([instalar o uv](https://docs.astral.sh/uv/)):

```bash
cp .env.example .env       # DATABASE_PASSWORD = RETRIEVAL_DB_PASSWORD e a mesma RETRIEVAL_API_KEY da raiz
uv sync                    # cria o .venv e instala as dependências
uv run alembic upgrade head
uv run python -m retrieval.ingest data/policies    # --force para refazer tudo
uv run retrieval           # http://localhost:8000/docs
```

## Testes

```bash
uv run pytest                                # unitários e integração, com embeddings falsos
RUN_OLLAMA_TESTS=1 uv run pytest -m ollama   # busca por sinônimo com o bge-m3 de verdade
uv run ruff check . && uv run ruff format --check .
uv run python -m retrieval.export_openapi    # regenera contracts/retrieval.json
```

Os testes usam o mesmo banco do ambiente local e limpam as tabelas do `retrieval`; depois deles,
rode a ingestão de novo.

## Exemplo com curl

```bash
source ../../.env    # carrega a RETRIEVAL_API_KEY sem precisar colar a chave

curl -s localhost:8000/search -H "x-api-key: $RETRIEVAL_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"em quanto tempo o dinheiro volta no Pix?","topK":3}' | jq
```
