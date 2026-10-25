"""Erros em problem+json (RFC 9457), no mesmo formato dos serviços Node."""

import logging
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

ProblemCode = Literal[
    "unauthorized",
    "validation_error",
    "service_unavailable",
    "embeddings_unavailable",
    "not_found",
    "internal_error",
]

_TITLES: dict[str, str] = {
    "unauthorized": "Chave de API ausente ou inválida",
    "validation_error": "Requisição inválida",
    "service_unavailable": "Serviço indisponível",
    "embeddings_unavailable": "Serviço de embeddings indisponível",
    "not_found": "Recurso não encontrado",
    "internal_error": "Erro interno",
}


class Problem(BaseModel):
    """Corpo de erro (também documentado no contrato OpenAPI)."""

    type: str
    title: str
    status: int
    detail: str | None = None
    code: ProblemCode


class ProblemError(Exception):
    def __init__(self, code: ProblemCode, status: int, detail: str | None = None) -> None:
        super().__init__(detail or code)
        self.code = code
        self.status = status
        self.detail = detail


def problem_response(code: ProblemCode, status: int, detail: str | None = None) -> JSONResponse:
    body = Problem(
        type=f"https://post-sale-agent.dev/problems/{code.replace('_', '-')}",
        title=_TITLES[code],
        status=status,
        detail=detail,
        code=code,
    )
    return JSONResponse(
        body.model_dump(exclude_none=True),
        status_code=status,
        media_type="application/problem+json",
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def _problem(_: Request, error: ProblemError) -> JSONResponse:
        return problem_response(error.code, error.status, error.detail)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, error: RequestValidationError) -> JSONResponse:
        # O FastAPI responde 422 por padrão; usamos 400, como nos outros serviços
        details = "; ".join(f"{'.'.join(map(str, e['loc'][1:]))}: {e['msg']}" for e in error.errors())
        return problem_response("validation_error", 400, details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, error: StarletteHTTPException) -> JSONResponse:
        code: ProblemCode = "not_found" if error.status_code == 404 else "validation_error"
        if error.status_code >= 500:
            code = "internal_error"
        return problem_response(code, error.status_code, str(error.detail))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, error: Exception) -> JSONResponse:
        logger.exception("Unexpected error")  # detalhe só no log, nunca na resposta
        return problem_response("internal_error", 500)
