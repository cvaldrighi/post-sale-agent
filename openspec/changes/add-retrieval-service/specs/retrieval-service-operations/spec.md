# Spec Delta

## Purpose

Define como o serviço de busca nas políticas é acessado e operado, com o mesmo padrão de segurança,
rastreamento, erros e contrato dos demais serviços do sistema.

## ADDED Requirements

### Requirement: Autenticação por chave de API
Todos os endpoints, exceto `GET /health`, MUST exigir o header `x-api-key` com o valor configurado.
Sem a chave, ou com uma chave errada, a resposta é 401 com `code` `unauthorized`.

#### Scenario: Ingestão sem chave
- **WHEN** uma requisição a `POST /documents` não tem `x-api-key`
- **THEN** a resposta é 401 e nada é gravado

### Requirement: Health check
O serviço SHALL responder `GET /health` sem autenticação, com 200 e `{"status": "ok"}` quando acessa o
banco, e 503 quando não acessa.

#### Scenario: Serviço saudável
- **WHEN** o banco está acessível
- **THEN** `GET /health` responde 200 com `status` igual a `ok`

### Requirement: Correlation ID e logs
O serviço SHALL ler o header `x-correlation-id` (ou gerar um quando ausente ou inválido), devolvê-lo
na resposta e incluí-lo em todas as linhas de log da requisição, em JSON.

#### Scenario: ID recebido
- **WHEN** uma requisição chega com `x-correlation-id: abc-123`
- **THEN** a resposta tem `x-correlation-id: abc-123`

### Requirement: Formato de erro
Todas as respostas de erro SHALL usar problem+json (RFC 9457) com `type`, `title`, `status` e um `code`
estável, sem expor detalhes internos.

#### Scenario: Erro padronizado
- **WHEN** qualquer endpoint responde com erro
- **THEN** o `Content-Type` é `application/problem+json` e o corpo tem `status` e `code`

### Requirement: Contrato versionado
O contrato OpenAPI do serviço SHALL ser gerado a partir do código e versionado em
`contracts/retrieval.json`. Um teste automatizado MUST falhar se o arquivo versionado estiver
diferente do gerado.

#### Scenario: Contrato desatualizado
- **WHEN** um endpoint muda e o arquivo não é regenerado
- **THEN** o teste do contrato falha indicando que o arquivo precisa ser atualizado
