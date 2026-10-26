# Tasks

## 1. Guardrail

- [x] 1.1 Implementar `isUngroundedActionClaim`; verificar com testes unitários (afirmações, ofertas, com e sem `request_refund`)
- [x] 1.2 Aplicar no `ConversationsService` com o log `ungrounded_action`; verificar com testes E2E (afirmação sem ferramenta, afirmação com ferramenta)

## 2. Avaliação e documentação

- [x] 2.1 Adicionar o caso de estorno de pedido "atrasado" em `eval/cases.json` e atualizar o README da api
- [x] 2.2 Rodar `npm run eval` e registrar o resultado no design
- [x] 2.3 Ampliar os padrões com o gerúndio e "aprovar a solicitação" (achado da avaliação); verificar com testes unitários e rodando a avaliação de novo

## Workflow follow-up

- Abrir o PR de `feat/add-action-grounding` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-action-grounding`.
