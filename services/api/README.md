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
- A cada mensagem, a LLM recebe o prompt de sistema versionado (`src/prompts/assistant-v3.md`), as
  20 mensagens mais recentes da conversa e as ferramentas do agente.
- Toda chamada à LLM é registrada em `app.llm_calls` (provedor, modelo, versão do prompt, tokens,
  latência, motivo de parada, erro) e numa linha de log com o correlation ID.
- Se a LLM falhar ou passar do tempo limite, a resposta é 503 `llm_unavailable` e a mensagem do
  cliente continua guardada.

## Agente e ferramentas

A cada mensagem, a LLM recebe as ferramentas abaixo e decide se precisa delas. A `api` executa o que
ela pedir, devolve o resultado e repete até a LLM responder (no máximo `AGENT_MAX_STEPS` chamadas).

| Ferramenta | Parâmetros | O que devolve |
|---|---|---|
| `list_my_orders` | nenhum | Pedidos do cliente, do mais recente para o mais antigo |
| `get_order` | `orderId` | Status, itens, total, previsão e data de entrega |
| `get_payment` | `orderId` | Método, status, valor pago e valor estornado |

**Regras que ficam no código, não na LLM**
- O cliente consultado vem sempre do token. Pedido de outro cliente tem a mesma resposta de um
  inexistente e é registrado como `denied`.
- Os parâmetros que a LLM manda são validados (Zod) antes de executar; ferramenta inexistente ou
  parâmetro inválido voltam como erro para a LLM corrigir.
- Os resultados não trazem dados pessoais (nome, CPF) e já vêm com valores em reais.
- Se o `orders` falhar, a ferramenta devolve um erro amigável e a conversa continua.

**Integração com o `orders`** (`src/orders-client`)
- Tipos gerados de `contracts/orders.yaml` (`npm run generate:orders-types`) e respostas validadas
  em tempo de execução com Zod; o schema Zod é amarrado aos tipos com `satisfies`.
- Tempo limite de 3 s por tentativa; consultas são repetidas até 3 vezes (espera de 200 e 400 ms),
  só em tempo limite, erro de rede ou 5xx. Erros 4xx não são repetidos.
- Envia `x-api-key` e propaga o `x-correlation-id` da requisição do cliente.

Cada passo fica registrado: chamadas à LLM em `app.llm_calls` e ferramentas em `app.tool_calls`.

```sql
SELECT tool_name, input, outcome, error_code, latency_ms FROM app.tool_calls ORDER BY id DESC LIMIT 10;
```

## Provedores de LLM

| `LLM_PROVIDER` | `LLM_MODEL` | Observação |
|---|---|---|
| `ollama` (padrão) | `qwen2.5:7b` | Roda na máquina host, fora do Compose. `ollama pull qwen2.5:7b` |
| `bedrock` | `us.anthropic.claude-haiku-5-5` | Converse API; credenciais do perfil `AWS_PROFILE` |

Trocar de provedor é só mudar as duas variáveis; nenhum código muda.

**Por que o Ollama fica fora do Compose:** no macOS, containers não acessam a GPU do Apple Silicon,
então o Ollama dentro do Docker usaria só a CPU e ficaria bem mais lento. Rodando direto no host, ele
usa a GPU. A `api` no container o encontra por `host.docker.internal` (no Linux, o `extra_hosts` do
Compose cria esse nome). Num Linux com GPU NVIDIA, também daria para rodá-lo como um serviço do
Compose, com a imagem `ollama/ollama`.

## Rodando

Com Docker (a partir da raiz do repositório, com o Ollama rodando na máquina host):

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
