# Spec Delta

## Purpose

Permite que outros serviços consultem os pedidos de um cliente, os detalhes de um pedido e o
pagamento associado, simulando a API de pedidos de um e-commerce.

## ADDED Requirements

### Requirement: Listar pedidos de um cliente
O serviço SHALL responder `GET /customers/{customerId}/orders` com a lista de resumos dos pedidos
do cliente, do mais recente para o mais antigo. Cada resumo contém `id`, `status`, `totalCents`,
`currency` e `createdAt`. Um cliente sem pedidos, ou desconhecido, recebe uma lista vazia.

#### Scenario: Cliente com pedidos
- **WHEN** a requisição pede os pedidos de `cust_001`
- **THEN** a resposta é 200 com os pedidos de `cust_001`, ordenados por `createdAt` decrescente
- **AND** nenhum pedido de outro cliente aparece na lista

#### Scenario: Cliente sem pedidos
- **WHEN** a requisição pede os pedidos de um `customerId` que não existe
- **THEN** a resposta é 200 com uma lista vazia

### Requirement: Consultar um pedido
O serviço SHALL responder `GET /orders/{orderId}` com o pedido completo: `id`, `customerId`,
`status`, `items` (com `sku`, `name`, `quantity`, `unitPriceCents`), `totalCents`, `currency`,
`createdAt`, `estimatedDeliveryDate`, `deliveredAt` e os dados do cliente (`name` e `document`).
O `status` é um de `awaiting_payment`, `paid`, `shipped`, `delayed`, `delivered` ou `canceled`.

#### Scenario: Pedido existente
- **WHEN** a requisição pede o pedido `ord_1001`
- **THEN** a resposta é 200 com o pedido, incluindo `customerId` igual a `cust_001`

#### Scenario: Pedido inexistente
- **WHEN** a requisição pede um `orderId` que não existe
- **THEN** a resposta é 404 com um erro no formato problem+json e `code` igual a `order_not_found`

### Requirement: Consultar o pagamento de um pedido
O serviço SHALL responder `GET /orders/{orderId}/payment` com o pagamento do pedido: `id`,
`orderId`, `method` (`pix` ou `credit_card`), `status`, `amountCents`, `refundedAmountCents`,
`currency`, `paidAt` e, para cartão, apenas `cardLast4`. O número completo do cartão nunca é
retornado. O `status` é um de `pending`, `confirmed`, `failed`, `partially_refunded` ou `refunded`.

#### Scenario: Pagamento por cartão
- **WHEN** a requisição pede o pagamento de um pedido pago com cartão
- **THEN** a resposta é 200 com `method` igual a `credit_card` e `cardLast4` com 4 dígitos
- **AND** a resposta não contém nenhum outro dado do cartão

#### Scenario: Pagamento de pedido inexistente
- **WHEN** a requisição pede o pagamento de um `orderId` que não existe
- **THEN** a resposta é 404 com `code` igual a `order_not_found`

### Requirement: Valores monetários e datas
Todos os valores monetários SHALL ser inteiros em centavos (campos terminados em `Cents`),
acompanhados de `currency` no padrão ISO 4217 (`BRL`). Todas as datas SHALL estar no formato
ISO 8601 em UTC.

#### Scenario: Formato do total
- **WHEN** a requisição pede um pedido de R$ 189,90
- **THEN** `totalCents` é `18990` e `currency` é `BRL`

### Requirement: Respostas conforme o contrato
Toda resposta de sucesso ou de erro dos endpoints de consulta SHALL estar de acordo com os schemas
definidos em `contracts/orders.yaml`.

#### Scenario: Teste de contrato
- **WHEN** os testes automatizados chamam cada endpoint de consulta, com sucesso e com erro
- **THEN** cada resposta é validada contra o contrato e nenhuma diverge
