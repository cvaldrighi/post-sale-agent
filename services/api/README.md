# api

Porta de entrada pública do assistente de pós-venda. Autentica o cliente, guarda as conversas e
gera as respostas com uma LLM, atrás de uma interface que permite trocar de provedor por configuração.

Node.js 24 · NestJS · TypeORM · PostgreSQL (schema `app`) · Ollama ou Amazon Bedrock

## Endpoints

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `GET` | `/health` | não | Saúde do serviço e do banco |
| `GET` | `/docs` | não | Swagger UI para testar a API |
| `POST` | `/auth/token` | não | Emite um token para o cliente (login simplificado da PoC) |
| `POST` | `/conversations` | Bearer | Abre uma conversa |
| `GET` | `/conversations/{id}` | Bearer | Consulta a conversa e as mensagens |
| `POST` | `/conversations/{id}/messages` | Bearer | Envia uma mensagem e recebe a resposta do assistente |

**Comportamentos importantes**
- A identidade do cliente vem só do token (JWT HS256, 1 hora). Conversa de outro cliente responde
  404, igual a uma inexistente, para não revelar que existe.
- A cada mensagem, a LLM recebe o prompt de sistema versionado (`src/prompts/assistant-v1.md`) e as
  20 mensagens mais recentes da conversa.
- Toda chamada à LLM é registrada em `app.llm_calls` (provedor, modelo, versão do prompt, tokens,
  latência, motivo de parada, erro) e numa linha de log com o correlation ID.
- Se a LLM falhar ou passar do tempo limite, a resposta é 503 `llm_unavailable` e a mensagem do
  cliente continua guardada.

## Provedores de LLM

| `LLM_PROVIDER` | `LLM_MODEL` | Observação |
|---|---|---|
| `ollama` (padrão) | `qwen2.5:7b` | Roda no Mac. `ollama pull qwen2.5:7b` |
| `bedrock` | `us.anthropic.claude-haiku-5-5` | Converse API; credenciais do perfil `AWS_PROFILE` |

Trocar de provedor é só mudar as duas variáveis; nenhum código muda.

## Rodando

Com Docker (a partir da raiz do repositório, com o Ollama aberto no Mac):

```bash
docker compose up -d api
docker compose ps          # api deve ficar "healthy"
```

Localmente, para desenvolver:

```bash
cp .env.example .env       # DATABASE_PASSWORD = APP_DB_PASSWORD da raiz; JWT_SECRET: openssl rand -hex 32
npm install
npm run start:dev
```

Depois abra http://localhost:3000/docs: gere um token em `POST /auth/token`, clique em
**Authorize**, crie uma conversa e envie uma mensagem.

## Testes

```bash
npm test               # unitários (inclui os adaptadores do Ollama e do Bedrock com respostas simuladas)
npm run test:e2e       # ponta a ponta contra o Postgres, com um provedor de LLM falso
npm run lint
```

## Exemplo com curl

```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/token -H "Content-Type: application/json" \
  -d '{"customerId":"cust_001"}' | jq -r .accessToken)

CONVERSATION=$(curl -s -X POST localhost:3000/conversations \
  -H "Authorization: Bearer $TOKEN" | jq -r .id)

curl -s -X POST localhost:3000/conversations/$CONVERSATION/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"Olá, o que você pode fazer por mim?"}'
```
