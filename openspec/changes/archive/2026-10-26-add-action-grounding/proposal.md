# Proposal

## Why

No teste manual do estorno, o modelo respondeu "Preparei a solicitação de estorno de R$ 189,90 do
pedido ord_1001" sem ter chamado `request_refund`: nenhuma proposta existia. Nenhum estorno errado
pode acontecer (não há o que aprovar), mas o cliente é enganado e fica esperando algo que não existe.
Era a única falha do teste manual que passava por todas as proteções.

## What Changes

- Guardrail `ungrounded_action`: resposta que afirma ter preparado, solicitado ou feito um estorno,
  sem uma chamada bem-sucedida de `request_refund` na mesma mensagem, é trocada por uma resposta
  segura e registrada em log.
- Novo caso de avaliação: pedido de estorno de um pedido "atrasado", que desviou o modelo no teste manual.

## Capabilities

### New Capabilities
<!-- Nenhuma. -->

### Modified Capabilities
- `guardrails`: novo requisito de fundamentação de ações.

## Impact

- `services/api`: função pura em `src/guardrails`, aplicada no `ConversationsService`; um caso a mais
  em `eval/cases.json`.

## Fora do escopo

- Afirmações sobre o estorno já concluído: a confirmação da execução é escrita pelo código na conversa.
- Avaliar conversas com várias mensagens (por exemplo, perguntar depois da aprovação): o script de
  avaliação manda uma mensagem por rodada.
