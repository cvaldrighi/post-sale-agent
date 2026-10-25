from fastapi.testclient import TestClient

from retrieval.app import create_app
from retrieval.config import Settings

from .conftest import AUTH, CountingEmbeddings, ingest

ESTORNOS = "# Política de Estornos\n\n## Prazo para Pix\n\nO estorno no Pix volta em até 1 dia útil.\n"
TROCAS = "# Política de Trocas\n\n## Prazo para troca\n\nA troca pode ser feita em até 30 dias.\n"


def search(client: TestClient, query: str, top_k: int | None = None):
    body: dict = {"query": query}
    if top_k is not None:
        body["topK"] = top_k
    return client.post("/search", headers=AUTH, json=body)


def test_returns_results_with_their_source(client: TestClient) -> None:
    ingest(client, "estornos", "Política de Estornos", ESTORNOS)

    results = search(client, "estorno no Pix").json()["results"]

    assert results[0] == {
        "chunkId": results[0]["chunkId"],
        "source": "estornos",
        "documentTitle": "Política de Estornos",
        "section": "Política de Estornos > Prazo para Pix",
        "text": "O estorno no Pix volta em até 1 dia útil.",
        "score": results[0]["score"],
    }


def test_an_exact_term_ranks_the_document_that_contains_it_first(client: TestClient) -> None:
    # Com embeddings falsos a parte semântica é aleatória: quem decide é a busca por palavras
    ingest(client, "trocas", "Política de Trocas", TROCAS)
    ingest(client, "estornos", "Política de Estornos", ESTORNOS)

    results = search(client, "Pix").json()["results"]

    assert results[0]["source"] == "estornos"


def test_respects_top_k(client: TestClient) -> None:
    ingest(client, "trocas", "Política de Trocas", TROCAS)
    ingest(client, "estornos", "Política de Estornos", ESTORNOS)

    assert len(search(client, "prazo", top_k=1).json()["results"]) == 1


def test_rejects_top_k_out_of_range(client: TestClient) -> None:
    assert search(client, "prazo", top_k=50).status_code == 400


def test_ignores_chunks_from_another_embedding_model(client: TestClient, settings: Settings) -> None:
    other_model = settings.model_copy(update={"embeddings_model": "other-model"})
    other_client = TestClient(create_app(other_model, embeddings=CountingEmbeddings()))
    ingest(other_client, "antigo", "Documento Antigo", "# Documento Antigo\n\n## Pix\n\nTexto sobre Pix.\n")
    ingest(client, "estornos", "Política de Estornos", ESTORNOS)

    sources = {r["source"] for r in search(client, "Pix").json()["results"]}

    assert sources == {"estornos"}
