# Tasks

## 1. Estrutura do serviço

- [x] 1.1 Criar o projeto com `uv` em `services/retrieval` (Python 3.12, FastAPI, SQLAlchemy, psycopg, pgvector, Alembic, LangChain, pytest, ruff) e verificar que `uv run pytest` e `uv run ruff check` rodam
- [x] 1.2 Criar a configuração validada com pydantic-settings (banco, `RETRIEVAL_API_KEY`, provedor e modelo de embeddings, URL do Ollama, região da AWS) e verificar com testes unitários que o serviço recusa iniciar sem a chave ou com provedor inválido
- [x] 1.3 Implementar logs JSON com correlation ID, erros em problem+json, chave de API e `GET /health`; verificar com testes (401 sem chave, health, correlation ID devolvido)

## 2. Banco de dados

- [x] 2.1 Criar a migration Alembic de `documents` e `chunks` (vetor de 1024, `embedding_model`, `tsvector` gerado, índices HNSW e GIN); verificar com `uv run alembic upgrade head` e `\d retrieval.chunks`

## 3. Ingestão

- [x] 3.1 Implementar a divisão em trechos por seção com contexto; verificar com testes unitários (seções separadas, seção longa subdividida, contexto correto)
- [x] 3.2 Implementar os provedores de embeddings (Ollama, Bedrock) e o falso dos testes; verificar com teste unitário da escolha por configuração
- [x] 3.3 Implementar a ingestão idempotente e `POST /documents`; verificar com testes de integração (documento novo, igual sem novos embeddings, alterado sem duplicar)
- [x] 3.4 Escrever as 5 políticas em `data/policies` e o comando `ingest`; verificar rodando o comando contra o Ollama local

## 4. Busca

- [x] 4.1 Implementar a busca híbrida com RRF e `POST /search`; verificar com testes de integração (termo exato, consulta vazia, `topK`, trechos de outro modelo ignorados)
- [x] 4.2 Adicionar o teste marcado de busca por sinônimo com o Ollama real; verificar rodando com o Ollama ativo

## 5. Contrato, Docker e documentação

- [x] 5.1 Criar o `export_openapi`, gerar `contracts/retrieval.json` e o teste de divergência; verificar que o teste falha ao mudar um modelo sem regenerar
- [x] 5.2 Criar o `Dockerfile` e adicionar o `retrieval` ao Compose (migrations e ingestão na inicialização, Ollama via host); verificar que fica healthy
- [x] 5.3 Escrever `services/retrieval/README.md` (com o paralelo Python × Node) e atualizar o README principal; verificar os comandos documentados

## 6. Verificação manual

- [x] 6.1 Com o Compose rodando, buscar "posso cancelar um pedido atrasado?", "em quanto tempo o dinheiro volta no Pix?" e "devolver produto com defeito"; conferir que os primeiros resultados vêm das políticas certas

## Workflow follow-up

- Abrir o PR de `feat/add-retrieval-service` e fazer o merge depois da revisão.
- Arquivar com `openspec archive add-retrieval-service`.
