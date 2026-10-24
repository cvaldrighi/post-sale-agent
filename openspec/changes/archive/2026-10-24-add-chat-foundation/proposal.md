# Proposal

## Why

O cliente ainda não tem por onde conversar com o assistente. Esta change cria a `api`, a porta de
entrada pública do sistema, com autenticação, conversas persistidas e a integração com a LLM atrás
de uma interface de provedor. É a base sobre a qual as próximas changes adicionam as ferramentas do
agente. A conta da AWS está com o Bedrock suspenso para revisão, então o Ollama local é o provedor
padrão e o Bedrock fica pronto para ser ligado por configuração.

## What Changes

- Novo serviço `services/api` (Node.js), com Swagger UI como superfície de demonstração.
- Emissão de token JWT para um cliente (login simplificado da PoC) e exigência do token nas rotas de conversa.
- Criar conversa, consultar conversa e enviar mensagem; cada cliente só acessa as próprias conversas.
- Resposta do assistente gerada pela LLM com um prompt de sistema versionado e as últimas 20 mensagens da conversa.
- Interface de provedor de LLM com duas implementações: Ollama (padrão) e Amazon Bedrock (Converse API).
- Registro de cada chamada à LLM (modelo, tokens, latência, versão do prompt, erro).
- Health check, correlation ID e erros em problem+json, como no `orders`.

## Capabilities

### New Capabilities
- `customer-authentication`: emissão e validação do token de acesso do cliente.
- `conversations`: criação, consulta e troca de mensagens nas conversas do cliente.
- `llm-integration`: escolha do provedor de LLM, prompt versionado, tempo limite e registro das chamadas.
- `api-service-operations`: health check, correlation ID e formato de erro da `api`.

### Modified Capabilities
<!-- Nenhuma. -->

## Impact

- Novo diretório `services/api` e tabelas no schema `app` (usuário `app_service`).
- `docker-compose.yml` ganha o serviço `api`; `.env.example` ganha `JWT_SECRET`.
- Novas dependências: `@nestjs/jwt`, `@nestjs/swagger`, `@aws-sdk/client-bedrock-runtime`.

## Fora do escopo

- Ferramentas do agente (consulta de pedidos, políticas, estorno): changes 3 a 5.
- Senha, cadastro ou provedor de identidade real: o token é emitido só com o `customerId`.
- Streaming da resposta, resumo de conversas longas e limite de uso por cliente.
- Mascaramento de dados pessoais e defesas contra injeção de prompt: change 6.
