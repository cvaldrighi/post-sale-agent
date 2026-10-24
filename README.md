# post-sale-agent

Assistente de pós-venda para e-commerce construído com um **agente de IA**: o cliente pergunta
sobre pedidos, pagamentos e políticas da loja, e o agente decide quais ferramentas usar
(consultar um pedido, buscar na política de trocas, solicitar um estorno). Ações que mudam
alguma coisa, como um estorno, **só executam depois da aprovação do cliente**.

Projeto de estudo e portfólio, com foco em backend: orquestração de agentes, integração com
LLMs (Amazon Bedrock), RAG, contratos entre serviços, segurança e observabilidade.

> 🚧 Em construção. O desenvolvimento segue **Spec-Driven Development** com
> [OpenSpec](https://openspec.dev): cada funcionalidade começa como uma especificação em
> `openspec/changes/`, revisada antes do código, e entra por um PR próprio.

## Arquitetura

```mermaid
flowchart LR
    client([Cliente]) -- "HTTP + JWT" --> api

    subgraph compose["Docker Compose (local)"]
        api["<b>api</b><br/>Node · NestJS<br/>API pública + agente"]
        retrieval["<b>retrieval</b><br/>Python · FastAPI · LangChain<br/>RAG das políticas"]
        orders["<b>orders</b><br/>Node · API simulada<br/>pedidos e pagamentos"]
        db[("<b>Postgres + pgvector</b><br/>schemas: app · retrieval · orders")]

        api -- "search_policies" --> retrieval
        api -- "get_order · get_payment<br/>request_refund (com aprovação)" --> orders
        api --> db
        retrieval --> db
        orders --> db
    end

    subgraph aws["AWS"]
        llm["Bedrock<br/>Claude (LLM)"]
        emb["Bedrock<br/>Titan Embeddings"]
    end

    ollama["Ollama<br/>(alternativa local)"]

    api -- "conversa + ferramentas" --> llm
    retrieval -- "embeddings" --> emb
    api -.-> ollama
    retrieval -.-> ollama
```

| Serviço | Stack | Responsabilidade |
|---|---|---|
| `api` | Node.js, NestJS | API pública, autenticação, orquestração do agente, guardrails, aprovação humana |
| `retrieval` | Python, FastAPI, LangChain | Ingestão e busca semântica nas políticas da loja (RAG) |
| `orders` | Node.js | Simula o sistema de pedidos e pagamentos de um terceiro |
| `postgres` | PostgreSQL + pgvector | Dados relacionais e vetoriais, um schema por serviço |

Os contratos entre os serviços ficam em [`contracts/`](contracts/) no formato OpenAPI.

## Estrutura

```
post-sale-agent/
├── openspec/            # especificações (Spec-Driven Development)
├── services/
│   ├── api/             # Node.js + NestJS
│   ├── retrieval/       # Python + FastAPI
│   └── orders/          # Node.js (API simulada)
├── contracts/           # contratos OpenAPI entre os serviços
├── infra/postgres/      # inicialização do banco (schemas e usuários)
└── docker-compose.yml
```

## Como rodar

Pré-requisitos: Docker (ou OrbStack).

```bash
cp .env.example .env       # e preencha as senhas e a ORDERS_API_KEY (o .env fica fora do git)
docker compose up -d
docker compose ps          # todos os serviços devem aparecer como "healthy"
```

| Serviço | Porta | Status | Documentação |
|---|---|---|---|
| `postgres` | 5432 | pronto | [`infra/postgres`](infra/postgres/init/01-schemas.sh) |
| `orders` | 3002 | pronto | [`services/orders`](services/orders/README.md) |
| `api` | 3000 | em construção | |
| `retrieval` | 8000 | em construção | |
