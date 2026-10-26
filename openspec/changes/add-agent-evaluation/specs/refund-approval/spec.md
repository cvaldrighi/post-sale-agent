# Spec Delta

## MODIFIED Requirements

### Requirement: Prompt para estornos
O prompt do assistente SHALL orientar a sempre usar `request_refund` quando o cliente pedir um
estorno, mesmo que ele cite defeito, garantia ou prazo, deixando para a ferramenta a decisão sobre
o estorno; a explicar que o estorno só acontece depois da aprovação do cliente; e a nunca dizer que
ele já foi feito.

#### Scenario: Versão do prompt registrada
- **WHEN** o assistente responde uma mensagem
- **THEN** a chamada à LLM é registrada com a versão de prompt ativa (`ASSISTANT_PROMPT_VERSION`)
