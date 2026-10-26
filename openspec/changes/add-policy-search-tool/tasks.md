# Tasks

## 1. Cliente do retrieval

- [x] 1.1 Mover o `withRetry` para `src/common/retry.ts` (comentário: só operações sem efeito colateral); verificar que os testes do `OrdersClient` e do retry continuam passando
- [x] 1.2 Criar o script `generate:retrieval-types` e gerar os tipos a partir de `contracts/retrieval.json`; verificar que o arquivo gerado compila
- [x] 1.3 Adicionar `RETRIEVAL_BASE_URL`, `RETRIEVAL_API_KEY` e `RETRIEVAL_TIMEOUT_MS` à configuração validada; verificar com testes unitários
- [x] 1.4 Implementar o `RetrievalClient` (x-api-key, x-correlation-id, tempo limite, retry, validação Zod com `satisfies`); verificar com testes unitários com `fetch` simulado (sucesso, 503 depois 200, 401 sem retry, resposta fora do contrato)

## 2. Ferramenta

- [x] 2.1 Implementar `search_policies` (resultado enxuto, lista vazia com mensagem, `policies_unavailable`) e registrá-la no `AgentModule`; verificar com testes unitários

## 3. Prompt e conversas

- [x] 3.1 Criar o prompt `assistant-v4` e torná-lo o ativo; verificar com o teste de versão registrada
- [x] 3.3 Criar o prompt `assistant-v5` (buscar antes de responder sobre qualquer regra; pergunta geral responde com a regra) a partir do teste manual; verificar repetindo a verificação manual
- [x] 3.2 Criar o servidor falso do `retrieval` e os testes E2E (busca com resultado, `retrieval` fora do ar, correlation ID propagado)

## 4. Docker e documentação

- [x] 4.1 Adicionar `RETRIEVAL_BASE_URL` e `RETRIEVAL_API_KEY` à `api` no Compose, com dependência do `retrieval`; verificar que `docker compose up -d --build api` fica healthy
- [x] 4.2 Atualizar `services/api/README.md` (ferramenta e integração) e o diagrama do README principal, se preciso; verificar os exemplos

## 5. Verificação manual

- [x] 5.1 Com o Compose e o Ollama rodando, como `cust_001`: perguntar "Em quanto tempo o dinheiro volta no Pix?", "Posso cancelar um pedido atrasado?" e "Vocês aceitam devolução de produto personalizado?" (sem política); conferir as respostas, a política citada e os registros em `app.tool_calls`

## Workflow follow-up

- Abrir o PR de `feat/add-policy-search-tool` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-policy-search-tool`.
