# Design

## Context

Já existem no código: identidade do cliente só pelo token, autorização em cada ferramenta, ação de
escrita que só propõe (execução por endpoint que a LLM não alcança), redação de segredos nos logs e o
prompt dizendo que trechos de documentos são referência, nunca instrução. Motivação em proposal.md;
comportamento nas specs.

## Goals / Non-Goals

**Goals:**
- Defesa em camadas, com as regras críticas no código e não no modelo.
- Guardrails simples, determinísticos e testáveis (funções puras + testes E2E).

**Non-Goals:**
- Detectar toda injeção de prompt: uma lista de padrões é fácil de contornar. Ela barra o óbvio;
  quem limita o dano são as camadas estruturais.

## Decisions

### 1. Camadas, da mais forte para a mais fraca
| Camada | Onde | Depende do modelo? |
|---|---|---|
| Identidade só pelo token; autorização em cada ferramenta | changes anteriores | não |
| Escrita só com aprovação do cliente, por endpoint fora do alcance da LLM | change 5 | não |
| Validações das ferramentas (valor estornável, pagamento) | change 5 | não |
| Mascaramento de dados pessoais na entrada | esta change | não |
| Checagem de fundamentação da resposta | esta change | não |
| Bloqueio de padrões de injeção na entrada | esta change | não, mas é contornável |
| Prompt: trechos são referência, nunca instrução | change 4b | sim |

A ordem é o argumento: se o modelo for enganado, as três primeiras camadas ainda seguram.

### 2. Funções puras em `src/guardrails/`
`maskPii(text)`, `detectPromptInjection(text)` e `isUngroundedPolicyAnswer(reply, toolsUsed)` não
dependem do Nest nem de banco: testes unitários diretos e fáceis de explicar. O `ConversationsService`
as aplica na ordem: mascarar → detectar injeção → agente → checar fundamentação.

### 3. Mascaramento antes de gravar
O texto mascarado é o que vai para `app.messages`, para a LLM (e o Bedrock) e para os logs. O
original não é guardado: não há caso de uso para ele, e dado que não existe não vaza.
- Cartão só é mascarado se passar no Luhn, para não apagar telefones ou outros números longos.
- CPF: formato `000.000.000-00` ou 11 dígitos seguidos. Sem validar dígitos verificadores: na dúvida,
  mascarar é o erro mais barato.

### 4. Injeção: bloquear com resposta fixa
Padrões em português e inglês (expressões regulares, sem acento e sem diferenciar maiúsculas). Ao
detectar, a `api` grava a mensagem e uma resposta fixa, sem chamar a LLM.
- Alternativa: só registrar e deixar seguir. Descartada para os padrões óbvios: não há pergunta
  legítima de pós-venda que peça para ignorar instruções.

### 5. Fundamentação: o agente informa as ferramentas bem-sucedidas
`AgentService.run` passa a devolver `{ reply, successfulTools }`. A checagem considera que a resposta
cita uma política quando tem a palavra "política" (com ou sem acento). Se citar e `search_policies`
não estiver em `successfulTools`, a resposta é trocada.
- Limitação: uma resposta que inventa uma regra sem a palavra "política" passa. A avaliação
  (change 7) mede esses casos.

### 6. Teste de documento malicioso
Com o `retrieval` simulado devolvendo um trecho com instrução escondida e a LLM roteirizada
obedecendo, o teste verifica o que o código garante: a ferramenta recusa o valor, nenhuma ação é
criada e nenhum estorno chega ao `orders`. Não testamos se o modelo resiste: isso não é garantia.

## Risks / Trade-offs

- [Falso positivo no bloqueio de injeção] → padrões específicos ("ignore as instruções anteriores",
  não "instruções"); teste com uma pergunta comum que usa a palavra.
- [Falso negativo] → esperado; as camadas estruturais limitam o dano.

## Em produção

- Classificador de injeção e de conteúdo (Amazon Bedrock Guardrails ou um modelo dedicado), também
  na saída.
- Detecção de PII mais ampla (nome, e-mail, endereço), por exemplo com Amazon Comprehend.
- Métricas e alertas sobre os eventos de guardrail.
