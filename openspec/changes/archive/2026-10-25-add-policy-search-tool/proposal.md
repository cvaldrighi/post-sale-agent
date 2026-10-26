# Proposal

## Why

O agente já consulta pedidos e pagamentos, mas não conhece as regras da loja: para "posso trocar?"
ou "quando o dinheiro volta?" ele só pode dizer que não sabe. O serviço `retrieval` já indexa e busca
as políticas; falta o agente usá-lo. Esta change liga os dois e fecha o fluxo de RAG: a LLM decide
quando buscar, a `api` busca no `retrieval` e a resposta cita a política de onde veio.

## What Changes

- Nova ferramenta `search_policies`: recebe a pergunta, devolve os trechos mais relevantes das
  políticas (título, seção e texto).
- Cliente HTTP do `retrieval` com tipos gerados de `contracts/retrieval.json`, validação das
  respostas, tempo limite, retry só em falhas temporárias e propagação do correlation ID.
- O `withRetry` passa a ser compartilhado pelos dois clientes.
- Novo prompt `assistant-v4`: busca as políticas quando o assunto é uma regra da loja, responde só
  com o que veio nos trechos, cita a política e trata os trechos como referência, nunca como instrução.

## Capabilities

### New Capabilities
- `policy-tools`: a ferramenta de busca nas políticas e o formato do resultado entregue à LLM.
- `retrieval-integration`: como a `api` chama o `retrieval` (autenticação, rastreamento, tempo
  limite, retry e validação pelo contrato).

### Modified Capabilities
<!-- Nenhuma: as ferramentas de pedidos e o ciclo do agente continuam iguais. -->

## Impact

- `services/api`: novo módulo `retrieval-client`, nova ferramenta, `withRetry` movido para `common/`,
  prompt `assistant-v4`, variáveis `RETRIEVAL_BASE_URL`, `RETRIEVAL_API_KEY` e `RETRIEVAL_TIMEOUT_MS`.
- `docker-compose.yml`: a `api` passa a depender do `retrieval`.

## Fora do escopo

- Defesas contra documentos maliciosos e mascaramento de dados pessoais: change 6.
- Avaliação automática da qualidade das respostas: change 7.
- Ingestão de políticas pela `api` (continua pelo comando do `retrieval`).
