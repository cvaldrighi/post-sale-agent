# Tasks

## 1. Casos e script

- [ ] 1.1 Escrever `eval/cases.json` com os 8 casos do design
- [ ] 1.2 Implementar `eval/run-eval.mts` (token, conversa nova por rodada, mensagem, leitura de `app.tool_calls` e `app.llm_calls`, verificações sem acento) e o script `npm run eval`; verificar rodando com `EVAL_RUNS=1`
- [ ] 1.3 Imprimir a tabela e salvar o JSON em `eval/results/` (no `.gitignore`); verificar o arquivo gerado

## 2. Documentação

- [ ] 2.1 Atualizar `services/api/README.md` (como rodar e ler a avaliação)

## 3. Verificação manual

- [ ] 3.1 Rodar `npm run eval` com 3 rodadas e registrar no design a taxa de acerto por caso

## Workflow follow-up

- Abrir o PR de `feat/add-agent-evaluation` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-agent-evaluation`.
