from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from .conftest import CountingEmbeddings, ingest

DOC = """# Política de Estornos

## Prazo para Pix

O dinheiro volta em até 1 dia útil.

## Prazo para cartão

O crédito aparece em até 2 faturas.
"""


def chunk_count(engine: Engine) -> int:
    with engine.connect() as connection:
        return connection.execute(text("SELECT count(*) FROM retrieval.chunks")).scalar_one()


def test_ingests_a_new_document(client: TestClient, engine: Engine) -> None:
    response = ingest(client, "estornos", "Política de Estornos", DOC)

    assert response.status_code == 201
    assert response.json() == {
        "source": "estornos",
        "title": "Política de Estornos",
        "chunkCount": 2,
        "changed": True,
    }
    assert chunk_count(engine) == 2


def test_an_unchanged_document_generates_no_embeddings(
    client: TestClient, embeddings: CountingEmbeddings
) -> None:
    ingest(client, "estornos", "Política de Estornos", DOC)
    calls_after_first = embeddings.document_calls

    response = ingest(client, "estornos", "Política de Estornos", DOC)

    assert response.status_code == 200
    assert response.json()["changed"] is False
    assert embeddings.document_calls == calls_after_first


def test_a_changed_document_replaces_its_chunks(client: TestClient, engine: Engine) -> None:
    ingest(client, "estornos", "Política de Estornos", DOC)

    changed = DOC + "\n## Estorno parcial\n\nCorresponde aos itens devolvidos.\n"
    response = ingest(client, "estornos", "Política de Estornos", changed)

    assert response.status_code == 200
    assert response.json()["chunkCount"] == 3
    assert chunk_count(engine) == 3  # nada duplicado


def test_rejects_a_document_without_text(client: TestClient) -> None:
    response = ingest(client, "vazio", "Vazio", "# Vazio\n\n## Seção sem texto\n")

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_rejects_an_invalid_source(client: TestClient) -> None:
    response = ingest(client, "Nome Com Espaço", "X", "# X\n\nTexto.")

    assert response.status_code == 400
