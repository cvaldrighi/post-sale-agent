"""
Busca semântica com o modelo de verdade (bge-m3 no Ollama). Fica fora da execução normal porque
depende do Ollama rodando: RUN_OLLAMA_TESTS=1 uv run pytest -m ollama
"""

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from retrieval.app import create_app
from retrieval.chunking import title_from_markdown
from retrieval.config import Settings

from .conftest import AUTH, SERVICE_DIR

pytestmark = [
    pytest.mark.ollama,
    pytest.mark.skipif(os.getenv("RUN_OLLAMA_TESTS") != "1", reason="defina RUN_OLLAMA_TESTS=1"),
]


@pytest.fixture
def real_client(settings: Settings) -> TestClient:
    real = settings.model_copy(update={"embeddings_model": "bge-m3"})
    client = TestClient(create_app(real))  # embeddings de verdade
    for path in sorted(Path(SERVICE_DIR / "data" / "policies").glob("*.md")):
        content = path.read_text(encoding="utf-8")
        client.post(
            "/documents",
            headers=AUTH,
            json={"source": path.stem, "title": title_from_markdown(content, path.stem), "content": content},
        )
    return client


def top_sources(client: TestClient, query: str, n: int = 3) -> list[str]:
    results = client.post("/search", headers=AUTH, json={"query": query, "topK": n}).json()["results"]
    return [r["source"] for r in results]


def test_finds_refunds_by_a_synonym(real_client: TestClient) -> None:
    # "devolver o dinheiro" não aparece no texto; a política fala em "estorno"
    assert "estornos" in top_sources(real_client, "em quanto tempo vocês devolvem o meu dinheiro?")


def test_finds_the_cancellation_rule_for_late_orders(real_client: TestClient) -> None:
    assert top_sources(real_client, "posso cancelar um pedido que está atrasado?", 1)[0] in {
        "cancelamento",
        "prazos-e-atrasos",
    }
