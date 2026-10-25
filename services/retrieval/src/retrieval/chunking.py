"""Divisão dos documentos em trechos, preservando a seção de cada um."""

from dataclasses import dataclass

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

_HEADERS = [("#", "h1"), ("##", "h2"), ("###", "h3")]


@dataclass(frozen=True)
class ChunkDraft:
    index: int
    context: str  # "Título > Seção > Subseção"
    content: str


def split_markdown(title: str, markdown: str, max_chars: int = 1000, overlap: int = 150) -> list[ChunkDraft]:
    """
    1. Divide pelos títulos do Markdown: cada trecho pertence a uma única seção.
    2. Seções longas são subdivididas, com sobreposição, sem atravessar a seção.
    3. Cada trecho guarda o caminho da seção, para continuar identificável sozinho.
    """
    sections = MarkdownHeaderTextSplitter(_HEADERS, strip_headers=True).split_text(markdown)
    splitter = RecursiveCharacterTextSplitter(chunk_size=max_chars, chunk_overlap=overlap)

    drafts: list[ChunkDraft] = []
    for section in sections:
        path = [section.metadata[key] for key in ("h1", "h2", "h3") if key in section.metadata]
        context = " > ".join([title, *[part for part in path if part != title]])
        for piece in splitter.split_text(section.page_content):
            if piece.strip():
                drafts.append(ChunkDraft(index=len(drafts), context=context, content=piece.strip()))
    return drafts


def embedding_input(draft: ChunkDraft) -> str:
    """O texto vetorizado leva o contexto antes do conteúdo."""
    return f"{draft.context}\n\n{draft.content}"


def title_from_markdown(markdown: str, fallback: str) -> str:
    """O primeiro título "# ..." do arquivo, ou o fallback (ex.: o nome do arquivo)."""
    for line in markdown.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback
