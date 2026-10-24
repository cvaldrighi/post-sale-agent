# Design

## Context

O monorepo tem só a base: Postgres 17 + pgvector no Docker Compose, com o schema `orders` e o
usuário `orders_service` já criados pelo script de inicialização (dono só desse schema). Ainda não
existe nenhum serviço. Motivação em proposal.md; comportamento esperado nas specs desta change.

## Goals / Non-Goals

**Goals:**
- Um serviço pequeno que se comporte como a API de um terceiro: contrato fixo, autenticação,
  erros padronizados, lentidão e falhas sob controle.
- Estorno correto mesmo com retry e concorrência, que é onde integrações de pagamento costumam errar.
- Contrato como fonte da verdade, verificado por teste.

**Non-Goals:**
- Painel, criação de pedidos ou qualquer fluxo além de consulta e estorno.
- Alta disponibilidade, cache ou performance além do básico.

## Decisions

### 1. Contract-first com `contracts/orders.yaml` (OpenAPI 3.1)
O contrato é escrito primeiro e revisado; o código implementa o contrato. Os testes usam um
validador de respostas OpenAPI (`jest-openapi`) para falhar se alguma resposta divergir.
- Alternativa: gerar o contrato a partir do código (code-first, como no `retrieval`). Descartada
  aqui porque, com um terceiro, o contrato é combinado antes de existir código dos dois lados.
- Alternativa: Prism (mock gerado a partir do OpenAPI). Descartada porque não guarda estado, e a
  idempotência e as regras de estorno precisam de estado.

### 2. NestJS + TypeORM, como a `api`
Mesmo padrão de módulos, DTOs com `class-validator`, guards e interceptors nos dois serviços Node.
- Alternativa: Fastify ou Express "puro", menor. Descartada para não manter dois estilos de código
  Node no mesmo projeto.

### 3. Dados no Postgres (schema `orders`), não em memória
Tabelas `customers`, `orders` (itens em `jsonb`, porque são só leitura), `payments` e `refunds`.
Dados de exemplo por uma migration de seed. Conexão com o usuário `orders_service`.
- Alternativa: dados em memória. Descartada porque a idempotência e o valor estornado precisam
  sobreviver a reinícios, e porque exercita o isolamento por schema desde a primeira change.

Dados de exemplo:

| Pedido | Cliente | Status | Pagamento | Valor | Para testar |
|---|---|---|---|---|---|
| `ord_1001` | `cust_001` | `delayed` | Pix, `confirmed` | 18990 | estorno total de Pix |
| `ord_1002` | `cust_001` | `delivered` | cartão, `confirmed` | 34900 | estorno parcial de cartão |
| `ord_1003` | `cust_001` | `shipped` | Pix, `confirmed` | 7990 | consulta |
| `ord_2001` | `cust_002` | `canceled` | cartão, `refunded` | 12900 | estorno recusado (já estornado) |
| `ord_2002` | `cust_002` | `paid` | Pix, `pending` | 5990 | estorno recusado (pendente) |

Os clientes têm nome e CPF de teste. O CPF é retornado completo, de propósito: mascarar dados
pessoais antes de chegarem à LLM é responsabilidade da `api` (change `add-guardrails`).

### 4. Dinheiro em centavos inteiros
`amountCents: 18990`, nunca `189.90`, para evitar erros de ponto flutuante em somas e comparações.

### 5. Idempotência guardada no próprio estorno
A tabela `refunds` tem `idempotency_key` com restrição única e `request_hash` (hash do corpo).
Chave nova: cria o estorno. Chave repetida com o mesmo hash: devolve o estorno salvo (200,
`Idempotent-Replayed: true`). Chave repetida com hash diferente: 422.
- Alternativa: tabela separada de chaves com TTL. Descartada por ser mais uma peça sem ganho na PoC.

### 6. Concorrência com transação e lock do pagamento
O estorno roda numa transação que faz `SELECT ... FOR UPDATE` no pagamento, valida estado e valor,
grava o estorno e atualiza `refundedAmountCents`. Duas requisições simultâneas para o mesmo
pagamento ficam em fila no banco, e a segunda já enxerga o valor atualizado.
- Alternativa: verificar o saldo e só depois gravar, sem lock. Descartada: é exatamente a condição
  de corrida que permite estornar duas vezes.

### 7. Erros em problem+json (RFC 9457) com `code` estável
Um filtro de exceções global converte todos os erros. O consumidor decide pelo `code`, nunca pelo
texto da mensagem.

### 8. Autenticação por `x-api-key`
Um guard global compara o header com `ORDERS_API_KEY` (comparação em tempo constante). `/health`
fica de fora.
- Alternativa: JWT entre serviços. Descartada: sem identidade de usuário aqui, só "quem chama é a
  `api`", e uma chave compartilhada resolve.

### 9. Logs e correlation ID com `nestjs-pino`
Logs em JSON, com o correlation ID do header (ou um UUID gerado) em todas as linhas da requisição.

### 10. Simulação de falhas por header
Um interceptor lê `x-simulate` quando `ORDERS_SIMULATION_ENABLED=true`: `slow` espera
`ORDERS_SIMULATED_DELAY_MS` (padrão 5000) e segue; `error` responde 503.
- Alternativa: falhas aleatórias por porcentagem. Descartada: testes e demonstração precisam de
  comportamento previsível.

### 11. Configuração
Porta 3002. Variáveis validadas na inicialização (o serviço não sobe se faltar alguma):
`DATABASE_*`, `ORDERS_API_KEY`, `ORDERS_SIMULATION_ENABLED`, `ORDERS_SIMULATED_DELAY_MS`.

### 12. Testes
- Unitários para as regras de estorno (estado, valor, hash de idempotência).
- E2E com `supertest` contra o Postgres do Compose; o estado dos dados de exemplo é restaurado
  antes de cada teste. Todos os E2E validam a resposta contra o contrato.

## Risks / Trade-offs

- [Testes E2E dependem do Postgres do Compose rodando] → o README e o script de teste indicam
  subir o banco antes; a CI (change 7) sobe o banco como serviço.
- [`jest-openapi` não suportar algum detalhe do OpenAPI 3.1] → alternativa: validar com `ajv`
  compilando os schemas do arquivo; decidir na implementação sem mudar specs nem tarefas.
- [Chave de API única e estática] → aceitável na PoC; ver "Em produção".
- [CPF completo nas respostas] → intencional para a change de guardrails; dados são de teste.

## Em produção

- O sistema de pedidos seria de outra equipe ou de um fornecedor, e este serviço não existiria.
- Autenticação entre serviços com mTLS, IAM (assinatura SigV4) ou OAuth client credentials,
  com segredos no Secrets Manager e rotação.
- Estorno assíncrono: o gateway de pagamento confirma por webhook, e o status vai de `processing`
  para `completed` ou `failed`.
- Chaves de idempotência com expiração (ex.: 24 h), em Redis ou DynamoDB.
- Simulação de falhas desligada; testes de resiliência ficam em ambientes de teste.

## Migration Plan

Serviço novo, sem dados anteriores. Subir com `docker compose up -d orders`; as migrations rodam
na inicialização. Para desfazer, remover o serviço do Compose e apagar as tabelas do schema `orders`.
