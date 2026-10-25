"""Formatos de entrada e saída da API (equivalem aos DTOs do Nest). Geram o contrato OpenAPI."""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    # Campos em snake_case no Python, camelCase no JSON (como nos outros serviços)
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DocumentIn(ApiModel):
    source: str = Field(
        pattern=r"^[a-z0-9-]{1,100}$",
        description="Identificador estável do documento, ex.: trocas-e-devolucoes",
        examples=["trocas-e-devolucoes"],
    )
    title: str = Field(min_length=1, max_length=200, examples=["Política de Trocas e Devoluções"])
    content: str = Field(min_length=1, max_length=100_000, description="Conteúdo em Markdown")


class DocumentOut(ApiModel):
    source: str
    title: str
    chunk_count: int
    changed: bool = Field(description="false quando o documento já estava igual e nada foi refeito")


class SearchIn(ApiModel):
    query: str = Field(min_length=1, max_length=500, examples=["posso cancelar um pedido atrasado?"])
    top_k: int = Field(default=5, ge=1, le=20)


class SearchResult(ApiModel):
    chunk_id: int
    source: str
    document_title: str
    section: str = Field(description="Caminho da seção, ex.: Política de Trocas > Prazo para troca")
    text: str
    score: float = Field(description="Relevância (RRF): maior é melhor")


class SearchOut(ApiModel):
    results: list[SearchResult]


class Health(BaseModel):
    status: str = Field(examples=["ok"])
