# Tasks

## 1. Estorno no cliente do orders

- [ ] 1.1 Implementar `OrdersClient.createRefund` (`POST /refunds`, `Idempotency-Key`, mesmo retry das consultas, 409/422 sem retry com o `code`, validação Zod do `Refund`); verificar com testes unitários (201, 503 depois 201 com a mesma chave, 422 sem retry)

## 2. Ações pendentes

- [ ] 2.1 Criar a entidade e a migration de `app.pending_actions`; verificar com `npm run migration:run`
- [ ] 2.2 Implementar o `ActionsService` (criar ou reaproveitar a pendente do pedido, aprovar com UPDATE condicional, executar, recusar, mensagem na conversa); verificar com testes unitários ou de integração
- [ ] 2.3 Criar `POST /actions/{id}/approve` e `/reject` com os erros em problem+json; verificar com testes E2E (aprovação, repetida, vencida, outro cliente, orders fora do ar, orders recusa, recusa pelo cliente)

## 3. Ferramenta e conversa

- [ ] 3.1 Implementar `request_refund` (autorização, pagamento estornável, valor, sem chamar `POST /refunds`); verificar com testes unitários
- [ ] 3.2 Incluir `pendingAction` na resposta de `POST /conversations/{id}/messages`; verificar com teste E2E
- [ ] 3.3 Criar o prompt `assistant-v6` e torná-lo o ativo; verificar com o teste de versão registrada

## 4. Documentação

- [ ] 4.1 Atualizar `services/api/README.md` (fluxo de aprovação, endpoints, estados da ação); verificar os exemplos

## 5. Verificação manual

- [ ] 5.1 Com o Compose e o Ollama rodando, como `cust_001`: pedir "Quero o estorno do pedido ord_1001", conferir a resposta e o `pendingAction`, aprovar pelo Swagger, conferir o pagamento no `orders` (`refunded`), aprovar de novo (409) e pedir estorno de `ord_2001` (de outro cliente). Para voltar os dados de exemplo ao estado inicial: `docker compose down -v && docker compose up -d`

## Workflow follow-up

- Abrir o PR de `feat/add-refund-approval` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-refund-approval`.
