"""Ambiente do Alembic: conecta com o usuário do serviço, no schema retrieval."""

from alembic import context
from sqlalchemy import create_engine

from retrieval.config import get_settings
from retrieval.models import SCHEMA, Base

connectable = create_engine(get_settings().database_url)

with connectable.connect() as connection:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        # A tabela de controle das migrations fica no schema do serviço,
        # o único em que o usuário retrieval_service pode escrever
        version_table_schema=SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()
