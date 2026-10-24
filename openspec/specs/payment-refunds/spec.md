# payment-refunds Specification

## Purpose
Permite solicitar o estorno total ou parcial do pagamento de um pedido, garantindo que uma mesma
solicitação repetida não gere estornos duplicados e que nunca se estorne mais do que foi pago.

## Requirements

### Requirement: Solicitar estorno
O serviço SHALL aceitar `POST /refunds` com `orderId`, `amountCents` e `reason`, e responder 201
com o estorno criado: `id`, `orderId`, `paymentId`, `amountCents`, `currency`, `reason`, `status`
e `createdAt`. Estorno de Pix tem `status` `completed`; estorno de cartão tem `status` `processing`.

#### Scenario: Estorno total de Pix
- **WHEN** a requisição pede o estorno do valor total de um pagamento Pix confirmado
- **THEN** a resposta é 201 com `status` igual a `completed`
- **AND** o pagamento passa a ter `status` `refunded` e `refundedAmountCents` igual ao valor pago

#### Scenario: Estorno parcial de cartão
- **WHEN** a requisição pede o estorno de parte do valor de um pagamento por cartão confirmado
- **THEN** a resposta é 201 com `status` igual a `processing`
- **AND** o pagamento passa a ter `status` `partially_refunded`

### Requirement: Chave de idempotência obrigatória
Toda requisição a `POST /refunds` MUST ter o header `Idempotency-Key`, com 1 a 64 caracteres.
A mesma chave com o mesmo corpo SHALL devolver o estorno original sem criar outro.
A mesma chave com um corpo diferente SHALL ser recusada.

#### Scenario: Requisição sem chave
- **WHEN** a requisição não tem o header `Idempotency-Key`
- **THEN** a resposta é 400 com `code` igual a `idempotency_key_required`
- **AND** nenhum estorno é criado

#### Scenario: Requisição repetida
- **WHEN** uma requisição de estorno bem-sucedida é enviada de novo com a mesma chave e o mesmo corpo
- **THEN** a resposta é 200 com o mesmo estorno da primeira resposta e o header `Idempotent-Replayed: true`
- **AND** existe apenas um estorno registrado

#### Scenario: Chave reutilizada com outro corpo
- **WHEN** uma chave já usada é enviada com um `amountCents` diferente
- **THEN** a resposta é 422 com `code` igual a `idempotency_key_reused`

### Requirement: Só estornar pagamento confirmado
O serviço MUST recusar o estorno quando o pagamento do pedido não estiver `confirmed` ou
`partially_refunded`.

#### Scenario: Pagamento pendente
- **WHEN** a requisição pede o estorno de um pedido cujo pagamento está `pending`
- **THEN** a resposta é 409 com `code` igual a `payment_not_refundable`

#### Scenario: Pagamento já estornado
- **WHEN** a requisição pede o estorno de um pagamento com `status` `refunded`
- **THEN** a resposta é 409 com `code` igual a `payment_not_refundable`

### Requirement: Não estornar além do valor pago
O valor de um estorno MUST ser maior que zero e não pode passar do valor ainda estornável
(`amountCents` do pagamento menos `refundedAmountCents`). Isso vale também quando duas
solicitações diferentes chegam ao mesmo tempo para o mesmo pagamento.

#### Scenario: Valor acima do estornável
- **WHEN** a requisição pede um estorno maior que o valor ainda estornável
- **THEN** a resposta é 422 com `code` igual a `amount_exceeds_refundable`

#### Scenario: Solicitações simultâneas
- **WHEN** duas requisições com chaves diferentes pedem, ao mesmo tempo, o estorno do valor total do mesmo pagamento
- **THEN** exatamente uma recebe 201 e a outra recebe 409 ou 422
- **AND** o total estornado não passa do valor pago

### Requirement: Pedido inexistente ou corpo inválido
O serviço SHALL responder 404 com `code` `order_not_found` quando o `orderId` não existir, e 400
com `code` `validation_error` quando o corpo for inválido (campo ausente, `amountCents` não inteiro
ou `reason` vazio).

#### Scenario: Corpo inválido
- **WHEN** a requisição envia `amountCents` igual a `"10"` (texto)
- **THEN** a resposta é 400 com `code` igual a `validation_error`

#### Scenario: Pedido inexistente
- **WHEN** a requisição pede o estorno de um `orderId` que não existe
- **THEN** a resposta é 404 com `code` igual a `order_not_found`

### Requirement: Respostas de estorno conforme o contrato
Toda resposta de `POST /refunds`, de sucesso ou de erro, SHALL estar de acordo com
`contracts/orders.yaml`.

#### Scenario: Teste de contrato
- **WHEN** os testes automatizados exercitam os cenários de estorno
- **THEN** cada resposta é validada contra o contrato e nenhuma diverge
