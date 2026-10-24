# Tasks

## 1. Estrutura do serviço

- [ ] 1.1 Criar o projeto NestJS em `services/api` (CommonJS, Jest, `--strict`), instalar as dependências e verificar que `npm run build` e `npm run lint` passam
- [ ] 1.2 Adicionar a configuração validada (banco, `JWT_SECRET`, `JWT_EXPIRES_IN`, `LLM_*`, `OLLAMA_BASE_URL`, `AWS_REGION`) e verificar com testes unitários que o serviço recusa iniciar sem `JWT_SECRET` ou com `LLM_PROVIDER` inválido
- [ ] 1.3 Copiar do `orders` o filtro problem+json, a configuração de logs e o `@Public()`, configurar o TypeORM no schema `app` e o `GET /health`; verificar com testes unitários do filtro e E2E do health e do correlation ID

## 2. Banco de dados

- [ ] 2.1 Criar entidades e migration de `conversations`, `messages` e `llm_calls` (com índices por conversa e data); verificar com `npm run migration:run` e `\dt app.*`

## 3. Autenticação

- [ ] 3.1 Implementar `POST /auth/token` e verificar com testes E2E (token emitido, `customerId` inválido)
- [ ] 3.2 Implementar o guard global de JWT e verificar com testes E2E (sem token, token adulterado, token expirado)

## 4. Provedores de LLM

- [ ] 4.1 Definir os tipos `LlmRequest`, `LlmResponse` e a interface `LlmProvider`, e a escolha do provedor por `LLM_PROVIDER`; verificar com teste unitário da escolha
- [ ] 4.2 Implementar o `OllamaProvider` (`/api/chat`, conversão dos blocos de conteúdo, tempo limite) e verificar com testes unitários usando `fetch` simulado
- [ ] 4.3 Implementar o `BedrockProvider` (`ConverseCommand`, conversão de blocos e de `usage`/`stopReason`) e verificar com testes unitários usando o cliente do SDK simulado

## 5. Conversas

- [ ] 5.1 Criar o prompt `src/prompts/assistant-v1.md` e o carregamento com a versão; verificar com teste unitário
- [ ] 5.2 Implementar `POST /conversations` e `GET /conversations/{id}` com isolamento por cliente; verificar com testes E2E (criar, consultar, conversa de outro cliente, inexistente)
- [ ] 5.3 Implementar `POST /conversations/{id}/messages` (grava mensagem, janela de 20, chama a LLM, grava resposta, registra em `llm_calls` e no log); verificar com testes E2E usando um provedor falso (resposta gerada, mensagem vazia, janela em conversa com 30 mensagens, falha da LLM com 503)

## 6. Docker e documentação

- [ ] 6.1 Configurar o Swagger UI em `/docs` com autenticação Bearer e verificar abrindo no navegador
- [ ] 6.2 Criar o `Dockerfile`, adicionar o serviço `api` ao Compose (Ollama via `host.docker.internal`) e `JWT_SECRET` vazio ao `.env.example`; verificar que `docker compose up -d api` fica healthy
- [ ] 6.3 Documentar em `services/api/README.md` e atualizar o README principal; verificar que os comandos documentados funcionam

## 7. Verificação manual

- [ ] 7.1 Com o Compose e o Ollama rodando: obter um token para `cust_001`, criar uma conversa, enviar "Olá, o que você pode fazer por mim?", receber a resposta e conferir o registro em `app.llm_calls`

## Workflow follow-up

- Abrir o PR de `feat/add-chat-foundation` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-chat-foundation`.
