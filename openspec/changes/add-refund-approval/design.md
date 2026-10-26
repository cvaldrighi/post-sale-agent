# Design

## Context

O `orders` já tem `POST /refunds` com `Idempotency-Key` obrigatória, recusa estornar pagamento não
confirmado ou acima do valor pago e trata solicitações simultâneas com `SELECT … FOR UPDATE`. A `api`
tem o ciclo do agente, as ferramentas de leitura com autorização por cliente e o `OrdersClient` com
retry só para consultas. Motivação em proposal.md; comportamento nas specs.

## Goals / Non-Goals

**Goals:**
- A primeira ferramenta de escrita seguindo a regra do projeto: a LLM propõe, o cliente aprova.
- Execução segura contra cliques repetidos, retry e falhas do `orders`.

**Non-Goals:**
- Um mecanismo genérico de ações para vários tipos; o modelo de dados já tem `type`, mas só `refund` existe.
- Interface de aprovação: sem frontend, a aprovação é feita pelo Swagger ou por curl.

## Decisions

### 1. Proposta e execução separadas
`request_refund` só grava uma ação `pending`. A execução fica em `POST /actions/{id}/approve`, que a
LLM não tem como chamar: ela não é uma ferramenta. Mesmo que uma injeção de prompt convença o modelo a
"fazer o estorno", o máximo que ele consegue é propor; quem executa é o cliente, vendo o valor e o pedido.
- Alternativa: a ferramenta perguntar "confirma?" e executar na mensagem seguinte se o cliente disser
  "sim". Descartada: quem interpretaria o "sim" seria a LLM, e a confirmação dependeria do modelo.

### 2. Validar antes de propor
A ferramenta consulta pedido e pagamento (mesma autorização do `get_order`) e recusa propostas
impossíveis: pagamento que não está `confirmed`/`partially_refunded` ou valor acima do estornável. O
`orders` valida de novo na execução, porque o pagamento pode mudar entre a proposta e a aprovação.

### 3. Tabela `app.pending_actions`
| Coluna | Uso |
|---|---|
| `id` (uuid) | identificador da ação e `Idempotency-Key` no `orders` |
| `conversation_id`, `customer_id` | dono da ação; aprovar exige o mesmo `customer_id` do token |
| `type` | `refund` |
| `order_id`, `amount_cents`, `reason` | o que será executado, fixado na proposta |
| `status` | `pending` → `executing` → `executed` / `failed`; ou `pending` → `rejected` |
| `expires_at` | 15 minutos depois da criação |
| `result`, `error_code` | estorno criado ou motivo da falha |
| `created_at`, `decided_at` | auditoria |

Uma ação vencida continua `pending` no banco; a validade é conferida na aprovação. Não há job de expiração.

### 4. Aprovação atômica
```sql
UPDATE app.pending_actions SET status = 'executing', decided_at = now()
WHERE id = $1 AND customer_id = $2 AND status = 'pending' AND expires_at > now()
RETURNING *
```
Se nenhuma linha mudar, uma consulta separada decide a resposta: 404 (não existe ou é de outro
cliente), 409 `action_expired` ou 409 `action_not_pending`. Duas aprovações simultâneas: o Postgres
deixa só uma das duas mudar a linha. A chamada ao `orders` acontece fora de transação, depois do UPDATE.

### 5. Retry numa escrita, com a mesma chave
`OrdersClient.createRefund(input, idempotencyKey, correlationId)` usa o mesmo `withRetry`. Repetir um
`POST` normalmente é perigoso; aqui é seguro porque a `Idempotency-Key` (o id da ação) é a mesma em
todas as tentativas, e o `orders` devolve o estorno original em vez de criar outro. Isso vale também
entre aprovações: se o `orders` cair, a ação volta para `pending` e a nova aprovação usa a mesma chave.
- 409/422 do `orders` viram `failed` com o `code` (ex.: `payment_not_refundable`), sem retry.

### 6. Conversa coerente
Depois da execução, a `api` grava uma mensagem do assistente com o resultado (ex.: "Estorno de
R$ 189,90 do pedido ord_1001 concluído."). Assim, se o cliente continuar a conversa, a LLM vê no
histórico o que aconteceu. O texto é montado pelo código, não pela LLM.

### 7. Prompt `assistant-v6`
Acrescenta ao v5: usar `request_refund` quando o cliente pedir um estorno, explicar que o estorno só
acontece depois da aprovação e nunca dizer que já foi feito.

## Risks / Trade-offs

- [O modelo pode dizer "estorno feito" mesmo com a ação pendente] → instrução no prompt; o dado real
  está no `pendingAction` da resposta; caso de avaliação na change 7.
- [O cliente aprova um estorno que a política não permite] → fora do escopo: o agente não decide
  elegibilidade. Em produção, regras de negócio no `orders` ou aprovação por atendente.

## Em produção

- Aprovação com segundo fator ou por um atendente, conforme o valor.
- Job para marcar ações vencidas e evento/notificação quando o estorno de cartão terminar.
- Ações com `executing` presas (o processo caiu no meio): rotina que reconsulta o `orders` com a mesma chave.
