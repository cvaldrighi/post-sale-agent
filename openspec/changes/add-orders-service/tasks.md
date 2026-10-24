# Tasks

## 1. Contrato

- [ ] 1.1 Escrever `contracts/orders.yaml` (OpenAPI 3.1) com os endpoints, schemas de pedido, pagamento, estorno e erro problem+json, headers `x-api-key`, `Idempotency-Key`, `x-correlation-id` e `x-simulate`; verificar com `npx @redocly/cli lint contracts/orders.yaml` sem erros

## 2. Estrutura do serviço

- [ ] 2.1 Criar o projeto NestJS em `services/orders` (TypeScript estrito, ESLint, Prettier, Jest) e verificar que `npm run build` e `npm run lint` passam
- [ ] 2.2 Adicionar a configuração com validação das variáveis de ambiente e verificar que o serviço recusa iniciar sem `ORDERS_API_KEY`
- [ ] 2.3 Configurar o TypeORM com o usuário `orders_service`, schema `orders`, `synchronize: false` e migrations; verificar que o serviço conecta ao Postgres do Compose

## 3. Banco de dados

- [ ] 3.1 Criar as entidades e a migration das tabelas `customers`, `orders`, `payments` e `refunds` (com `idempotency_key` única e `request_hash`); verificar com `npm run migration:run` e `\dt orders.*` no psql
- [ ] 3.2 Criar a migration de seed com os dados de exemplo do design; verificar que `SELECT count(*) FROM orders.orders` retorna 5

## 4. Operação do serviço

- [ ] 4.1 Implementar o filtro global de erros em problem+json com `code`; verificar com teste unitário do filtro
- [ ] 4.2 Implementar o guard de `x-api-key` (comparação em tempo constante, `/health` liberado) e verificar com testes E2E de 401 e 200
- [ ] 4.3 Implementar `GET /health` com checagem do banco e verificar com teste E2E
- [ ] 4.4 Configurar logs JSON com `nestjs-pino` e correlation ID (recebido ou gerado, devolvido no header); verificar com teste E2E do header
- [ ] 4.5 Implementar o interceptor de `x-simulate` (`slow` e `error`, só com a simulação habilitada) e verificar com testes E2E dos três cenários da spec

## 5. Consultas

- [ ] 5.1 Implementar `GET /customers/{customerId}/orders` e verificar com testes E2E (com pedidos, sem pedidos, ordenação) validados contra o contrato
- [ ] 5.2 Implementar `GET /orders/{orderId}` e verificar com testes E2E (existente, inexistente) validados contra o contrato
- [ ] 5.3 Implementar `GET /orders/{orderId}/payment` e verificar com testes E2E (Pix, cartão só com `cardLast4`, inexistente) validados contra o contrato

## 6. Estornos

- [ ] 6.1 Implementar as regras de estorno (estado do pagamento, valor estornável, status `completed` para Pix e `processing` para cartão) e verificar com testes unitários
- [ ] 6.2 Implementar `POST /refunds` com transação e `SELECT ... FOR UPDATE` no pagamento; verificar com testes E2E de estorno total de Pix, parcial de cartão, pagamento pendente, já estornado, valor acima do estornável, corpo inválido e pedido inexistente, todos validados contra o contrato
- [ ] 6.3 Implementar a idempotência (chave obrigatória, replay com `Idempotent-Replayed: true`, chave reutilizada com outro corpo); verificar com testes E2E dos três cenários
- [ ] 6.4 Verificar com teste E2E que duas requisições simultâneas de estorno total do mesmo pagamento resultam em exatamente um estorno

## 7. Docker e documentação

- [ ] 7.1 Criar o `Dockerfile` (multi-stage) e adicionar o serviço `orders` ao `docker-compose.yml`, com healthcheck e dependência do Postgres; adicionar `ORDERS_API_KEY` vazia ao `.env.example`; verificar que `docker compose up -d orders` fica healthy
- [ ] 7.2 Documentar o serviço em `services/orders/README.md` (como rodar, testar e exemplos de requisição) e atualizar o README principal; verificar que os comandos documentados funcionam como escritos

## 8. Verificação manual

- [ ] 8.1 Com o Compose rodando, executar: consultar `ord_1001`, pedir o estorno total com uma `Idempotency-Key`, repetir a mesma requisição (deve voltar o mesmo estorno com `Idempotent-Replayed: true`) e consultar o pagamento (deve estar `refunded`)

## Workflow follow-up

- Abrir o PR da branch `feat/add-orders-service` e fazer o merge depois da revisão.
- Arquivar a change com `openspec archive add-orders-service` e conferir que as specs foram para `openspec/specs/`.
