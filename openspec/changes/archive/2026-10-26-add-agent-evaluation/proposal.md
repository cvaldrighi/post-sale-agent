# Proposal

## Why

Os testes automatizados usam uma LLM roteirizada: provam que o código está certo (autorização,
aprovação, guardrails), mas não dizem nada sobre o comportamento do modelo. As verificações manuais
das changes anteriores mostraram falhas que só aparecem com o modelo de verdade (não buscar a
política, inventar regras, dizer "cartão" num pedido Pix) e que variam de uma rodada para outra. Sem
medir, não há como comparar prompts ou modelos, nem perceber uma regressão.

## What Changes

- Casos de avaliação em `services/api/eval/cases.json`, tirados das verificações manuais: pergunta,
  cliente e verificações esperadas.
- Comando `npm run eval`: conversa com a `api` rodando (Compose + modelo real), roda cada caso
  várias vezes e confere as ferramentas chamadas (em `app.tool_calls`), a resposta e a ação pendente.
- Relatório com a taxa de acerto por caso e no total, com o modelo e a versão do prompt, impresso e
  salvo em JSON para comparar execuções.
- Iterações medidas: o prompt `assistant-v7` ataca os dois casos com 0% (estorno e CPF); a avaliação
  revelou um bug no reaproveitamento de propostas entre conversas e pedidos inventados, corrigidos
  com o `assistant-v8` e um guardrail de pedidos sem origem.

## Capabilities

### New Capabilities
- `agent-evaluation`: casos, verificações e relatório da avaliação do agente com o modelo real.

### Modified Capabilities
- `refund-approval`: o prompt passa a mandar sempre chamar `request_refund`, deixando a decisão para a ferramenta.
- `policy-tools`: o cenário de versão do prompt passa a se referir à versão ativa, não a um número fixo.
- `guardrails`: pedidos citados na resposta precisam ter vindo de uma ferramenta ou da conversa.

## Impact

- `services/api/eval/`: casos (JSON), script de avaliação e relatórios (fora do git).
- `services/api`: prompt `assistant-v7` e descrição da ferramenta `request_refund`.

## Fora do escopo

- LLM como juiz para medir fidelidade aos trechos (em produção).
- Rodar a avaliação no CI: precisa do modelo, é lenta e, no Bedrock, tem custo.
- CI dos testes automatizados (pode entrar como um PR de `chore`, sem mudança de comportamento).
