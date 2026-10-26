# Spec Delta

## ADDED Requirements

### Requirement: Solicitação de estorno idempotente
A `api` SHALL pedir estornos ao `orders` por `POST /refunds` sempre com o header `Idempotency-Key`.
Como a chave garante que uma repetição não cria outro estorno, a solicitação SHALL usar o mesmo
tempo limite e o mesmo retry das consultas, com a mesma chave em todas as tentativas. Respostas
409 e 422 MUST NOT ser repetidas e SHALL ser devolvidas com o `code` do erro.

#### Scenario: Retry com a mesma chave
- **WHEN** a primeira tentativa de estorno recebe 503 e a segunda recebe 201
- **THEN** o estorno é bem-sucedido e as duas tentativas usaram a mesma `Idempotency-Key`

#### Scenario: Estorno recusado pelo orders
- **WHEN** o `orders` responde 422 com `code` `amount_exceeds_refundable`
- **THEN** não há nova tentativa e a falha traz o código `amount_exceeds_refundable`
