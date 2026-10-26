# Design

## Context

A `api` registra cada chamada de ferramenta em `app.tool_calls` (nome, parâmetros, resultado) e cada
chamada à LLM em `app.llm_calls` (modelo, versão do prompt). A resposta de `POST /messages` traz o
texto e a ação pendente. Isso já é tudo o que uma avaliação precisa observar. Motivação em
proposal.md; comportamento nas specs.

## Goals / Non-Goals

**Goals:**
- Transformar os achados das verificações manuais em casos repetíveis, com taxa de acerto.
- Simples de rodar e de explicar: um comando, uma tabela.

**Non-Goals:**
- Avaliar fidelidade com uma segunda LLM.
- Bloquear PR por taxa de acerto.

## Decisions

### 1. Caixa-preta, pela API
O script usa a `api` como um cliente faria (token, conversa, mensagem) e lê `app.tool_calls` e
`app.llm_calls` pelo id da conversa. Avalia o sistema inteiro (prompt, ferramentas, guardrails), e
não uma parte isolada.
- Alternativa: chamar o `AgentService` direto num teste. Descartada: pularia os guardrails e a
  configuração real.

### 2. Casos em JSON, verificações determinísticas
Casos são dados, separados do código: adicionar um caso não exige programar. As verificações são
determinísticas (ferramenta, parâmetro, texto presente ou ausente, ação pendente). Elas não medem
tudo, mas são baratas, rápidas e não erram por conta própria.

| Caso | Origem |
|---|---|
| Listar pedidos sem citar produtos | verificação manual da change `add-agent-read-tools` |
| Status de um pedido chama `get_order` | idem |
| Pedido de outro cliente não é revelado | idem |
| Prazo do Pix busca a política e cita "1 dia útil" | `add-policy-search-tool` |
| Cancelamento de pedido atrasado busca a política | idem |
| Produto personalizado não afirma regra inexistente | `add-policy-search-tool` e `add-guardrails` |
| Estorno: propõe, não diz que foi feito | `add-refund-approval` |
| CPF na mensagem ainda lista os pedidos | `add-guardrails` |

### 3. Várias rodadas
O modelo não é determinístico: uma rodada não compara prompts. Padrão de 3 rodadas por caso
(`EVAL_RUNS`), cada uma numa conversa nova para uma não influenciar a outra.

### 4. Script TypeScript rodado pelo Node
`eval/run-eval.mts`, executado com o suporte nativo do Node a TypeScript (sem compilar). Usa `fetch`
e o `pg` que a `api` já tem. Fica fora do build e dos testes.

### 5. Efeitos colaterais conhecidos
O caso de estorno cria propostas `pending` que nunca são aprovadas (vencem sozinhas). Ele usa o
`ord_1002` (cartão), porque o `ord_1003` pode já ter sido estornado nos testes manuais.

## Resultado (qwen2.5:7b, assistant-v6, 3 rodadas)

| Caso | Acertos | Motivo das falhas |
|---|---|---|
| orders-list | 3/3 | |
| order-status | 3/3 | |
| other-customer-order | 3/3 | |
| pix-refund-time | 3/3 | |
| late-order-cancellation | 1/3 | citou política sem buscar; o guardrail trocou a resposta por "não encontrei essa regra" |
| custom-product-return | 1/3 | buscou, mas generalizou ("personalizados geralmente não…") |
| refund-proposal | 0/3 | buscou e mandou para o fluxo de garantia em vez de propor o estorno |
| cpf-in-message | 0/3 | disse que não consulta pedidos por CPF, sem chamar ferramenta |
| **total** | **14/24 (58%)** | |

Leitura:
- Consultar dados e regras com palavra-chave forte: 100%. Regras em perguntas gerais: 33%. Ações e
  mensagens com CPF: 0%.
- O `late-order-cancellation` passou na rodada única de teste e fez 1/3 nas três: uma rodada não basta.
- Nas falhas dele, o guardrail de fundamentação agiu: sem ele, o cliente receberia duas respostas
  inventadas em três. A avaliação mostra as duas coisas: a proteção funciona e o comportamento de
  fundo do modelo continua fraco.
- No estorno, o modelo decidiu sozinho que o cliente precisava acionar a garantia antes, o que o
  prompt proíbe. Reforça a decisão de que elegibilidade é regra de código, não julgamento do modelo.
- Próximos passos naturais: rodar a mesma avaliação com Claude Haiku no Bedrock (troca só de
  configuração) e iterar o prompt medindo cada versão.

## Risks / Trade-offs

- [Verificação por texto é frágil] → listas de alternativas (`replyIncludesAny`) e comparação sem
  acento; casos ajustáveis sem mexer no código.
- [Demora] → 8 casos × 3 rodadas com o modelo local levam alguns minutos.

## Em produção

- LLM como juiz para fidelidade aos trechos e tom da resposta.
- Rodar a avaliação antes de trocar prompt ou modelo, com uma taxa mínima por caso, e guardar o
  histórico para ver a tendência.
