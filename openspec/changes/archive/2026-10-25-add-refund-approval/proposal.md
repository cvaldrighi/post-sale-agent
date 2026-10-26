# Proposal

## Why

O agente já consulta pedidos, pagamentos e políticas, mas não resolve nada: para "quero o estorno
do pedido ord_1001" ele só pode explicar a regra. Esta change adiciona a primeira ação que altera
dados, com a regra de segurança do projeto: ferramentas de escrita nunca executam direto. O agente
propõe o estorno, e só o cliente, por um endpoint fora do alcance da LLM, aprova a execução.

## What Changes

- Nova ferramenta `request_refund`: confere no código se o pedido é do cliente, se o pagamento pode
  ser estornado e se o valor cabe no que falta estornar, e cria uma **ação pendente** (não estorna).
- Tabela `app.pending_actions`, com status, validade de 15 minutos e o resultado da execução.
- Endpoints `POST /actions/{id}/approve` e `POST /actions/{id}/reject`, só para o dono da ação.
- Aprovação atômica (dois cliques não executam duas vezes) e chamada ao `orders` com o id da ação
  como `Idempotency-Key`, o que permite repetir a escrita sem duplicar o estorno.
- A resposta de `POST /conversations/{id}/messages` passa a trazer a ação pendente criada.
- Novo prompt `assistant-v6`: pedir o estorno pela ferramenta e nunca dizer que ele já foi feito.

## Capabilities

### New Capabilities
- `refund-approval`: a proposta de estorno pelo agente, a ação pendente e a aprovação pelo cliente.

### Modified Capabilities
- `orders-integration`: passa a incluir a solicitação de estorno, com chave de idempotência e retry.

## Impact

- `services/api`: ferramenta, módulo de ações, migration de `pending_actions`, método de estorno no
  `OrdersClient`, prompt `assistant-v6`, campo `pendingAction` na resposta de mensagens.
- Nenhuma mudança no `orders`: o `POST /refunds` já existe e já é idempotente.

## Fora do escopo

- Cancelamento de pedido e outras ações de escrita.
- Aprovação por um atendente; aqui quem aprova é o próprio cliente.
- Regras de elegibilidade da política (o agente não decide se o estorno é devido).
- Aviso de quando o estorno de cartão termina de ser processado.
