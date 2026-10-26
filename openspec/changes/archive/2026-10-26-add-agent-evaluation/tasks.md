# Tasks

## 1. Casos e script

- [x] 1.1 Escrever `eval/cases.json` com os 8 casos do design
- [x] 1.2 Implementar `eval/run-eval.mts` (token, conversa nova por rodada, mensagem, leitura de `app.tool_calls` e `app.llm_calls`, verificações sem acento) e o script `npm run eval`; verificar rodando com `EVAL_RUNS=1`
- [x] 1.3 Imprimir a tabela e salvar o JSON em `eval/results/` (no `.gitignore`); verificar o arquivo gerado

## 2. Documentação

- [x] 2.1 Atualizar `services/api/README.md` (como rodar e ler a avaliação)

## 3. Verificação manual

- [x] 3.1 Rodar `npm run eval` com 3 rodadas e registrar no design a taxa de acerto por caso

## 4. Iteração medida

- [x] 4.1 Criar o prompt `assistant-v7` (sempre chamar `request_refund`, a ferramenta decide; CPF é ignorado; exemplos) e ajustar a descrição da ferramenta; verificar com os testes
- [x] 4.2 Rodar `npm run eval` com 3 rodadas e registrar no design a comparação v6 × v7
- [x] 4.3 Corrigir o reaproveitamento de proposta entre conversas (achado da avaliação); verificar com testes E2E
- [x] 4.4 Criar o prompt `assistant-v8` (v7 sem o exemplo de CPF, que levou o modelo a inventar pedidos)
- [x] 4.5 Criar o guardrail de pedidos sem origem (`ungrounded_order`); verificar com testes unitários e E2E
- [x] 4.6 Rodar `npm run eval` e registrar no design a comparação v6 × v7 × v8

## Workflow follow-up

- Abrir o PR de `feat/add-agent-evaluation` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-agent-evaluation`.
