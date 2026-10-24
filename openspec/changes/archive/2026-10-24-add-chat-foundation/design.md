# Design

## Context

O `orders` já está pronto, com padrões que esta change reaproveita: NestJS 12 + TypeORM no schema
do serviço, configuração validada, logs JSON com correlation ID e erros em problem+json. O schema
`app` e o usuário `app_service` já existem no Postgres. O Bedrock está suspenso na conta da AWS
(revisão pendente), então o desenvolvimento usa o Ollama no Mac (`qwen2.5:7b`). Motivação em
proposal.md; comportamento nas specs.

## Goals / Non-Goals

**Goals:**
- Um chat funcionando de ponta a ponta: token, conversa, mensagem, resposta da LLM.
- Uma interface de provedor de LLM que já comporte ferramentas (tool calling), para a change 3 só
  plugar as ferramentas, sem mudar a interface.
- Toda chamada à LLM rastreável: o que foi pedido, quanto custou, quanto demorou, se falhou.

**Non-Goals:**
- Ferramentas, loop do agente e aprovação humana (changes 3 a 5).
- Compartilhar código entre `api` e `orders` (ver decisão 1).

## Decisions

### 1. Mesmo stack e padrões do `orders`, com o código comum duplicado
Filtro de erros, configuração do logger e decorator `@Public()` são copiados do `orders`.
- Alternativa: pacote compartilhado com npm workspaces. Descartada agora: exige reorganizar o
  monorepo e o build dos dois serviços. Fica como melhoria se surgir um terceiro serviço Node.

### 2. JWT HS256 com `@nestjs/jwt`, emitido por `POST /auth/token`
`sub` = `customerId`, validade de 1 hora (`JWT_EXPIRES_IN`), segredo em `JWT_SECRET` (mínimo de
32 caracteres). Um guard global exige o Bearer token; rotas `@Public()` ficam de fora.
- Alternativa: header `X-Customer-Id`. Descartada: qualquer um forjaria a identidade, e o JWT é
  o mesmo mecanismo usado com um provedor de identidade real.

### 3. Conversa de outro cliente responde 404, não 403
Responder 403 confirmaria que a conversa existe. Toda consulta filtra por `id` **e** `customer_id`.

### 4. Interface de provedor de LLM (ports and adapters)
```ts
interface LlmProvider {
  readonly name: 'ollama' | 'bedrock';
  chat(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse>;
}
// LlmRequest:  system, messages (role + blocos de conteúdo), tools?, model, maxTokens
// LlmResponse: blocos de conteúdo (texto ou pedido de ferramenta), stopReason, usage, model
```
Os blocos de conteúdo seguem o formato da Converse API (texto, `toolUse`, `toolResult`), que é o
mais geral; o adaptador do Ollama converte para o formato dele. O provedor é escolhido por
`LLM_PROVIDER` e injetado por um token do Nest (`LLM_PROVIDER`).
- Alternativa: chamar o SDK direto no serviço de conversas. Descartada: prende o código a um
  fornecedor, e a suspensão do Bedrock mostrou o valor de trocar por configuração.
- Alternativa: LangChain.js para abstrair provedores. Descartada pelo contexto do projeto: o
  agente fica em código próprio.

### 5. Ollama por HTTP (`fetch` em `/api/chat`), Bedrock pelo AWS SDK v3 (`ConverseCommand`)
O Ollama tem uma API HTTP simples; não precisa de SDK. Para o Bedrock, o SDK resolve assinatura
SigV4 e credenciais pela cadeia padrão da AWS (perfil `AWS_PROFILE` localmente, papel IAM em produção).
Nos testes, o Bedrock é exercitado com o cliente do SDK simulado, já que a conta está suspensa.

### 6. Janela de contexto: últimas 20 mensagens
`LLM_HISTORY_LIMIT=20`. A consulta pega as 20 mais recentes e inverte para ordem cronológica.
- Alternativa: resumir conversas longas com a própria LLM. Descartada para a PoC (custo e
  complexidade); registrada em "Em produção".

### 7. Prompt em arquivo versionado
`src/prompts/assistant-v1.md`, carregado na inicialização. A versão (`assistant-v1`) vai no
registro de cada chamada. Mudar o prompt = criar `assistant-v2`, para comparar resultados.

### 8. Tabela `llm_calls` e linha de log por chamada
Colunas: `conversation_id`, `provider`, `model`, `prompt_version`, `input_tokens`,
`output_tokens`, `latency_ms`, `stop_reason`, `error`, `created_at`. A tabela permite consultas
de custo e latência por SQL; o log permite seguir a requisição pelo correlation ID.

### 9. Ordem de gravação
A mensagem do cliente é gravada antes da chamada à LLM; a do assistente só depois do sucesso.
Se a LLM falhar, fica a mensagem do cliente sem resposta e o erro registrado em `llm_calls`.
- Alternativa: transação englobando a chamada à LLM. Descartada: segura uma conexão do banco
  por até dezenas de segundos.

### 10. Tempo limite com `AbortController`
`LLM_TIMEOUT_MS` (padrão 60000, porque o modelo local é lento). Estouro → erro registrado e
503 `llm_unavailable`.

### 11. Swagger UI em `/docs`
`@nestjs/swagger` gera o OpenAPI a partir dos controllers e DTOs (code-first). Sem frontend, é a
superfície de demonstração.

### 12. Docker
A `api` no Compose acessa o Ollama do Mac por `http://host.docker.internal:11434` (suportado pelo
OrbStack). Para o Bedrock, a pasta `~/.aws` pode ser montada como somente leitura.

## Risks / Trade-offs

- [Código comum duplicado entre `api` e `orders`] → poucos arquivos e estáveis; ver decisão 1.
- [Modelo local lento e fraco] → tempo limite alto; testes E2E usam um provedor falso, sem LLM real.
- [Implementação do Bedrock sem teste real] → testes unitários com o cliente simulado, no formato
  documentado da Converse API; validar de verdade quando a conta for liberada.
- [Mensagem do cliente sem resposta após falha] → aceitável; o cliente pode reenviar.

## Em produção

- Token emitido por um provedor de identidade (Cognito, Auth0, Azure AD) com RS256 e chaves
  públicas (JWKS); a `api` só valida.
- Bedrock com papel IAM do serviço (sem chaves), modelo de fallback e limites por cliente.
- Respostas em streaming (SSE) e resumo automático de conversas longas.
- Métricas de custo e latência em CloudWatch ou Grafana, a partir dos logs e de `llm_calls`.

## Migration Plan

Serviço novo. `docker compose up -d api`; migrations rodam na inicialização.
