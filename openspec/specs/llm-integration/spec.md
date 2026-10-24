# llm-integration Specification

## Purpose
Define como a `api` usa modelos de linguagem: qual provedor atende, com qual prompt, em quanto
tempo, e como cada chamada fica registrada para acompanhar custo, desempenho e erros.

## Requirements

### Requirement: Provedor configurável
A `api` SHALL usar o provedor de LLM indicado na configuração (`ollama` ou `bedrock`), com o modelo
também configurável, sem mudança de código. Um provedor desconhecido MUST impedir o serviço de iniciar.

#### Scenario: Ollama
- **WHEN** a configuração indica o provedor `ollama`
- **THEN** as respostas do assistente são geradas pelo modelo configurado no Ollama

#### Scenario: Bedrock
- **WHEN** a configuração indica o provedor `bedrock`
- **THEN** as respostas são geradas pela Converse API do Bedrock com o modelo configurado

#### Scenario: Provedor inválido
- **WHEN** a configuração indica um provedor que não existe
- **THEN** o serviço não inicia e informa a variável inválida

### Requirement: Prompt de sistema versionado
O prompt de sistema SHALL ficar num arquivo próprio, separado do código, com um identificador de
versão. Toda chamada à LLM registra a versão do prompt usada.

#### Scenario: Versão registrada
- **WHEN** uma resposta é gerada com o prompt `assistant-v1`
- **THEN** o registro da chamada contém a versão `assistant-v1`

### Requirement: Tempo limite
Toda chamada à LLM SHALL ter um tempo limite configurável; ao estourar, a chamada é cancelada e
tratada como falha.

#### Scenario: Tempo estourado
- **WHEN** o provedor demora mais que o tempo limite
- **THEN** a chamada é cancelada e registrada com erro de tempo limite

### Requirement: Registro das chamadas
Cada chamada à LLM, com sucesso ou com erro, SHALL ser registrada com conversa, provedor, modelo,
versão do prompt, tokens de entrada e de saída, latência em milissegundos, motivo de parada e erro,
e também gerar uma linha de log com o correlation ID da requisição.

#### Scenario: Chamada bem-sucedida
- **WHEN** uma resposta é gerada
- **THEN** existe um registro com os tokens, a latência e o motivo de parada

#### Scenario: Chamada com erro
- **WHEN** o provedor falha
- **THEN** existe um registro com o erro e a latência até a falha
