import pytest
from pydantic import ValidationError

from retrieval.config import Settings


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("RETRIEVAL_API_KEY", "EMBEDDINGS_PROVIDER", "EMBEDDINGS_MODEL", "DATABASE_PASSWORD"):
        monkeypatch.delenv(name, raising=False)


def build(**values) -> Settings:
    return Settings(_env_file=None, database_password="secret", **values)


def test_requires_the_api_key() -> None:
    with pytest.raises(ValidationError, match="retrieval_api_key"):
        build()


def test_rejects_a_short_api_key() -> None:
    with pytest.raises(ValidationError, match="retrieval_api_key"):
        build(retrieval_api_key="short")


def test_rejects_an_unknown_provider() -> None:
    with pytest.raises(ValidationError, match="embeddings_provider"):
        build(retrieval_api_key="k" * 16, embeddings_provider="openai")


def test_uses_the_default_model_of_each_provider() -> None:
    assert build(retrieval_api_key="k" * 16).model_name == "bge-m3"
    assert (
        build(retrieval_api_key="k" * 16, embeddings_provider="bedrock").model_name
        == "amazon.titan-embed-text-v2:0"
    )


def test_hides_secrets_in_repr() -> None:
    assert "secret" not in repr(build(retrieval_api_key="k" * 16))
