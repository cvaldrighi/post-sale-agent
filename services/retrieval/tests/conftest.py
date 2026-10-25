"""
Fixtures dos testes. Os testes usam o Postgres de verdade (do Docker Compose) e embeddings
FALSOS: vetores previsíveis, sem precisar de modelo. As tabelas do schema retrieval são limpas
antes de cada teste.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from langchain_core.embeddings import DeterministicFakeEmbedding, Embeddings
from sqlalchemy import Engine, create_engine, text

from retrieval.app import create_app
from retrieval.config import EMBEDDING_DIMENSIONS, Settings

SERVICE_DIR = Path(__file__).resolve().parents[1]
API_KEY = "test-retrieval-key-0123456789"
AUTH = {"x-api-key": API_KEY}


class CountingEmbeddings(Embeddings):
    """Embeddings falsos que contam as chamadas (para provar que nada foi regerado)."""

    def __init__(self) -> None:
        self._fake = DeterministicFakeEmbedding(size=EMBEDDING_DIMENSIONS)
        self.document_calls = 0

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.document_calls += 1
        return self._fake.embed_documents(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._fake.embed_query(text)


@pytest.fixture(scope="session")
def settings() -> Settings:
    # As credenciais do banco vêm do .env do serviço; o resto é fixo para os testes
    return Settings(
        _env_file=SERVICE_DIR / ".env",
        retrieval_api_key=API_KEY,
        embeddings_provider="ollama",
        embeddings_model="fake-model",
        log_level="WARNING",
    )


@pytest.fixture(scope="session")
def engine(settings: Settings) -> Iterator[Engine]:
    command.upgrade(Config(str(SERVICE_DIR / "alembic.ini")), "head")  # garante as tabelas
    engine = create_engine(settings.database_url)
    yield engine
    engine.dispose()


def _truncate(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE retrieval.chunks, retrieval.documents RESTART IDENTITY CASCADE"))


@pytest.fixture(autouse=True)
def clean_database(engine: Engine) -> Iterator[None]:
    """Limpa antes (o teste começa do zero) e depois (não deixa resto de teste no banco)."""
    _truncate(engine)
    yield
    _truncate(engine)


@pytest.fixture
def embeddings() -> CountingEmbeddings:
    return CountingEmbeddings()


@pytest.fixture
def client(settings: Settings, embeddings: CountingEmbeddings) -> TestClient:
    return TestClient(create_app(settings, embeddings=embeddings))


def ingest(client: TestClient, source: str, title: str, content: str):
    body = {"source": source, "title": title, "content": content}
    return client.post("/documents", headers=AUTH, json=body)
