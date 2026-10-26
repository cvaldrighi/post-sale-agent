# refund-approval Specification

## Purpose
Permite que o assistente proponha o estorno de um pagamento e garante que ele só seja executado
depois da aprovação explícita do cliente, por um caminho que a LLM não consegue acionar.

## Requirements

### Requirement: Propor um estorno
A ferramenta `request_refund`, com `orderId`, `reason` (1 a 500 caracteres) e `amountCents` opcional,
SHALL criar uma ação pendente de estorno, sem chamar o `POST /refunds` do `orders`. Sem `amountCents`,
o valor é todo o valor ainda estornável. O resultado para a LLM SHALL ter `actionId`, valor formatado,
`orderId` e `status` `awaiting_customer_approval`.

#### Scenario: Estorno proposto
- **WHEN** a LLM pede `request_refund` para `ord_1001` (Pix confirmado de R$ 189,90) numa conversa de `cust_001`
- **THEN** existe uma ação `pending` de R$ 189,90 para `ord_1001`, com validade de 15 minutos
- **AND** nenhum estorno foi pedido ao `orders`
- **AND** o resultado tem `status` `awaiting_customer_approval`

### Requirement: Validações antes de propor
A ferramenta MUST conferir no código, antes de criar a ação, que o pedido é do cliente autenticado,
que o pagamento está `confirmed` ou `partially_refunded` e que o valor não passa do estornável.
Pedido de outro cliente SHALL ter a mesma resposta de um inexistente.

#### Scenario: Pedido de outro cliente
- **WHEN** a LLM pede `request_refund` para `ord_2001`, de `cust_002`, numa conversa de `cust_001`
- **THEN** o resultado é `order_not_found` com `outcome` `denied` e nenhuma ação é criada

#### Scenario: Pagamento já estornado
- **WHEN** o pagamento do pedido está `refunded`
- **THEN** o resultado é `payment_not_refundable` e nenhuma ação é criada

#### Scenario: Valor acima do estornável
- **WHEN** a LLM pede um `amountCents` maior que o valor ainda estornável
- **THEN** o resultado é `amount_exceeds_refundable` e nenhuma ação é criada

### Requirement: Uma proposta por pedido
Se já existir uma ação `pending` e válida para o mesmo pedido na mesma conversa, a ferramenta SHALL
devolver essa ação em vez de criar outra. Numa conversa diferente, SHALL criar uma nova proposta,
para que a resposta de cada conversa traga a ação que o cliente pode aprovar ali.

#### Scenario: Pedido repetido
- **WHEN** a LLM pede `request_refund` duas vezes para `ord_1001` na mesma conversa
- **THEN** existe uma única ação `pending` para `ord_1001`

#### Scenario: Pedido em outra conversa
- **WHEN** o cliente pede o estorno de `ord_1001` numa conversa e depois numa conversa nova
- **THEN** cada conversa tem a sua ação `pending` e a resposta da conversa nova traz `pendingAction`

### Requirement: Ação pendente na resposta
A resposta de `POST /conversations/{id}/messages` SHALL trazer em `pendingAction` (`id`, `type`,
`orderId`, `amountCents`, `expiresAt`) a ação `pending` e válida mais recente da conversa, e `null`
quando não houver. Enquanto o cliente não decide, cada resposta lembra o que aguarda aprovação.

#### Scenario: Mensagem que gera proposta
- **WHEN** o cliente pede um estorno e o agente chama `request_refund`
- **THEN** a resposta tem `pendingAction` com o `id` da ação criada
- **AND** o `orders` não recebeu nenhum `POST /refunds`

#### Scenario: Conversa sem proposta
- **WHEN** o cliente envia uma mensagem e a conversa não tem ação pendente
- **THEN** a resposta tem `pendingAction` igual a `null`

### Requirement: Aprovar uma ação
`POST /actions/{id}/approve` SHALL executar a ação `pending` e válida do cliente autenticado: chama o
`POST /refunds` do `orders` com o id da ação como `Idempotency-Key`, grava o resultado e muda o status
para `executed`. Uma mensagem do assistente com o resultado SHALL ser adicionada à conversa. Ação de
outro cliente ou inexistente MUST responder 404 `action_not_found`.

#### Scenario: Aprovação bem-sucedida
- **WHEN** o cliente aprova a ação pendente de `ord_1001`
- **THEN** a resposta é 200 com `status` `executed` e o estorno criado
- **AND** o `orders` recebeu um `POST /refunds` com `Idempotency-Key` igual ao id da ação
- **AND** a conversa tem uma nova mensagem do assistente sobre o estorno

#### Scenario: Ação de outro cliente
- **WHEN** `cust_002` tenta aprovar uma ação de `cust_001`
- **THEN** a resposta é 404 com `code` `action_not_found` e nada é executado

### Requirement: Executar uma única vez
A aprovação MUST mudar o status de `pending` para `executing` numa única operação condicional, de modo
que duas aprovações simultâneas executem o estorno uma vez só. Ação que não está `pending` SHALL
responder 409 `action_not_pending`; ação vencida SHALL responder 409 `action_expired`.

#### Scenario: Aprovação repetida
- **WHEN** o cliente aprova a mesma ação duas vezes
- **THEN** a segunda resposta é 409 com `code` `action_not_pending`
- **AND** o `orders` recebeu um único `POST /refunds`

#### Scenario: Ação vencida
- **WHEN** o cliente aprova uma ação criada há mais de 15 minutos
- **THEN** a resposta é 409 com `code` `action_expired`

### Requirement: Falha ao executar
Se o `orders` recusar o estorno (409 ou 422), a ação SHALL ficar `failed` com o código do erro. Se o
`orders` estiver indisponível depois das tentativas, a ação SHALL voltar para `pending` e a resposta
SHALL ser 503 `orders_unavailable`, para o cliente poder aprovar de novo com a mesma chave.

#### Scenario: Orders indisponível
- **WHEN** o cliente aprova e o `orders` responde 503 em todas as tentativas
- **THEN** a resposta é 503 com `code` `orders_unavailable` e a ação continua `pending`

#### Scenario: Estorno recusado
- **WHEN** o cliente aprova e o `orders` responde 409 `payment_not_refundable`
- **THEN** a resposta é 200 com `status` `failed` e `errorCode` `payment_not_refundable`

### Requirement: Recusar uma ação
`POST /actions/{id}/reject` SHALL mudar uma ação `pending` do cliente para `rejected`, sem chamar o
`orders`.

#### Scenario: Cliente recusa
- **WHEN** o cliente recusa a ação pendente
- **THEN** a resposta é 200 com `status` `rejected` e o `orders` não recebe nenhum estorno

### Requirement: Prompt para estornos
O prompt do assistente SHALL orientar a sempre usar `request_refund` quando o cliente pedir um
estorno, mesmo que ele cite defeito, garantia ou prazo, deixando para a ferramenta a decisão sobre
o estorno; a explicar que o estorno só acontece depois da aprovação do cliente; e a nunca dizer que
ele já foi feito.

#### Scenario: Versão do prompt registrada
- **WHEN** o assistente responde uma mensagem
- **THEN** a chamada à LLM é registrada com a versão de prompt ativa (`ASSISTANT_PROMPT_VERSION`)
