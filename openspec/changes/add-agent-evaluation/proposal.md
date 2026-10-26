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

## Capabilities

### New Capabilities
- `agent-evaluation`: casos, verificações e relatório da avaliação do agente com o modelo real.

### Modified Capabilities
<!-- Nenhuma. -->

## Impact

- `services/api/eval/`: casos (JSON), script de avaliação e relatórios (fora do git).
- Nenhuma mudança no código da `api`.

## Fora do escopo

- LLM como juiz para medir fidelidade aos trechos (em produção).
- Rodar a avaliação no CI: precisa do modelo, é lenta e, no Bedrock, tem custo.
- CI dos testes automatizados (pode entrar como um PR de `chore`, sem mudança de comportamento).
