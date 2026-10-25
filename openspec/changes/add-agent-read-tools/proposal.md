# Proposal

## Why

O assistente conversa, mas não enxerga nenhum dado: para "cadê meu pedido?" ele só pode dizer que
não consegue consultar. Esta change transforma o chat num agente: a LLM passa a decidir quando
consultar pedidos e pagamentos por meio de ferramentas, e a `api` executa essas consultas no
serviço `orders`, com autorização, validação e resiliência controladas pelo código.

## What Changes

- Loop do agente: a LLM pode pedir ferramentas, a `api` executa e devolve o resultado, até a LLM
  responder ou atingir um limite de passos.
- Três ferramentas de leitura: `list_my_orders`, `get_order` e `get_payment`.
- Autorização no código: o cliente vem do token, e a ferramenta só devolve pedidos dele.
- Cliente HTTP do `orders` com tipos gerados do contrato, validação das respostas, tempo limite,
  retry com espera crescente e propagação do correlation ID.
- Falhas de ferramenta viram resultados de erro para a LLM explicar ao cliente, sem derrubar a conversa.
- Registro de cada chamada de ferramenta, além das chamadas à LLM.
- Novo prompt `assistant-v2`, que orienta o uso das ferramentas.

## Capabilities

### New Capabilities
- `agent-orchestration`: o loop de tool calling, seus limites e o tratamento de falhas das ferramentas.
- `order-tools`: as ferramentas de consulta de pedidos e pagamentos e a autorização por cliente.
- `orders-integration`: como a `api` chama o serviço `orders` (contrato, tempo limite, retry, rastreamento).

### Modified Capabilities
<!-- Nenhuma: o comportamento existente das conversas continua válido; o agente é adicionado. -->

## Impact

- `services/api`: novos módulos de agente, ferramentas e cliente do `orders`; tabela `tool_calls`.
- Novas dependências: `zod` e, em desenvolvimento, `openapi-typescript`.
- `docker-compose.yml`: a `api` passa a depender do `orders` e recebe `ORDERS_BASE_URL` e `ORDERS_API_KEY`.

## Fora do escopo

- Ferramentas que alteram dados (estorno): change 5, com aprovação humana.
- Busca nas políticas da loja (RAG): change 4.
- Guardar os passos das ferramentas no histórico da conversa: só as mensagens finais são guardadas.
- Mascaramento de dados pessoais nas mensagens e defesas contra injeção de prompt: change 6.
