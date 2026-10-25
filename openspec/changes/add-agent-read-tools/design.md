# Design

## Context

A `api` já tem conversas, a interface `LlmProvider` com blocos `tool_use`/`tool_result` e o
`LlmService` que registra cada chamada. O `orders` expõe consulta de pedidos e pagamentos, protegido
por `x-api-key`, com contrato em `contracts/orders.yaml` e simulação de falhas por `x-simulate`.
O desenvolvimento usa o Ollama (`qwen2.5:7b`), que tem tool calling, mas erra mais que modelos
maiores. Motivação em proposal.md; comportamento nas specs.

## Goals / Non-Goals

**Goals:**
- O ciclo do agente em código próprio, curto e explicável, com as regras críticas fora da LLM.
- Integração com o `orders` como se fosse um sistema de terceiro de verdade.
- Ferramentas que já sirvam de modelo para a de escrita (estorno) da change 5.

**Non-Goals:**
- Execução de ferramentas em paralelo (a LLM pode pedir várias; executamos em sequência).
- Guardar os passos intermediários no histórico da conversa.

## Decisions

### 1. `AgentService` com o ciclo; `ConversationsService` delega
`agent.run(history, context)` faz o ciclo e devolve o texto final. O `ConversationsService` continua
cuidando de gravar mensagens. Contexto do ciclo: `conversationId`, `customerId` (do token) e
`correlationId` (o `req.id` do pino, que já é o correlation ID).

```
para passo = 1..AGENT_MAX_STEPS:
  resposta = llm.chat(prompt, mensagens, ferramentas)
  se não pediu ferramentas → devolve o texto
  mensagens += resposta do assistente (com os tool_use)
  para cada tool_use: resultado = executar(ferramenta, parâmetros, contexto)
  mensagens += um bloco tool_result por tool_use
devolve mensagem fixa de limite
```

### 2. Registro de ferramentas com Zod como fonte única
Cada ferramenta declara um schema Zod dos parâmetros. O mesmo schema gera o JSON Schema enviado à LLM
(`z.toJSONSchema`) e valida o que a LLM mandar (`safeParse`). Assim a descrição que a LLM vê e a
validação nunca divergem.
- Alternativa: escrever o JSON Schema à mão e validar com o Ajv. Descartada: duas fontes da verdade.

### 3. Autorização por contexto, não por parâmetro
As ferramentas não têm parâmetro `customerId`: ele chega pelo contexto, vindo do token. `get_order` e
`get_payment` consultam o pedido e comparam `order.customerId` com o do contexto; se diferente,
devolvem `order_not_found` (o mesmo de inexistente) e registram `denied`. `get_payment` consulta o
pedido antes, para conferir o dono.

### 4. Resultados de ferramenta enxutos e legíveis
Cada ferramenta monta o próprio resultado: só os campos úteis, sem CPF, com valores formatados
(`R$ 189,90`) além dos centavos. Modelos pequenos erram conversões; dar o valor pronto reduz isso.

### 5. Cliente do `orders` com tipos gerados do contrato
`openapi-typescript` gera `src/orders-client/orders-api.types.ts` a partir de `contracts/orders.yaml`
(script `npm run generate:orders-types`, que roda a ferramenta pelo `npx`; o arquivo gerado é
versionado). A ferramenta não entra nas dependências: ela exige TypeScript 5 e o projeto usa o 6, e
só precisa rodar quando o contrato muda. Os schemas Zod de validação
usam `satisfies z.ZodType<...>` com os tipos gerados: se o contrato mudar e o Zod não, o TypeScript
não compila.
- Alternativa: gerar um cliente completo (ex.: `openapi-fetch`). Descartada: são 3 chamadas, e um
  cliente próprio deixa o retry e o tempo limite explícitos.

### 6. Retry só onde é seguro
`withRetry` repete apenas GET, só em tempo limite, erro de rede ou 5xx, até 3 tentativas, com espera
de 200 ms e 400 ms. Tempo limite de 3 s por tentativa com `AbortSignal.timeout`. 4xx nunca é repetido.
O estorno (change 5) não usa este retry: é escrita e depende de `Idempotency-Key`.
- Alternativa: biblioteca de resiliência (ex.: `cockatiel`). Descartada: a regra cabe em poucas linhas
  e fica mais fácil de explicar.

### 7. Erros de ferramenta como resultado, nunca como exceção para o cliente
O executor converte qualquer falha em `tool_result` com `isError: true` e uma mensagem curta em
português (ex.: "O sistema de pedidos está indisponível no momento."). Detalhes técnicos só vão para
o log e para `tool_calls`.

### 8. Tabela `tool_calls`
`conversation_id`, `tool_name`, `input` (jsonb), `outcome` (`success`/`error`/`denied`), `error_code`,
`latency_ms`, `created_at`. Junto com `llm_calls`, permite reconstruir cada passo do agente.

### 9. Histórico só com mensagens finais
O ciclo vive em memória durante a requisição. Na próxima pergunta, se precisar, o agente consulta de
novo. Dado sempre atual e histórico simples.
- Alternativa: guardar os blocos de ferramenta em `messages` (`jsonb`). Descartada para a PoC.

### 10. Prompt `assistant-v2`
Orienta: usar as ferramentas sempre que a pergunta envolver pedidos ou pagamentos; usar
`list_my_orders` quando o cliente não informar o pedido; nunca inventar dados; responder com datas no
formato brasileiro; explicar com educação quando uma ferramenta falhar.

### 11. Limite de passos
`AGENT_MAX_STEPS=5`. Mensagem fixa ao atingir o limite, registrada no log como aviso.

## Risks / Trade-offs

- [O Qwen 7B escolhe ou preenche ferramentas errado às vezes] → validação dos parâmetros devolve o
  erro à LLM; avaliação sistemática na change 7; Bedrock/Claude quando a conta for liberada.
- [Retry aumenta a latência no pior caso (3 × 3 s + esperas)] → aceitável para consultas; o tempo
  limite da LLM é separado.
- [Uma pergunta pode gerar até 5 chamadas à LLM] → registrado em `llm_calls` para acompanhar custo.

## Em produção

- Circuit breaker no cliente do `orders`, para parar de chamar um serviço que está fora do ar.
- Cache curto das consultas dentro da mesma conversa.
- Execução de ferramentas independentes em paralelo.
- Rastreamento distribuído (OpenTelemetry) em vez de só o correlation ID.

## Migration Plan

Migration nova (`tool_calls`). A `api` passa a precisar de `ORDERS_BASE_URL` e `ORDERS_API_KEY`;
sem elas, não inicia.
