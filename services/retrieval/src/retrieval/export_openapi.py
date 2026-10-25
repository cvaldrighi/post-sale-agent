"""
Gera o contrato OpenAPI a partir do código (code-first) e grava em contracts/retrieval.json.

    uv run python -m retrieval.export_openapi
"""

import json
from pathlib import Path

from langchain_core.embeddings import DeterministicFakeEmbedding

from .app import create_app
from .config import EMBEDDING_DIMENSIONS, Settings

CONTRACT_FILE = Path(__file__).resolve().parents[4] / "contracts" / "retrieval.json"


def build_contract() -> str:
    # Configuração e embeddings falsos: gerar o contrato não acessa banco nem modelo
    settings = Settings(database_password="unused", retrieval_api_key="x" * 16)
    app = create_app(settings, embeddings=DeterministicFakeEmbedding(size=EMBEDDING_DIMENSIONS))
    return json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n"


def main() -> None:
    CONTRACT_FILE.write_text(build_contract(), encoding="utf-8")
    print(f"Contrato gravado em {CONTRACT_FILE}")


if __name__ == "__main__":
    main()
