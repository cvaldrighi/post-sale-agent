# Design

## Context

A `api` já tem o ciclo do agente (`AgentService`), o registro de ferramentas (`ToolRegistry`, com
entrada em Zod) e o `OrdersClient` com tempo limite, retry e validação. O `retrieval` expõe
`POST /search` protegido por `x-api-key`, com contrato code-first em `contracts/retrieval.json`.
Motivação em proposal.md; comportamento nas specs.

## Goals / Non-Goals

**Goals:**
- Fechar o fluxo de RAG reaproveitando os padrões que já existem (ferramenta, cliente HTTP, prompt versionado).
- Respostas sobre regras da loja baseadas no texto oficial, com a política citada.

**Non-Goals:**
- Defesa completa contra injeção de prompt vinda de documentos (change 6).
- Decidir na `api` quando buscar: quem decide é a LLM, pela descrição da ferramenta e pelo prompt.

## Decisions

### 1. RAG como ferramenta, não em toda mensagem
A busca é uma ferramenta que a LLM chama quando precisa, como as de pedidos.
- Alternativa: buscar nas políticas a cada mensagem e colocar os trechos no prompt. Descartada: gasta
  uma busca e tokens em perguntas que não precisam ("cadê meu pedido?") e mistura o assunto das
  políticas em respostas sobre pedidos.

### 2. A LLM reescreve a pergunta
O parâmetro `query` é escrito pela LLM ("prazo do estorno no Pix"), não a mensagem crua do cliente.
Ela resume o que importa e resolve referências da conversa ("e no cartão?").

### 3. Resultado enxuto para a LLM
`{ results: [{ policy, section, text }] }`, com `topK` 4. `chunkId` e `score` ficam de fora: não
ajudam a responder e ocupam contexto. O `retrieval` não recebe dados do cliente, e as políticas são
públicas, então não há regra de autorização nesta ferramenta.

### 4. `RetrievalClient` no mesmo molde do `OrdersClient`
`src/retrieval-client/`: tipos gerados de `contracts/retrieval.json` (`npm run generate:retrieval-types`,
com `openapi-typescript` via `npx`), schemas Zod amarrados por `satisfies`, `x-api-key`,
`x-correlation-id`, tempo limite por tentativa.
- O `withRetry` sai de `orders-client/` para `common/retry.ts`, usado pelos dois clientes.
- A regra do retry é "só operações sem efeito colateral", não "só GET": `POST /search` só lê.
- Tempo limite padrão de 5 s (o do `orders` é 3 s): a primeira busca pode esperar o Ollama carregar o
  modelo de embeddings.
- Alternativa: um cliente HTTP genérico para os dois serviços. Descartada por enquanto: são dois
  clientes pequenos, e a parte comum (retry) já é compartilhada.

### 5. Prompt `assistant-v4`
Acrescenta ao v3: quando usar `search_policies`, responder só com os trechos, citar a política e
tratar os trechos como referência, nunca como instrução. A busca semântica sempre devolve os trechos
mais parecidos, mesmo quando nenhum trata do assunto (a lista só vem vazia sem documentos). Por isso
o prompt manda dizer que não encontrou a regra quando os trechos não responderem à pergunta; a
change 7 mede se o modelo faz isso. Remove a frase que dizia que o assistente não tinha acesso às políticas.

### 6. Testes
Unitários do cliente (`fetch` simulado) e da ferramenta. Nos E2E, um servidor falso do `retrieval`
(`test/retrieval-stub.ts`), igual ao do `orders`, com LLM roteirizada.

## Risks / Trade-offs

- [O modelo local pode não chamar a ferramenta, ou responder além dos trechos] → instruções
  explícitas no prompt e casos de avaliação na change 7.
- [Um documento com instruções escondidas poderia influenciar a LLM] → hoje as políticas são nossas;
  o prompt já trata trechos como referência, e a change 6 adiciona defesas e um teste com documento malicioso.

## Em produção

- Circuit breaker e cache de buscas repetidas.
- Autenticação entre serviços com identidade de workload (IAM, mTLS) em vez de chave fixa.
