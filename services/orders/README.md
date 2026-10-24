# orders

API **simulada** de pedidos e pagamentos de um e-commerce. Representa um sistema de terceiro que a
`api` do post-sale-agent consome: o contrato em [`contracts/orders.yaml`](../../contracts/orders.yaml)
foi escrito antes do código (contract-first) e os testes conferem cada resposta contra ele.

Node.js 24 · NestJS · TypeORM · PostgreSQL (schema `orders`)

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Saúde do serviço e do banco (sem autenticação) |
| `GET` | `/customers/{customerId}/orders` | Pedidos do cliente, do mais recente para o mais antigo |
| `GET` | `/orders/{orderId}` | Pedido completo, com itens e dados do cliente |
| `GET` | `/orders/{orderId}/payment` | Pagamento do pedido (cartão: só os 4 últimos dígitos) |
| `POST` | `/refunds` | Estorno total ou parcial, com `Idempotency-Key` obrigatória |

Todas as rotas, exceto `/health`, exigem o header `x-api-key`.

**Comportamentos importantes**
- Dinheiro sempre em centavos inteiros (`totalCents: 18990` = R$ 189,90).
- Erros em `application/problem+json` (RFC 9457) com um `code` estável, por exemplo `order_not_found`.
- `POST /refunds` repetido com a mesma `Idempotency-Key` e o mesmo corpo devolve o estorno original
  (200, `Idempotent-Replayed: true`) em vez de criar outro. Estornos simultâneos do mesmo pagamento
  são serializados no banco (`SELECT ... FOR UPDATE`), então nunca se estorna mais do que foi pago.
- `x-correlation-id` é lido (ou gerado), devolvido na resposta e incluído em todos os logs (JSON).
- Com `ORDERS_SIMULATION_ENABLED=true`, o header `x-simulate: slow` atrasa a resposta e
  `x-simulate: error` devolve 503, para testar timeout e retry de quem consome o serviço.

## Dados de exemplo

| Pedido | Cliente | Status | Pagamento | Para testar |
|---|---|---|---|---|
| `ord_1001` | `cust_001` | `delayed` | Pix, confirmado, R$ 189,90 | estorno total de Pix |
| `ord_1002` | `cust_001` | `delivered` | cartão, confirmado, R$ 349,00 | estorno parcial de cartão |
| `ord_1003` | `cust_001` | `shipped` | Pix, confirmado, R$ 79,90 | consulta |
| `ord_2001` | `cust_002` | `canceled` | cartão, já estornado | estorno recusado |
| `ord_2002` | `cust_002` | `awaiting_payment` | Pix, pendente | estorno recusado |

## Rodando

Com Docker (a partir da raiz do repositório):

```bash
docker compose up -d orders      # sobe o Postgres e o serviço; as migrations rodam ao iniciar
docker compose ps                # orders deve ficar "healthy"
```

Localmente, para desenvolver (o Postgres do Compose precisa estar rodando):

```bash
cp .env.example .env             # preencha DATABASE_PASSWORD e ORDERS_API_KEY
npm install
npm run start:dev
```

## Testes

```bash
npm test               # unitários
npm run test:e2e       # ponta a ponta contra o Postgres, com validação de contrato
npm run lint
```

Os testes E2E restauram os dados de exemplo antes de rodar e validam cada resposta contra
`contracts/orders.yaml` com o matcher `toMatchContract()` (`test/contract.ts`).

## Exemplos

```bash
KEY=<sua ORDERS_API_KEY>

curl -s localhost:3002/orders/ord_1001 -H "x-api-key: $KEY"

curl -s -X POST localhost:3002/refunds \
  -H "x-api-key: $KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-001" \
  -d '{"orderId":"ord_1001","amountCents":18990,"reason":"Pedido atrasado"}'
```
