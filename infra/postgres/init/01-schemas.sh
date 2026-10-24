#!/bin/bash
# Roda uma única vez, na primeira inicialização do volume do Postgres.
#
# Cria um schema por serviço e um usuário por serviço, cada um dono só do
# próprio schema. Assim um serviço não consegue ler nem alterar as tabelas
# de outro: o isolamento de "um banco por serviço", simplificado para a PoC.
set -euo pipefail

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v app_pw="$APP_DB_PASSWORD" \
  -v retrieval_pw="$RETRIEVAL_DB_PASSWORD" \
  -v orders_pw="$ORDERS_DB_PASSWORD" <<'EOSQL'
-- Extensão de busca vetorial (usada pelo serviço retrieval)
CREATE EXTENSION IF NOT EXISTS vector;

-- Usuários dos serviços
CREATE ROLE app_service       LOGIN PASSWORD :'app_pw';
CREATE ROLE retrieval_service LOGIN PASSWORD :'retrieval_pw';
CREATE ROLE orders_service    LOGIN PASSWORD :'orders_pw';

-- Um schema por serviço, com o respectivo usuário como dono
CREATE SCHEMA app       AUTHORIZATION app_service;
CREATE SCHEMA retrieval AUTHORIZATION retrieval_service;
CREATE SCHEMA orders    AUTHORIZATION orders_service;

-- Cada usuário enxerga por padrão só o próprio schema
-- (public continua no caminho para o tipo "vector" da extensão)
ALTER ROLE app_service       SET search_path = app, public;
ALTER ROLE retrieval_service SET search_path = retrieval, public;
ALTER ROLE orders_service    SET search_path = orders, public;
EOSQL
