# Spec Delta

## Purpose

Medir o comportamento do agente com o modelo real, de forma repetível, para comparar prompts e
modelos e perceber regressões.

## ADDED Requirements

### Requirement: Casos de avaliação
Os casos SHALL ficar em `services/api/eval/cases.json`. Cada caso tem `id`, `customerId`, `message`
e verificações: ferramentas que precisam ter sido chamadas com sucesso (`toolsCalled`), parâmetros
esperados (`toolInput`), textos que a resposta precisa conter (`replyIncludesAny`) ou não pode conter
(`replyExcludes`) e se deve existir uma ação pendente (`pendingAction`).

#### Scenario: Caso com ferramenta e texto proibido
- **WHEN** o caso de estorno exige `request_refund` e proíbe "estorno foi feito" na resposta
- **THEN** uma rodada passa só se `request_refund` teve sucesso e a resposta não contém o texto

### Requirement: Rodadas repetidas
O comando `npm run eval` SHALL rodar cada caso `EVAL_RUNS` vezes (padrão 3), cada rodada numa
conversa nova, contra a `api` em `EVAL_API_URL` (padrão `http://localhost:3000`). Comparações de
texto MUST ignorar maiúsculas e acentos.

#### Scenario: Taxa de acerto por caso
- **WHEN** um caso passa em 2 de 3 rodadas
- **THEN** o relatório mostra 2/3 para esse caso e lista o motivo da falha da rodada que falhou

### Requirement: Relatório
Ao final, o comando SHALL imprimir uma tabela com a taxa de acerto por caso e no total, o modelo e a
versão do prompt (lidos de `app.llm_calls`), e salvar o resultado completo em
`services/api/eval/results/<data>-<versão do prompt>.json`, fora do git.

#### Scenario: Comparar execuções
- **WHEN** a avaliação roda com o prompt `assistant-v6`
- **THEN** existe um arquivo de resultado com `promptVersion` igual a `assistant-v6`, o modelo e o resultado de cada rodada
