# Spec Delta

## MODIFIED Requirements

### Requirement: Uma proposta por pedido
Se já existir uma ação `pending` e válida para o mesmo pedido na mesma conversa, a ferramenta SHALL
devolver essa ação em vez de criar outra. Numa conversa diferente, SHALL criar uma nova proposta,
para que a resposta de cada conversa traga a ação que o cliente pode aprovar ali.

#### Scenario: Pedido repetido
- **WHEN** a LLM pede `request_refund` duas vezes para `ord_1001` na mesma conversa
- **THEN** existe uma única ação `pending` para `ord_1001`

#### Scenario: Pedido em outra conversa
- **WHEN** o cliente pede o estorno de `ord_1001` numa conversa e depois numa conversa nova
- **THEN** cada conversa tem a sua ação `pending` e a resposta da conversa nova traz `pendingAction`

### Requirement: Prompt para estornos
O prompt do assistente SHALL orientar a sempre usar `request_refund` quando o cliente pedir um
estorno, mesmo que ele cite defeito, garantia ou prazo, deixando para a ferramenta a decisão sobre
o estorno; a explicar que o estorno só acontece depois da aprovação do cliente; e a nunca dizer que
ele já foi feito.

#### Scenario: Versão do prompt registrada
- **WHEN** o assistente responde uma mensagem
- **THEN** a chamada à LLM é registrada com a versão de prompt ativa (`ASSISTANT_PROMPT_VERSION`)
