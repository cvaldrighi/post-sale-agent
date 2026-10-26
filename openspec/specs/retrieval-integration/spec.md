# retrieval-integration Specification

## Purpose
Define como a `api` se integra ao serviço `retrieval` de forma confiável e rastreável, seguindo o
contrato publicado em `contracts/retrieval.json`.

## Requirements

### Requirement: Autenticação e rastreamento
Toda chamada ao `retrieval` SHALL enviar o header `x-api-key` configurado e o `x-correlation-id` da
requisição do cliente que a originou.

#### Scenario: Correlation ID propagado
- **WHEN** a requisição do cliente tem `x-correlation-id: abc-123` e o agente busca nas políticas
- **THEN** a chamada ao `retrieval` tem `x-correlation-id: abc-123` e `x-api-key` configurada

### Requirement: Tempo limite e retry
Cada tentativa de busca MUST ter tempo limite (padrão 5 s). A busca SHALL ser repetida até 3
tentativas no total, com espera de 200 ms e 400 ms, apenas em tempo limite, erro de rede ou resposta
5xx, porque não altera dados. Respostas 4xx MUST NOT ser repetidas.

#### Scenario: Falha temporária
- **WHEN** a primeira tentativa recebe 503 e a segunda recebe 200
- **THEN** a busca é bem-sucedida com o resultado da segunda tentativa

#### Scenario: Chave recusada
- **WHEN** o `retrieval` responde 401
- **THEN** não há nova tentativa e a busca falha como serviço indisponível

### Requirement: Respostas validadas pelo contrato
As respostas do `retrieval` SHALL ser validadas em tempo de execução contra os formatos de
`contracts/retrieval.json`. Uma resposta fora do formato MUST ser tratada como falha do serviço,
nunca repassada à LLM.

#### Scenario: Resposta inesperada
- **WHEN** o `retrieval` responde 200 com um trecho sem o campo `text`
- **THEN** a busca falha como serviço indisponível
