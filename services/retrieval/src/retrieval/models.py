"""Tabelas do schema retrieval (equivale às entidades do TypeORM)."""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, DateTime, ForeignKey, Identity, String, Text, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .config import EMBEDDING_DIMENSIONS

SCHEMA = "retrieval"


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    source: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(Text)
    # SHA-256 do título + conteúdo: se não mudou, não gera embeddings de novo
    content_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", passive_deletes=True)


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.documents.id", ondelete="CASCADE"))
    chunk_index: Mapped[int]
    # "Política de Trocas > Prazo para troca": deixa o trecho identificável sozinho
    context: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSIONS))
    # Modelo que gerou o vetor: a busca nunca compara vetores de modelos diferentes
    embedding_model: Mapped[str] = mapped_column(String(100))
    # search_vector (tsvector) é uma coluna gerada pelo banco; não precisa estar mapeada aqui

    document: Mapped[Document] = relationship(back_populates="chunks")
