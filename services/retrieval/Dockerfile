# Etapa 1: instala as dependências num ambiente virtual (.venv) com o uv
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /bin/uv
# Compila para bytecode na instalação (início mais rápido) e usa o Python da imagem, sem baixar outro
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app

# Só as dependências primeiro: esta camada fica em cache enquanto o uv.lock não mudar
# (o mesmo truque de copiar o package.json antes do src no Dockerfile do Node)
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Agora o código do serviço. --no-editable copia o pacote para dentro do .venv,
# assim a imagem final não precisa da pasta src
COPY README.md ./
COPY src ./src
RUN uv sync --locked --no-dev --no-editable

# Etapa 2: imagem final só com o .venv e os arquivos usados na inicialização (sem o uv)
FROM python:3.12-slim
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
WORKDIR /app

# Não roda como root dentro do container. O usuário é criado antes dos COPY para que os arquivos
# já entrem com ele como dono (--chown): o COPY mantém as permissões da máquina de quem faz o build,
# e um arquivo 600 (só o dono lê) ficaria ilegível para o usuário app
RUN useradd --system --no-create-home app

COPY --from=build --chown=app:app /app/.venv ./.venv
COPY --chown=app:app alembic.ini docker-entrypoint.sh ./
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app data ./data

USER app
EXPOSE 8000
CMD ["sh", "docker-entrypoint.sh"]
