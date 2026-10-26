# Proposal

## Why

As defesas principais do agente já estão no código: a identidade vem do token, cada ferramenta
confere o dono do recurso e a única ação de escrita só executa com a aprovação do cliente. Faltam as
camadas em volta da LLM: dados pessoais digitados pelo cliente chegam ao banco, aos logs e ao provedor
da LLM; tentativas óbvias de injeção de prompt chegam ao modelo; e, na verificação manual da change
`add-policy-search-tool`, o modelo citou uma "Política de Devoluções" que não existe, sem ter buscado.

## What Changes

- Mascaramento de CPF e número de cartão (validado por Luhn) na mensagem do cliente, antes de gravar
  e antes de enviar à LLM.
- Bloqueio de padrões conhecidos de injeção de prompt na mensagem do cliente, com resposta fixa e sem
  chamar a LLM.
- Checagem de fundamentação: resposta que cita uma política sem uma busca bem-sucedida na mesma
  mensagem é trocada por uma resposta segura.
- Teste de documento malicioso: mesmo com a LLM obedecendo a uma instrução escondida num trecho de
  política, o código impede o dano.
- Log estruturado para cada guardrail acionado, sem o conteúdo sensível.

## Capabilities

### New Capabilities
- `guardrails`: mascaramento de dados pessoais, bloqueio de injeção de prompt, checagem de
  fundamentação e limites que valem mesmo com a LLM enganada.

### Modified Capabilities
<!-- Nenhuma: os requisitos existentes continuam valendo; os guardrails são acrescentados. -->

## Impact

- `services/api`: módulo `guardrails` (funções puras), `ConversationsService` aplica as checagens,
  `AgentService` passa a informar quais ferramentas tiveram sucesso.

## Fora do escopo

- Classificador de injeção com modelo (em produção: Amazon Bedrock Guardrails ou equivalente).
- Mascarar nome, e-mail, telefone e endereço.
- Checar cada afirmação da resposta; a checagem cobre só a citação de políticas.
