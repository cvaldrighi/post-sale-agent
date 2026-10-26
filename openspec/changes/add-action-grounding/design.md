# Design

## Context

Os guardrails de fundamentação já conferem citações de políticas (`search_policies`) e de pedidos
(dados das ferramentas). O agente informa as ferramentas bem-sucedidas de cada mensagem. Motivação
em proposal.md; comportamento nas specs.

## Decisions

### 1. Mesma estrutura dos outros guardrails
Função pura `isUngroundedActionClaim(reply, successfulTools)`, aplicada no `ConversationsService`
depois das outras checagens, com log `ungrounded_action`. A resposta segura diz que a solicitação
ainda não foi preparada e pede para o cliente tentar de novo.

### 2. Detectar afirmação, não menção
Padrões, no texto sem acento e em minúsculas:
- verbo na primeira pessoa do passado + "estorno" até 40 caracteres depois: "preparei a solicitação
  de estorno", "solicitei o estorno", "fiz o estorno", "registrei o pedido de estorno";
- "solicitação/pedido de estorno" + "foi criada/preparada/registrada/enviada/aberta".

"Posso preparar", "vou solicitar" e "para solicitar o estorno" não são afirmações e passam.
- Limitação: frases fora desses padrões passam. O sinal confiável continua sendo o `pendingAction`
  da resposta, que vem do banco e não do texto da LLM.

## Em produção

- Uma interface mostraria o botão de aprovar só quando houver `pendingAction`, nunca a partir do texto.
- Checagem geral de afirmações da resposta contra o que as ferramentas fizeram (por exemplo, com uma
  segunda LLM como juiz).
