"""Serviço retrieval: busca semântica nas políticas da loja."""


def main() -> None:
    """Sobe o servidor HTTP (comando `retrieval`, definido no pyproject.toml)."""
    import uvicorn

    from .config import get_settings

    uvicorn.run("retrieval.app:create_app", factory=True, host="0.0.0.0", port=get_settings().port)
