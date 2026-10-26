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

## Risks / Trade-offs

- [Verificação por texto é frágil] → listas de alternativas (`replyIncludesAny`) e comparação sem
  acento; casos ajustáveis sem mexer no código.
- [Demora] → 8 casos × 3 rodadas com o modelo local levam alguns minutos.

## Em produção

- LLM como juiz para fidelidade aos trechos e tom da resposta.
- Rodar a avaliação antes de trocar prompt ou modelo, com uma taxa mínima por caso, e guardar o
  histórico para ver a tendência.
