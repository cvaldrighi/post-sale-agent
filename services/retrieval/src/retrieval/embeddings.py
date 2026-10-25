"""
Provedores de embeddings. A classe base Embeddings do LangChain faz o papel da interface:
embed_documents (vários textos, na ingestão) e embed_query (a pergunta, na busca).
"""

from langchain_aws import BedrockEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_ollama import OllamaEmbeddings

from .config import EMBEDDING_DIMENSIONS, Settings
from .errors import ProblemError


def create_embeddings(settings: Settings) -> Embeddings:
    if settings.embeddings_provider == "ollama":
        return OllamaEmbeddings(model=settings.model_name, base_url=settings.ollama_base_url)
    return BedrockEmbeddings(
        model_id=settings.model_name,
        region_name=settings.aws_region,
        dimensions=EMBEDDING_DIMENSIONS,
        normalize=True,
    )


def check_dimensions(vectors: list[list[float]], model_name: str) -> None:
    """Falha com uma mensagem clara se o modelo não gerar vetores do tamanho da coluna."""
    for vector in vectors:
        if len(vector) != EMBEDDING_DIMENSIONS:
            raise ProblemError(
                "embeddings_unavailable",
                503,
                f"O modelo {model_name} gerou {len(vector)} dimensões; "
                f"o banco espera {EMBEDDING_DIMENSIONS}.",
            )


def safe_embed(call, model_name: str):
    """Converte falhas do provedor (Ollama fora do ar, credenciais) num erro 503 do contrato."""
    try:
        return call()
    except ProblemError:
        raise
    except Exception as error:  # o provedor pode lançar erros de rede, HTTP ou da AWS
        raise ProblemError(
            "embeddings_unavailable",
            503,
            f"Falha ao gerar embeddings com {model_name}: {type(error).__name__}",
        ) from error
