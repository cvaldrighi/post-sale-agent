#!/bin/sh
# Inicialização do container: banco atualizado, políticas indexadas, depois o servidor.
# set -e: se uma etapa falhar (ex.: Ollama fora do ar), o container para com o erro no log.
set -e

alembic upgrade head

# Idempotente: documento com o mesmo hash não é reprocessado, então reiniciar é barato
python -m retrieval.ingest data/policies

# exec: o servidor vira o processo principal e recebe o sinal de parada do Docker
exec retrieval
