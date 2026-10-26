# Spec Delta

## ADDED Requirements

### Requirement: Ações afirmadas precisam ter acontecido
Se a resposta final da LLM afirmar que um estorno foi preparado, solicitado ou feito (por exemplo,
"preparei a solicitação de estorno", "solicitei o estorno", "fiz o estorno") e nenhuma chamada a
`request_refund` tiver sido bem-sucedida durante aquela mensagem, a `api` SHALL trocar a resposta por
uma mensagem segura e registrar um log com `guardrail` igual a `ungrounded_action`.

#### Scenario: Estorno afirmado sem a ferramenta
- **WHEN** a LLM responde "Preparei a solicitação de estorno de R$ 189,90 do pedido ord_1001" sem ter chamado `request_refund`
- **THEN** a resposta ao cliente é a mensagem segura e não há `pendingAction`

#### Scenario: Estorno afirmado depois da ferramenta
- **WHEN** a LLM chama `request_refund` com sucesso e responde "Preparei a solicitação de estorno"
- **THEN** a resposta ao cliente é a da LLM e a resposta traz `pendingAction`

#### Scenario: Oferecer não é afirmar
- **WHEN** a LLM responde "Posso preparar a solicitação de estorno para você?" sem chamar ferramenta
- **THEN** a resposta ao cliente é a da LLM
