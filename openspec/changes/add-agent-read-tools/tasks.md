# Tasks

## 1. Cliente do orders

- [ ] 1.1 Instalar `zod`, criar o script `generate:orders-types` e gerar os tipos a partir de `contracts/orders.yaml`; verificar que o arquivo gerado compila
- [ ] 1.2 Adicionar `ORDERS_BASE_URL`, `ORDERS_API_KEY`, `ORDERS_TIMEOUT_MS` e `AGENT_MAX_STEPS` à configuração validada; verificar com testes unitários
- [ ] 1.3 Implementar `withRetry` (só falhas temporárias, 3 tentativas, espera de 200 e 400 ms) e verificar com testes unitários (503 depois 200, 3 tempos limite, 404 sem retry)
- [ ] 1.4 Implementar o `OrdersClient` (x-api-key, x-correlation-id, tempo limite, validação Zod com `satisfies` dos tipos gerados) e verificar com testes unitários com `fetch` simulado (sucesso, 404, resposta fora do contrato)

## 2. Ferramentas

- [ ] 2.1 Definir a interface `AgentTool` e o registro, com JSON Schema gerado do Zod; verificar com teste unitário
- [ ] 2.2 Implementar `list_my_orders`, `get_order` e `get_payment` com autorização por contexto, valores formatados e sem CPF; verificar com testes unitários (pedido do cliente, de outro cliente → `order_not_found`/`denied`, inexistente, serviço indisponível)

## 3. Loop do agente

- [ ] 3.1 Criar a entidade e a migration de `tool_calls`; verificar com `npm run migration:run`
- [ ] 3.2 Implementar o `AgentService` (ciclo, limite de passos, ferramenta inexistente, parâmetros inválidos, erros como resultado, registro em `tool_calls` e no log); verificar com testes unitários usando uma LLM falsa com respostas roteirizadas

- [ ] 3.3 Deduplicar pedidos idênticos de ferramenta no mesmo passo (executa uma vez, um resultado por pedido); verificar com teste unitário

## 4. Conversas com o agente

- [ ] 4.1 Criar o prompt `assistant-v2` e ligar o `ConversationsService` ao `AgentService`, passando cliente e correlation ID; verificar com testes E2E usando LLM roteirizada e um servidor falso do `orders` (resposta com ferramenta, pedido de outro cliente, `orders` fora do ar, correlation ID propagado)

## 5. Docker e documentação

- [ ] 5.1 Adicionar `ORDERS_BASE_URL` e `ORDERS_API_KEY` à `api` no Compose, com dependência do `orders`; verificar que `docker compose up -d api` fica healthy
- [ ] 5.2 Atualizar `services/api/README.md` com as ferramentas e o fluxo do agente; verificar que os exemplos funcionam

## 6. Verificação manual

- [ ] 6.1 Com o Compose e o Ollama rodando, como `cust_001`: perguntar "Cadê meu pedido ord_1001?", "Quais são meus pedidos?", "Como paguei o pedido ord_1002?" e "Qual o status do pedido ord_2001?" (de outro cliente); conferir as respostas e os registros em `app.tool_calls`

## Workflow follow-up

- Abrir o PR de `feat/add-agent-read-tools` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-agent-read-tools`.
