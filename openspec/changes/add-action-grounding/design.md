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

- "aprovar/aprove a solicitação": a frase só faz sentido se a proposta existir.
- verbos no gerúndio ("preparando a solicitação"), acrescentados depois da primeira avaliação.

"Posso preparar", "vou solicitar" e "para solicitar o estorno" não são afirmações e passam.
- Custo aceito: uma explicação sem a ferramenta, como "quando eu preparar, você vai precisar aprovar a
  solicitação", também é trocada. É o erro seguro: o cliente recebe "ainda não consegui preparar",
  em vez de achar que existe algo para aprovar.
- Limitação: frases fora desses padrões passam. O sinal confiável continua sendo o `pendingAction`
  da resposta, que vem do banco e não do texto da LLM.

## Avaliação

Primeira rodada com o guardrail só no passado (qwen2.5:7b, assistant-v8, 3 rodadas, 9 casos): 18/27
(67%). No caso novo `refund-late-order` (1/3), as duas rodadas que falharam responderam "Preparando a
solicitação de estorno… o estorno só acontecerá depois que você aprovar a solicitação" sem chamar a
ferramenta, e passaram pelo guardrail. A limitação prevista aconteceu na primeira medição; os padrões
ganharam o gerúndio e "aprovar a solicitação". O caso continua falhando na avaliação quando o modelo
não chama a ferramenta (a avaliação mede o modelo), mas a resposta enganosa deixa de chegar ao cliente.

## Em produção

- Uma interface mostraria o botão de aprovar só quando houver `pendingAction`, nunca a partir do texto.
- Checagem geral de afirmações da resposta contra o que as ferramentas fizeram (por exemplo, com uma
  segunda LLM como juiz).
