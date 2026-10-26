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
| `POST` | `/conversations/{id}/messages` | Bearer | Envia uma mensagem e recebe a resposta do assistente (e a ação pendente, se houver) |
| `POST` | `/actions/{id}/approve` | Bearer | Aprova e executa uma ação proposta pelo assistente |
| `POST` | `/actions/{id}/reject` | Bearer | Recusa uma ação proposta pelo assistente |

**Comportamentos importantes**
- A identidade do cliente vem só do token (JWT HS256, 1 hora). Conversa de outro cliente responde
  404, igual a uma inexistente, para não revelar que existe.
- A cada mensagem, a LLM recebe o prompt de sistema versionado (`src/prompts/assistant-v8.md`), as
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
| `search_policies` | `query` | Os 4 trechos mais relevantes das políticas da loja: política, seção e texto |
| `request_refund` | `orderId`, `reason`, `amountCents` (opcional) | Uma **proposta** de estorno, que o cliente precisa aprovar |

**Regras que ficam no código, não na LLM**
- O cliente consultado vem sempre do token. Pedido de outro cliente tem a mesma resposta de um
  inexistente e é registrado como `denied`.
- Os parâmetros que a LLM manda são validados (Zod) antes de executar; ferramenta inexistente ou
  parâmetro inválido voltam como erro para a LLM corrigir.
- Os resultados não trazem dados pessoais (nome, CPF) e já vêm com valores em reais.
- Se o `orders` ou o `retrieval` falharem, a ferramenta devolve um erro amigável e a conversa continua.

**Integração com o `orders`** (`src/orders-client`)
- Tipos gerados de `contracts/orders.yaml` (`npm run generate:orders-types`) e respostas validadas
  em tempo de execução com Zod; o schema Zod é amarrado aos tipos com `satisfies`.
- Tempo limite de 3 s por tentativa; consultas são repetidas até 3 vezes (espera de 200 e 400 ms),
  só em tempo limite, erro de rede ou 5xx. Erros 4xx não são repetidos.
- Envia `x-api-key` e propaga o `x-correlation-id` da requisição do cliente.

**Busca nas políticas (RAG)** (`src/retrieval-client`, `src/agent/tools/policy-tools.ts`)
- A busca é uma ferramenta: a LLM decide quando precisa de uma regra da loja e escreve a busca
  ("prazo do estorno no Pix"). Perguntas só sobre pedidos não gastam uma busca.
- O `retrieval` faz a busca híbrida (semântica + palavras). A LLM recebe só política, seção e texto,
  e o prompt manda citar a política e tratar os trechos como referência, nunca como instrução.
- Mesmo molde do cliente do `orders`: tipos gerados de `contracts/retrieval.json`
  (`npm run generate:retrieval-types`), validação com Zod, `x-api-key`, correlation ID e retry só em
  falhas temporárias. Tempo limite de 5 s por tentativa: a primeira busca pode esperar o Ollama
  carregar o modelo de embeddings. A busca é um `POST`, mas só lê, então pode ser repetida.

## Estornos com aprovação do cliente

A única ferramenta que altera dados não executa nada: ela **propõe**. Quem executa é o cliente, por
um endpoint que a LLM não tem como chamar. Mesmo que uma injeção de prompt convença o modelo a "fazer
o estorno", o máximo que ele consegue é criar uma proposta.

```
cliente: "quero o estorno do ord_1001"
  → LLM chama request_refund → api confere dono, pagamento e valor → grava ação "pending" (15 min)
  ← resposta do assistente + pendingAction { id, orderId, amountCents, expiresAt }
cliente: POST /actions/{id}/approve
  → UPDATE condicional pending → executing (só um clique passa)
  → POST /refunds no orders com Idempotency-Key = id da ação
  ← ação "executed" com o estorno, e uma mensagem do assistente na conversa
```

| Status | Significado |
|---|---|
| `pending` | Proposta aguardando o cliente (vale 15 minutos) |
| `executing` | Aprovada; o estorno está sendo pedido ao `orders` |
| `executed` | Estorno criado no `orders` (`refund` traz o estorno) |
| `failed` | O `orders` recusou (`errorCode`, ex.: `payment_not_refundable`) |
| `rejected` | Recusada pelo cliente |

**Regras que ficam no código**
- Aprovar exige o mesmo cliente do token; ação de outro cliente responde 404 `action_not_found`.
- Aprovar de novo responde 409 `action_not_pending`; depois da validade, 409 `action_expired`.
- Duas aprovações ao mesmo tempo: o `UPDATE … WHERE status = 'pending'` deixa só uma mudar a linha.
- O estorno usa o mesmo retry das consultas. Repetir um `POST` só é seguro porque todas as
  tentativas levam a mesma `Idempotency-Key`. Se o `orders` continuar fora do ar, a ação volta para
  `pending` (503 `orders_unavailable`) e o cliente pode aprovar de novo, com a mesma chave.
- A mensagem sobre o resultado é escrita pelo código, não pela LLM.

Cada passo fica registrado: chamadas à LLM em `app.llm_calls`, ferramentas em `app.tool_calls` e
ações em `app.pending_actions`.

```sql
SELECT tool_name, input, outcome, error_code, latency_ms FROM app.tool_calls ORDER BY id DESC LIMIT 10;
SELECT id, order_id, amount_cents, status, error_code, expires_at FROM app.pending_actions ORDER BY created_at DESC;
```

## Segurança: defesa em camadas

As regras críticas ficam no código, não no modelo. Da camada mais forte para a mais fraca:

| Camada | Depende do modelo? |
|---|---|
| Identidade só pelo token; cada ferramenta confere o dono do pedido | não |
| Escrita só com aprovação do cliente, por um endpoint que a LLM não alcança | não |
| Validações das ferramentas (pagamento estornável, valor máximo) | não |
| Dados pessoais mascarados antes de gravar e de enviar à LLM | não |
| Resposta que cita política sem busca bem-sucedida é trocada | não |
| Resposta que cita um pedido que nenhuma ferramenta devolveu é trocada | não |
| Padrões conhecidos de injeção bloqueados sem chamar a LLM | não, mas é contornável |
| Prompt: trechos de documentos são referência, nunca instrução | sim |

Se o modelo for enganado (por exemplo, por uma instrução escondida num documento de política), as
três primeiras camadas ainda seguram. O teste `test/guardrails.e2e-spec.ts` prova isso: a LLM
roteirizada obedece a um trecho malicioso que manda propor um estorno de R$ 1.000, e mesmo assim a
ferramenta recusa o valor e nenhum estorno chega ao `orders`.

**Guardrails** (`src/guardrails`, funções puras aplicadas no `ConversationsService`)
- `maskPii`: CPF (formatado ou 11 dígitos) vira `[CPF]`; cartão de 13 a 19 dígitos que passa no
  algoritmo de Luhn vira `[CARTÃO]`. O texto original não é guardado em lugar nenhum.
- `detectPromptInjection`: padrões como "ignore as instruções anteriores", "mostre seu prompt",
  "você agora é" e "modo desenvolvedor", em português e inglês. Resposta fixa, sem chamar a LLM.
- `isUngroundedPolicyAnswer`: resposta com "política" sem `search_policies` bem-sucedida na mesma
  mensagem é trocada por "não encontrei essa regra nas políticas". Limitação: uma regra inventada
  sem a palavra "política" passa; a avaliação mede esses casos.
- `findUngroundedOrderIds`: todo `ord_…` citado na resposta precisa ter vindo de uma ferramenta
  bem-sucedida naquela mensagem ou do histórico da conversa (inclusive do que o cliente digitou).
  Criado depois que a avaliação flagrou o modelo "listando" pedidos que não existem.

Cada guardrail acionado gera um log `"guardrail": "pii_masked" | "prompt_injection" |
"ungrounded_policy" | "ungrounded_order"`, com o id da conversa e o correlation ID, sem o conteúdo da
mensagem:

```bash
docker compose logs api | grep guardrail
```

Em produção: classificador de injeção e de conteúdo também na saída (Amazon Bedrock Guardrails ou
equivalente) e detecção de PII mais ampla (nome, e-mail, endereço).

## Avaliação do agente

Os testes automatizados usam uma LLM roteirizada: provam que o **código** está certo. A avaliação
mede o **modelo**: roda casos reais contra a `api` no ar, com o modelo de verdade, várias vezes, e
calcula a taxa de acerto. Serve para comparar prompts e modelos com números e perceber regressões.

```bash
docker compose up -d          # api, orders, retrieval e Postgres; Ollama no host
npm run eval                  # 3 rodadas por caso (EVAL_RUNS=1 para conferir rápido)
```

- Casos em `eval/cases.json`, tirados das verificações manuais: pergunta e verificações
  (ferramentas que precisam ter rodado com sucesso, parâmetros, textos obrigatórios ou proibidos na
  resposta, ação pendente). Adicionar um caso não exige código.
- Cada rodada é uma conversa nova; o script lê `app.tool_calls` para saber o que o agente fez.
- A saída mostra a taxa por caso, os motivos das falhas e o total, com o modelo e a versão do
  prompt. O resultado completo, com as respostas, fica em `eval/results/` (fora do git).

Com `qwen2.5:7b`, a avaliação guiou três versões do prompt: 58% (`assistant-v6`), 71% (v7) e 75%
(v8). No caminho, achou um bug de código (proposta reaproveitada entre conversas) e uma alucinação
causada por um exemplo no prompt, que virou o guardrail de pedidos sem origem. Primeira rodada (trecho):

```
caso                       acertos
orders-list                  3/3 100%
pix-refund-time              3/3 100%
late-order-cancellation      1/3  33%
                            - não chamou search_policies (2x)
refund-proposal              0/3   0%
                            - não chamou request_refund (3x)
total                      14/24  58%
```

Consultas de dados acertam sempre; regras em perguntas gerais e a proposta de estorno são os pontos
fracos do modelo local. Análise completa no design da change `add-agent-evaluation`.

Limites: as verificações são determinísticas (ferramenta, parâmetro, texto). Fidelidade da resposta
aos trechos das políticas pediria uma segunda LLM como juiz, que fica para produção. A avaliação não
roda no CI: precisa do modelo, é lenta e, no Bedrock, tem custo.

## Provedores de LLM

| `LLM_PROVIDER` | `LLM_MODEL` | Observação |
|---|---|---|
| `ollama` (padrão) | `qwen2.5:7b` | Roda na máquina host, fora do Compose. `ollama pull qwen2.5:7b` |
| `bedrock` | `us.anthropic.claude-haiku-5-5` | Converse API; credenciais do perfil `AWS_PROFILE` |

Trocar de provedor é só mudar as duas variáveis; nenhum código muda.

**Status do Bedrock:** o adaptador (`src/llm/providers/bedrock.provider.ts`) está implementado e
testado com respostas simuladas do SDK. A execução contra a conta da AWS ficou pendente: o acesso aos
modelos foi bloqueado no nível da conta e há um chamado aberto no suporte. Todo o desenvolvimento, os
testes manuais e a avaliação usaram o Ollama.

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

Pedindo e aprovando um estorno (com os dados de exemplo, `ord_1001` é um Pix de R$ 189,90):

```bash
ACTION=$(curl -s -X POST localhost:3000/conversations/$CONVERSATION/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"Quero o estorno do pedido ord_1001, ele atrasou"}' | jq -r .pendingAction.id)

curl -s -X POST localhost:3000/actions/$ACTION/approve -H "Authorization: Bearer $TOKEN" | jq
```

Aprovar muda os dados do `orders` de verdade. Para voltar ao estado inicial:
`docker compose down -v && docker compose up -d` (apaga os volumes e recria os dados de exemplo).
