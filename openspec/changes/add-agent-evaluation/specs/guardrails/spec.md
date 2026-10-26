# Spec Delta

## ADDED Requirements

### Requirement: Pedidos citados precisam ter origem
Todo id de pedido (`ord_…`) citado na resposta final da LLM SHALL aparecer no resultado de uma
ferramenta bem-sucedida durante aquela mensagem ou no histórico da conversa (inclusive na mensagem do
cliente). Se não aparecer, a `api` SHALL trocar a resposta por uma mensagem segura e registrar um log
com `guardrail` igual a `ungrounded_order` e os ids citados.

#### Scenario: Pedidos inventados
- **WHEN** a LLM responde "Listei seus pedidos recentes: ord_1005 e ord_1006" sem ter chamado ferramenta
- **THEN** a resposta ao cliente é a mensagem segura

#### Scenario: Pedido devolvido por uma ferramenta
- **WHEN** a LLM chama `get_order` para `ord_1001` e responde citando `ord_1001`
- **THEN** a resposta ao cliente é a da LLM

#### Scenario: Pedido digitado pelo cliente
- **WHEN** o cliente pergunta pelo `ord_2001` e a LLM responde "Não encontrei o pedido ord_2001"
- **THEN** a resposta ao cliente é a da LLM
