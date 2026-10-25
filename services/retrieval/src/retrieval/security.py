"""Chave de API entre serviços, comparada em tempo constante."""

import hashlib
import hmac
from typing import Annotated

from fastapi import Depends
from fastapi.security import APIKeyHeader

from .config import Settings, get_settings
from .errors import ProblemError

# APIKeyHeader também documenta a chave no contrato OpenAPI (securitySchemes)
_api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)


def _digest(value: str) -> bytes:
    return hashlib.sha256(value.encode()).digest()


def require_api_key(
    provided: Annotated[str | None, Depends(_api_key_header)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    expected = settings.retrieval_api_key.get_secret_value()
    # compare_digest não para no primeiro caractere diferente (evita ataques por tempo)
    if not provided or not hmac.compare_digest(_digest(provided), _digest(expected)):
        raise ProblemError("unauthorized", 401)
