"""Ingestão idempotente: documento igual não gera embeddings; alterado substitui os trechos."""

import hashlib
import logging
from dataclasses import dataclass

from langchain_core.embeddings import Embeddings
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .chunking import embedding_input, split_markdown
from .embeddings import check_dimensions, safe_embed
from .errors import ProblemError
from .models import Chunk, Document

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class IngestResult:
    source: str
    title: str
    chunk_count: int
    changed: bool
    created: bool


def content_hash(title: str, content: str) -> str:
    return hashlib.sha256(f"{title}\n{content}".encode()).hexdigest()


def ingest_document(
    session: Session,
    embeddings: Embeddings,
    model_name: str,
    *,
    source: str,
    title: str,
    content: str,
    force: bool = False,
) -> IngestResult:
    new_hash = content_hash(title, content)

    # 1. Leitura curta: já existe e não mudou? Então não há nada a fazer.
    with session.begin():
        existing = session.scalar(select(Document).where(Document.source == source))
        if existing and existing.content_hash == new_hash and not force:
            count = session.scalar(select(func.count()).where(Chunk.document_id == existing.id)) or 0
            return IngestResult(source, title, count, changed=False, created=False)

    # 2. Embeddings FORA da transação: chamar o modelo pode levar segundos,
    #    e não queremos segurar uma conexão do banco esperando.
    drafts = split_markdown(title, content)
    if not drafts:
        raise ProblemError("validation_error", 400, "O documento não tem conteúdo para indexar")
    vectors = safe_embed(lambda: embeddings.embed_documents([embedding_input(d) for d in drafts]), model_name)
    check_dimensions(vectors, model_name)

    # 3. Escrita numa única transação: ou troca todos os trechos, ou nenhum
    with session.begin():
        document = session.scalar(select(Document).where(Document.source == source).with_for_update())
        created = document is None
        if document is None:
            document = Document(source=source, title=title, content_hash=new_hash)
            session.add(document)
            session.flush()  # gera o id do documento
        else:
            document.title = title
            document.content_hash = new_hash
            session.execute(delete(Chunk).where(Chunk.document_id == document.id))

        session.add_all(
            Chunk(
                document_id=document.id,
                chunk_index=draft.index,
                context=draft.context,
                content=draft.content,
                embedding=vector,
                embedding_model=model_name,
            )
            for draft, vector in zip(drafts, vectors, strict=True)
        )

    # Atenção: "created" é um nome reservado do LogRecord do Python; por isso "isNewDocument"
    logger.info(
        "Document ingested",
        extra={"source": source, "chunks": len(drafts), "isNewDocument": created},
    )
    return IngestResult(source, title, len(drafts), changed=True, created=created)
