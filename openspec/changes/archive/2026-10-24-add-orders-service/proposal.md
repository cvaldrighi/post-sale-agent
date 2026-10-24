# Proposal

## Why

O agente de pós-venda precisa consultar pedidos e pagamentos e solicitar estornos, mas não existe
um sistema de pedidos para integrar. Criamos um serviço que simula a API de um terceiro, com
contrato definido antes do código, para que a `api` tenha uma integração realista (autenticação,
erros, lentidão, idempotência) desde as primeiras ferramentas do agente.

## What Changes

- Novo contrato OpenAPI `contracts/orders.yaml`, escrito antes da implementação (contract-first).
- Novo serviço `services/orders` com dados de exemplo de clientes, pedidos e pagamentos.
- Consulta de pedidos de um cliente, de um pedido e do pagamento de um pedido.
- Solicitação de estorno com chave de idempotência e regras de negócio (só pagamento confirmado,
  sem estornar além do valor pago).
- Autenticação entre serviços por chave de API, health check, correlation ID nos logs.
- Simulação de lentidão e erro por header, para testar timeout e retry na `api`.
- Testes de contrato: as respostas do serviço são conferidas contra o `contracts/orders.yaml`.
- Serviço adicionado ao Docker Compose.

## Capabilities

### New Capabilities
- `order-queries`: consulta de pedidos de um cliente, de um pedido e do seu pagamento.
- `payment-refunds`: solicitação de estorno de um pagamento, com idempotência e regras de valor e estado.
- `orders-service-operations`: autenticação entre serviços, health check, correlation ID e simulação de falhas.

### Modified Capabilities
<!-- Nenhuma: é a primeira change com specs. -->

## Impact

- Novo diretório `services/orders` (Node.js) e novo arquivo `contracts/orders.yaml`.
- Tabelas novas no schema `orders` do Postgres, criadas por migrations do serviço.
- `docker-compose.yml` ganha o serviço `orders` e a variável `ORDERS_API_KEY` no `.env.example`.

## Fora do escopo

- Criação ou alteração de pedidos (os dados vêm de seed e só os estornos mudam o estado).
- Processamento real de pagamento ou integração com gateway: o estorno é registrado e respondido na hora.
- Autorização por cliente: o `orders` confia na `api`, que confere a posse do pedido (change 3).
- Chamadas da `api` para o `orders` (changes 3 e 5).
