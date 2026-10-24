# api-service-operations Specification

## Purpose
Define a operação da `api`: verificação de saúde, rastreamento de requisições e um formato único de
erro, iguais aos do serviço de pedidos, para que os serviços se comportem de forma consistente.

## Requirements

### Requirement: Health check
A `api` SHALL responder `GET /health` sem autenticação, com 200 e `{"status": "ok"}` quando acessa
o banco, e 503 quando não acessa.

#### Scenario: Serviço saudável
- **WHEN** o banco está acessível e a requisição chama `GET /health`
- **THEN** a resposta é 200 com `status` igual a `ok`

### Requirement: Correlation ID
A `api` SHALL ler o header `x-correlation-id` (ou gerar um quando ausente ou inválido), devolvê-lo
na resposta e incluí-lo em todas as linhas de log da requisição, em JSON.

#### Scenario: ID recebido
- **WHEN** uma requisição chega com `x-correlation-id: abc-123`
- **THEN** a resposta tem `x-correlation-id: abc-123`

### Requirement: Formato de erro
Todas as respostas de erro da `api` SHALL usar problem+json (RFC 9457) com `type`, `title`,
`status` e um `code` estável, sem expor detalhes internos.

#### Scenario: Erro padronizado
- **WHEN** qualquer rota responde com erro
- **THEN** o `Content-Type` é `application/problem+json` e o corpo tem `status` e `code`

### Requirement: Documentação interativa
A `api` SHALL publicar a documentação OpenAPI das suas rotas, com uma interface navegável em `/docs`
que permite autenticar com o token e testar as rotas.

#### Scenario: Swagger UI
- **WHEN** alguém abre `/docs` no navegador
- **THEN** vê todas as rotas da `api` e consegue executá-las informando o token
