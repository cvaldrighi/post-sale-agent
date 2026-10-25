"""Logs em JSON com correlation ID, como o pino nos serviços Node."""

import logging
import re
import sys
import uuid
from contextvars import ContextVar

from pythonjsonlogger.json import JsonFormatter

CORRELATION_HEADER = "x-correlation-id"

# ContextVar guarda um valor "por requisição", como o AsyncLocalStorage do Node
correlation_id: ContextVar[str] = ContextVar("correlation_id", default="-")

# Aceita só IDs "comportados": evita que um header malicioso injete texto nos logs
_VALID_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def resolve_correlation_id(header: str | None) -> str:
    """Usa o ID recebido se for válido; senão, gera um novo."""
    return header if header and _VALID_ID.match(header) else str(uuid.uuid4())


class _CorrelationFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlationId = correlation_id.get()
        return True


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_CorrelationFilter())
    handler.setFormatter(
        JsonFormatter(
            "{asctime}{levelname}{name}{message}{correlationId}",
            style="{",
            rename_fields={"asctime": "time", "levelname": "level", "name": "logger", "message": "msg"},
            json_ensure_ascii=False,  # grava "mudanças" em vez de "mudan\u00e7as"
        )
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    # O uvicorn tem os próprios logs de acesso; usamos o nosso middleware no lugar
    logging.getLogger("uvicorn.access").disabled = True
    # O httpx (usado pelo cliente do Ollama) loga cada requisição em INFO: ruído
    logging.getLogger("httpx").setLevel(logging.WARNING)
