"""Configuração validada por variáveis de ambiente (equivale ao validateEnv dos serviços Node)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

# bge-m3 e Titan Text Embeddings V2 (com dimensions=1024) geram vetores do mesmo tamanho
EMBEDDING_DIMENSIONS = 1024

DEFAULT_MODELS = {
    "ollama": "bge-m3",
    "bedrock": "amazon.titan-embed-text-v2:0",
}


class Settings(BaseSettings):
    """Cada campo vira uma variável de ambiente: database_password ↔ DATABASE_PASSWORD."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = Field(default=8000, ge=1, le=65535)

    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "post_sale"
    database_user: str = "retrieval_service"
    # SecretStr: não aparece em logs nem em repr (mostra "**********")
    database_password: SecretStr

    # Chave que a api usa para chamar este serviço. 16+ caracteres para não aceitar chaves fracas.
    retrieval_api_key: SecretStr = Field(min_length=16)

    embeddings_provider: Literal["ollama", "bedrock"] = "ollama"
    # Vazio = o padrão do provedor (ver DEFAULT_MODELS)
    embeddings_model: str | None = None
    ollama_base_url: str = "http://localhost:11434"
    aws_region: str = "us-east-1"

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @property
    def model_name(self) -> str:
        return self.embeddings_model or DEFAULT_MODELS[self.embeddings_provider]

    @property
    def database_url(self) -> URL:
        # URL.create escapa a senha corretamente, mesmo com caracteres especiais
        return URL.create(
            "postgresql+psycopg",
            username=self.database_user,
            password=self.database_password.get_secret_value(),
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  (os campos obrigatórios vêm do ambiente)
