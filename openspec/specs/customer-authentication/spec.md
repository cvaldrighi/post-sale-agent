# customer-authentication Specification

## Purpose
Identifica o cliente que está usando o assistente, para que cada requisição seja atendida em nome
dele e só acesse os dados dele. Na PoC, o token é emitido a partir do identificador do cliente.

## Requirements

### Requirement: Emitir token de acesso
A `api` SHALL responder `POST /auth/token` com `customerId` no corpo devolvendo 201 com
`accessToken` (JWT assinado), `tokenType` igual a `Bearer` e `expiresIn` em segundos. O
`customerId` MUST seguir o formato `cust_` seguido de dígitos; caso contrário a resposta é 400
com `code` `validation_error`.

#### Scenario: Token emitido
- **WHEN** a requisição envia `{"customerId": "cust_001"}`
- **THEN** a resposta é 201 com `tokenType` `Bearer`, `expiresIn` maior que zero e um `accessToken`
- **AND** o token identifica o cliente `cust_001`

#### Scenario: Identificador inválido
- **WHEN** a requisição envia `{"customerId": "admin"}`
- **THEN** a resposta é 400 com `code` igual a `validation_error`

### Requirement: Exigir token nas rotas de conversa
Todas as rotas de conversa MUST exigir o header `Authorization: Bearer <token>` com um token
válido e não expirado. Sem token, com token inválido ou expirado, a resposta é 401 com `code`
`unauthorized`. A identidade do cliente vem sempre do token, nunca do corpo da requisição.

#### Scenario: Sem token
- **WHEN** uma requisição para criar conversa não tem o header `Authorization`
- **THEN** a resposta é 401 com `code` igual a `unauthorized`

#### Scenario: Token adulterado
- **WHEN** a requisição usa um token com a assinatura alterada
- **THEN** a resposta é 401 com `code` igual a `unauthorized`

#### Scenario: Token expirado
- **WHEN** a requisição usa um token cuja validade já passou
- **THEN** a resposta é 401 com `code` igual a `unauthorized`
