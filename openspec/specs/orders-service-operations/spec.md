# orders-service-operations Specification

## Purpose
Define como o serviço de pedidos é acessado e operado: autenticação entre serviços, verificação de
saúde, rastreamento de requisições e simulação de falhas para testar a resiliência de quem o consome.

## Requirements

### Requirement: Autenticação por chave de API
Todos os endpoints, exceto `GET /health`, MUST exigir o header `x-api-key` com o valor configurado
no serviço. Sem a chave, ou com uma chave errada, a resposta é 401 com `code` `unauthorized`.

#### Scenario: Sem chave
- **WHEN** uma requisição a `GET /orders/ord_1001` não tem o header `x-api-key`
- **THEN** a resposta é 401 com `code` igual a `unauthorized`

#### Scenario: Chave correta
- **WHEN** a mesma requisição tem a chave configurada
- **THEN** a resposta é 200

### Requirement: Health check
O serviço SHALL responder `GET /health` sem autenticação, com 200 e `{"status": "ok"}` quando
consegue acessar o banco, e 503 quando não consegue.

#### Scenario: Serviço saudável
- **WHEN** o banco está acessível e a requisição chama `GET /health`
- **THEN** a resposta é 200 com `status` igual a `ok`

### Requirement: Correlation ID
O serviço SHALL ler o header `x-correlation-id` de cada requisição, ou gerar um novo quando
ausente, devolvê-lo no mesmo header da resposta e incluí-lo em todas as linhas de log daquela
requisição. Os logs são estruturados em JSON.

#### Scenario: ID recebido
- **WHEN** uma requisição chega com `x-correlation-id: abc-123`
- **THEN** a resposta tem `x-correlation-id: abc-123`
- **AND** o log da requisição contém `"correlationId":"abc-123"`

#### Scenario: ID ausente
- **WHEN** uma requisição chega sem `x-correlation-id`
- **THEN** a resposta tem um `x-correlation-id` gerado pelo serviço

### Requirement: Formato de erro
Todas as respostas de erro SHALL usar o formato problem+json (RFC 9457), com `type`, `title`,
`status`, `detail` e um `code` estável que o consumidor pode usar em código.

#### Scenario: Erro padronizado
- **WHEN** qualquer endpoint responde com erro
- **THEN** o `Content-Type` é `application/problem+json` e o corpo tem `status` e `code`

### Requirement: Simulação de falhas
Quando a simulação estiver habilitada na configuração, o serviço SHALL obedecer ao header
`x-simulate`: com `slow`, responde normalmente depois de um atraso configurável; com `error`,
responde 503 com `code` `simulated_failure`. Com a simulação desabilitada, o header é ignorado.

#### Scenario: Lentidão simulada
- **WHEN** a simulação está habilitada e a requisição tem `x-simulate: slow`
- **THEN** a resposta correta chega depois do atraso configurado

#### Scenario: Erro simulado
- **WHEN** a simulação está habilitada e a requisição tem `x-simulate: error`
- **THEN** a resposta é 503 com `code` igual a `simulated_failure`

#### Scenario: Simulação desabilitada
- **WHEN** a simulação está desabilitada e a requisição tem `x-simulate: error`
- **THEN** a requisição é atendida normalmente
