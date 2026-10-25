"""
Carga das políticas: ingere todos os .md de uma pasta.

    uv run python -m retrieval.ingest data/policies
    uv run python -m retrieval.ingest data/policies --force   # refaz tudo (ex.: trocou o modelo)
"""

import argparse
import logging
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .chunking import title_from_markdown
from .config import get_settings
from .embeddings import create_embeddings
from .ingestion import ingest_document
from .logging_config import configure_logging

logger = logging.getLogger("retrieval.ingest")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Ingere os documentos Markdown de uma pasta")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--force", action="store_true", help="regera os embeddings mesmo sem mudanças")
    args = parser.parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level)
    session_factory = sessionmaker(create_engine(settings.database_url), expire_on_commit=False)
    embeddings = create_embeddings(settings)

    files = sorted(args.folder.glob("*.md"))
    if not files:
        raise SystemExit(f"Nenhum arquivo .md em {args.folder}")

    for path in files:
        content = path.read_text(encoding="utf-8")
        with session_factory() as session:
            result = ingest_document(
                session,
                embeddings,
                settings.model_name,
                source=path.stem,
                title=title_from_markdown(content, fallback=path.stem),
                content=content,
                force=args.force,
            )
        status = "criado" if result.created else ("atualizado" if result.changed else "sem mudanças")
        logger.info(f"{path.name}: {status} ({result.chunk_count} trechos)")


if __name__ == "__main__":
    main()
