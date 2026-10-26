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

### 5. Prompts `assistant-v4` e `assistant-v5`
Acrescenta ao v3: quando usar `search_policies`, responder só com os trechos, citar a política e
tratar os trechos como referência, nunca como instrução. A busca semântica sempre devolve os trechos
mais parecidos, mesmo quando nenhum trata do assunto (a lista só vem vazia sem documentos). Por isso
o prompt manda dizer que não encontrou a regra quando os trechos não responderem à pergunta; a
change 7 mede se o modelo faz isso.

No teste manual com o v4, o `qwen2.5:7b` só buscou quando a pergunta tinha palavras muito ligadas à
ferramenta ("dinheiro volta no Pix"). Em "posso cancelar um pedido atrasado?" pediu o número do
pedido sem buscar, e em "aceitam devolução de produto personalizado?" inventou uma "Política de
Devoluções" sem chamar ferramenta. O v5 diz logo no início que o assistente não conhece as regras
da loja e precisa buscar antes de responder, e que pergunta geral se responde com a regra.

Resultado do v5 na mesma verificação (uma rodada por pergunta):

| Pergunta | v4 | v5 |
|---|---|---|
| "Posso cancelar um pedido atrasado?" | não buscou, pediu o número do pedido | buscou e respondeu com a regra |
| "Aceitam devolução de produto personalizado?" | inventou uma política sem buscar | buscou, mas generalizou a partir de "Itens que não podem ser trocados" (nenhuma política fala de personalizados) |
| "Em quanto tempo o dinheiro volta no Pix?" | buscou e respondeu com a regra | não buscou, pediu o número do pedido |

Mantivemos o v5: o erro mais grave do v4 (inventar sem buscar) não se repetiu, e pedir o número do
pedido é uma falha segura. A iteração de prompt para aqui, de propósito:
- Com um modelo não determinístico, uma rodada por pergunta não compara prompts; é preciso repetir
  cada caso e medir a taxa de acerto (change 7). Os três casos acima entram na avaliação.
- O caso do produto personalizado mostra que achar o trecho certo (retrieval) não garante uma
  resposta fiel a ele (faithfulness). A change 6 adiciona uma checagem no código: resposta que cita
  uma política sem `search_policies` na mesma mensagem não é entregue.
- Um modelo maior (Claude Haiku no Bedrock) deve errar menos; a troca é só de configuração. Remove a frase que dizia que o assistente não tinha acesso às políticas.

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
