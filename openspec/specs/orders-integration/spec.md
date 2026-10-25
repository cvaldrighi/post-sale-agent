# orders-integration Specification

## Purpose
Define como a `api` se integra ao serviço de pedidos de forma confiável: respeitando o contrato,
tolerando falhas temporárias sem repetir o que não deve, e mantendo cada chamada rastreável.

## Requirements

### Requirement: Autenticação e rastreamento
Toda chamada ao serviço `orders` SHALL enviar o header `x-api-key` configurado e o `x-correlation-id`
da requisição do cliente que a originou.

#### Scenario: Correlation ID propagado
- **WHEN** a requisição do cliente tem `x-correlation-id: abc-123` e o agente consulta um pedido
- **THEN** a chamada ao `orders` tem `x-correlation-id: abc-123`

### Requirement: Tempo limite e retry
Cada tentativa de chamada ao `orders` MUST ter tempo limite (padrão 3 s). Consultas (GET) SHALL ser
repetidas até 3 tentativas no total, com espera crescente (200 ms e 400 ms), apenas quando a falha for
temporária: tempo limite, erro de rede ou resposta 5xx. Respostas 4xx MUST NOT ser repetidas.

#### Scenario: Falha temporária
- **WHEN** a primeira tentativa recebe 503 e a segunda recebe 200
- **THEN** a consulta é bem-sucedida com o resultado da segunda tentativa

#### Scenario: Falhas persistentes
- **WHEN** as 3 tentativas estouram o tempo limite
- **THEN** a consulta falha como serviço indisponível, sem uma quarta tentativa

#### Scenario: Erro do cliente
- **WHEN** o `orders` responde 404
- **THEN** não há nova tentativa e o resultado é "pedido não encontrado"

### Requirement: Respostas validadas pelo contrato
As respostas do `orders` SHALL ser validadas em tempo de execução contra os formatos definidos em
`contracts/orders.yaml`. Uma resposta fora do formato MUST ser tratada como falha do serviço, nunca
repassada à LLM.

#### Scenario: Resposta inesperada
- **WHEN** o `orders` responde 200 com um pedido sem o campo `status`
- **THEN** a consulta falha como resposta inválida e o erro é registrado no log
