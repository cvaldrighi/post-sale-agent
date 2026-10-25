"""Busca híbrida: semântica (pgvector) + palavras (full-text em português), unidas por RRF."""

from dataclasses import dataclass

from langchain_core.embeddings import Embeddings
from sqlalchemy import text
from sqlalchemy.orm import Session

from .embeddings import check_dimensions, safe_embed

RRF_K = 60  # constante clássica do Reciprocal Rank Fusion
CANDIDATES = 20  # candidatos de cada lista antes da fusão

# Cada CTE produz uma lista ranqueada. A fusão soma 1/(k + posição) de cada lista em que o
# trecho aparece; se ele não aparece numa lista, simplesmente não soma nada dela (RRF clássico).
#
# Na busca por palavras, os termos são ligados por E (websearch_to_tsquery): só entra quem tem
# TODOS os termos. Com OU quase todo trecho casava, com notas empatadas, e essa lista sem
# informação pesava igual à semântica no RRF. Com E, ela vira um sinal forte e raro: reforça
# termos exatos ("Pix", "CDC") e, numa pergunta natural, deixa a semântica decidir.
_HYBRID_SQL = text(
    """
    WITH query_terms AS (
        SELECT websearch_to_tsquery('portuguese', :query) AS q
    ),
    semantic AS (
        SELECT c.id,
               row_number() OVER (ORDER BY c.embedding <=> CAST(:embedding AS vector)) AS rank
        FROM retrieval.chunks c
        WHERE c.embedding_model = :model
        ORDER BY c.embedding <=> CAST(:embedding AS vector)
        LIMIT :candidates
    ),
    keyword AS (
        SELECT c.id,
               row_number() OVER (ORDER BY ts_rank(c.search_vector, query_terms.q) DESC) AS rank
        FROM retrieval.chunks c, query_terms
        WHERE c.embedding_model = :model AND c.search_vector @@ query_terms.q
        ORDER BY ts_rank(c.search_vector, query_terms.q) DESC
        LIMIT :candidates
    ),
    fused AS (
        SELECT id, SUM(1.0 / (:rrf_k + rank)) AS score
        FROM (SELECT id, rank FROM semantic UNION ALL SELECT id, rank FROM keyword) ranked
        GROUP BY id
    )
    SELECT c.id, d.source, d.title, c.context, c.content, f.score
    FROM fused f
    JOIN retrieval.chunks c ON c.id = f.id
    JOIN retrieval.documents d ON d.id = c.document_id
    ORDER BY f.score DESC, c.id
    LIMIT :top_k
    """
)


@dataclass(frozen=True)
class SearchHit:
    chunk_id: int
    source: str
    document_title: str
    section: str
    text: str
    score: float


def hybrid_search(
    session: Session, embeddings: Embeddings, model_name: str, query: str, top_k: int
) -> list[SearchHit]:
    vector = safe_embed(lambda: embeddings.embed_query(query), model_name)
    check_dimensions([vector], model_name)

    rows = session.execute(
        _HYBRID_SQL,
        {
            "query": query,
            "embedding": "[" + ",".join(str(value) for value in vector) + "]",
            "model": model_name,
            "candidates": CANDIDATES,
            "rrf_k": RRF_K,
            "top_k": top_k,
        },
    ).all()

    return [
        SearchHit(
            chunk_id=row.id,
            source=row.source,
            document_title=row.title,
            section=row.context,
            text=row.content,
            score=round(float(row.score), 6),
        )
        for row in rows
    ]
