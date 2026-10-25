"""
Diagnóstico da busca: mostra a lista semântica, a lista por palavras e a fusão (RRF) lado a lado.

    uv run python -m retrieval.explain "em quanto tempo vocês devolvem o meu dinheiro?"
"""

import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from .config import get_settings
from .embeddings import create_embeddings
from .search import CANDIDATES, RRF_K, hybrid_search

_SEMANTIC = text(
    """
    SELECT d.source, c.context, 1 - (c.embedding <=> CAST(:embedding AS vector)) AS similarity
    FROM retrieval.chunks c JOIN retrieval.documents d ON d.id = c.document_id
    WHERE c.embedding_model = :model
    ORDER BY c.embedding <=> CAST(:embedding AS vector)
    LIMIT :limit
    """
)

_KEYWORD = text(
    """
    WITH query_terms AS (SELECT websearch_to_tsquery('portuguese', :query) AS q)
    SELECT d.source, c.context, ts_rank(c.search_vector, query_terms.q) AS rank_score,
           query_terms.q::text AS terms
    FROM retrieval.chunks c JOIN retrieval.documents d ON d.id = c.document_id, query_terms
    WHERE c.embedding_model = :model AND c.search_vector @@ query_terms.q
    ORDER BY rank_score DESC
    LIMIT :limit
    """
)


def main() -> None:
    query = " ".join(sys.argv[1:]) or "em quanto tempo vocês devolvem o meu dinheiro?"
    settings = get_settings()
    embeddings = create_embeddings(settings)
    vector = "[" + ",".join(map(str, embeddings.embed_query(query))) + "]"
    params = {"embedding": vector, "model": settings.model_name, "query": query, "limit": 8}

    with Session(create_engine(settings.database_url)) as session:
        print(f'\nPergunta: "{query}"   (modelo: {settings.model_name})\n')

        print("1) SEMÂNTICA (similaridade de cosseno, maior = mais parecido)")
        for i, row in enumerate(session.execute(_SEMANTIC, params), start=1):
            print(f"   {i:>2}. {row.similarity:.3f}  {row.context}")

        rows = session.execute(_KEYWORD, params).all()
        print(f"\n2) PALAVRAS (ts_rank)   termos: {rows[0].terms if rows else '-'}")
        for i, row in enumerate(rows, start=1):
            print(f"   {i:>2}. {row.rank_score:.3f}  {row.context}")

        print(f"\n3) FUSÃO (RRF, k={RRF_K}, {CANDIDATES} candidatos por lista)")
        for i, hit in enumerate(hybrid_search(session, embeddings, settings.model_name, query, 8), start=1):
            print(f"   {i:>2}. {hit.score:.4f}  {hit.section}")
        print()


if __name__ == "__main__":
    main()
