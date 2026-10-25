from retrieval.chunking import embedding_input, split_markdown, title_from_markdown

DOC = """# Política de Trocas

## Prazo para troca

A troca pode ser feita em até 30 dias.

## Como solicitar

Acesse Meus pedidos e clique em Trocar.
"""


def test_each_chunk_belongs_to_a_single_section() -> None:
    chunks = split_markdown("Política de Trocas", DOC)

    assert [c.context for c in chunks] == [
        "Política de Trocas > Prazo para troca",
        "Política de Trocas > Como solicitar",
    ]
    assert "Trocar" not in chunks[0].content
    assert "30 dias" not in chunks[1].content


def test_long_sections_are_split_without_crossing_the_section() -> None:
    long_section = "# Doc\n\n## Longa\n\n" + " ".join(f"frase {i} sobre estorno." for i in range(200))

    chunks = split_markdown("Doc", long_section, max_chars=300, overlap=50)

    assert len(chunks) > 1
    assert all(c.context == "Doc > Longa" for c in chunks)
    assert all(len(c.content) <= 300 for c in chunks)


def test_the_embedding_input_starts_with_the_context() -> None:
    chunk = split_markdown("Política de Trocas", DOC)[0]

    assert embedding_input(chunk).startswith("Política de Trocas > Prazo para troca\n\n")


def test_sections_without_text_produce_no_chunk() -> None:
    assert split_markdown("Doc", "# Doc\n\n## Vazia\n\n## Cheia\n\nTexto.") == [
        split_markdown("Doc", "# Doc\n\n## Cheia\n\nTexto.")[0]
    ]


def test_reads_the_title_from_the_first_heading() -> None:
    assert title_from_markdown(DOC, fallback="x") == "Política de Trocas"
    assert title_from_markdown("sem título", fallback="arquivo") == "arquivo"
