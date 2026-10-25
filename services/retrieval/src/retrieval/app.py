"""Aplicação FastAPI. create_app recebe configuração e embeddings para os testes trocarem."""

import logging
import time
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response
from langchain_core.embeddings import Embeddings
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings, get_settings
from .embeddings import create_embeddings
from .errors import Problem, ProblemError, register_error_handlers
from .ingestion import ingest_document
from .logging_config import CORRELATION_HEADER, configure_logging, correlation_id, resolve_correlation_id
from .schemas import DocumentIn, DocumentOut, Health, SearchIn, SearchOut, SearchResult
from .search import hybrid_search
from .security import require_api_key

logger = logging.getLogger("retrieval.http")

ERRORS = {
    400: {"model": Problem, "description": "validation_error"},
    401: {"model": Problem, "description": "unauthorized"},
    503: {"model": Problem, "description": "embeddings_unavailable"},
}


def create_app(settings: Settings | None = None, embeddings: Embeddings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    engine = create_engine(settings.database_url, pool_pre_ping=True)
    session_factory = sessionmaker(engine, expire_on_commit=False)
    embeddings = embeddings or create_embeddings(settings)

    app = FastAPI(
        title="post-sale-agent retrieval",
        version="1.0.0",
        description="Busca semântica nas políticas da loja (RAG). Consumido pela api do agente.",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    register_error_handlers(app)

    @app.middleware("http")
    async def correlation(request: Request, call_next):
        """Lê ou gera o correlation ID, devolve na resposta e loga cada requisição."""
        token = correlation_id.set(resolve_correlation_id(request.headers.get(CORRELATION_HEADER)))
        started = time.perf_counter()
        try:
            response = await call_next(request)
            response.headers[CORRELATION_HEADER] = correlation_id.get()
            logger.info(
                "request completed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "durationMs": round((time.perf_counter() - started) * 1000),
                },
            )
            return response
        finally:
            correlation_id.reset(token)

    def get_session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    # Annotated junta o tipo e a dependência (como os decorators de parâmetro do Nest)
    DbSession = Annotated[Session, Depends(get_session)]

    @app.get("/health", response_model=Health, responses={503: {"model": Problem}}, tags=["operations"])
    def health(session: DbSession) -> Health:
        try:
            session.execute(text("SELECT 1"))
        except Exception as error:
            raise ProblemError("service_unavailable", 503, "Banco de dados indisponível") from error
        return Health(status="ok")

    @app.post(
        "/documents",
        response_model=DocumentOut,
        status_code=201,
        responses={200: {"model": DocumentOut, "description": "Documento já existia"}, **ERRORS},
        dependencies=[Depends(require_api_key)],
        tags=["documents"],
        summary="Ingere ou atualiza um documento de política",
    )
    def ingest(body: DocumentIn, response: Response, session: DbSession) -> DocumentOut:
        result = ingest_document(
            session,
            embeddings,
            settings.model_name,
            source=body.source,
            title=body.title,
            content=body.content,
        )
        if not result.created:
            response.status_code = 200
        return DocumentOut(
            source=result.source, title=result.title, chunk_count=result.chunk_count, changed=result.changed
        )

    @app.post(
        "/search",
        response_model=SearchOut,
        responses=ERRORS,
        dependencies=[Depends(require_api_key)],
        tags=["search"],
        summary="Busca os trechos das políticas mais relevantes para uma pergunta",
    )
    def search(body: SearchIn, session: DbSession) -> SearchOut:
        hits = hybrid_search(session, embeddings, settings.model_name, body.query, body.top_k)
        return SearchOut(
            results=[
                SearchResult(
                    chunk_id=hit.chunk_id,
                    source=hit.source,
                    document_title=hit.document_title,
                    section=hit.section,
                    text=hit.text,
                    score=hit.score,
                )
                for hit in hits
            ]
        )

    return app
