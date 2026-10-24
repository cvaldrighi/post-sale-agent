# conversations Specification

## Purpose
Permite que o cliente converse com o assistente: abrir uma conversa, enviar mensagens, receber as
respostas e consultar o histórico, sempre restrito às conversas do próprio cliente.

## Requirements

### Requirement: Criar conversa
A `api` SHALL responder `POST /conversations` com 201 e a conversa criada (`id` e `createdAt`),
pertencente ao cliente do token.

#### Scenario: Conversa criada
- **WHEN** o cliente `cust_001` autenticado cria uma conversa
- **THEN** a resposta é 201 com o `id` da nova conversa

### Requirement: Enviar mensagem e receber a resposta
A `api` SHALL aceitar `POST /conversations/{id}/messages` com `content` (texto de 1 a 4000
caracteres), guardar a mensagem do cliente, gerar a resposta do assistente pela LLM, guardá-la e
responder 201 com a mensagem do assistente (`id`, `role` igual a `assistant`, `content`, `createdAt`).

#### Scenario: Resposta gerada
- **WHEN** o cliente envia "Olá, preciso de ajuda" numa conversa sua
- **THEN** a resposta é 201 com `role` `assistant` e o texto gerado pela LLM
- **AND** a conversa passa a ter as duas mensagens, na ordem

#### Scenario: Mensagem vazia
- **WHEN** o cliente envia `content` vazio
- **THEN** a resposta é 400 com `code` igual a `validation_error` e a LLM não é chamada

### Requirement: Contexto enviado à LLM
A cada mensagem, a `api` SHALL enviar à LLM o prompt de sistema e, no máximo, as 20 mensagens mais
recentes da conversa (incluindo a nova), em ordem cronológica.

#### Scenario: Conversa longa
- **WHEN** a conversa já tem 30 mensagens e o cliente envia mais uma
- **THEN** a LLM recebe apenas as 20 mensagens mais recentes, da mais antiga para a mais nova

### Requirement: Consultar conversa
A `api` SHALL responder `GET /conversations/{id}` com a conversa e todas as suas mensagens em ordem
cronológica.

#### Scenario: Histórico
- **WHEN** o cliente consulta uma conversa sua com duas mensagens
- **THEN** a resposta é 200 com as duas mensagens, da mais antiga para a mais nova

### Requirement: Isolamento entre clientes
Um cliente MUST NOT ler nem enviar mensagens em conversas de outro cliente. Para não revelar que a
conversa existe, a resposta é a mesma de uma conversa inexistente: 404 com `code`
`conversation_not_found`.

#### Scenario: Conversa de outro cliente
- **WHEN** `cust_002` tenta consultar ou enviar mensagem numa conversa de `cust_001`
- **THEN** a resposta é 404 com `code` igual a `conversation_not_found`

#### Scenario: Conversa inexistente
- **WHEN** o cliente consulta um `id` de conversa que não existe
- **THEN** a resposta é 404 com `code` igual a `conversation_not_found`

### Requirement: Falha da LLM
Quando a LLM falhar ou não responder dentro do tempo limite, a `api` SHALL responder 503 com `code`
`llm_unavailable`. A mensagem do cliente continua guardada e nenhuma resposta do assistente é gravada.

#### Scenario: LLM indisponível
- **WHEN** o provedor de LLM retorna erro ao gerar a resposta
- **THEN** a resposta é 503 com `code` igual a `llm_unavailable`
- **AND** a conversa tem a mensagem do cliente e nenhuma nova mensagem do assistente
