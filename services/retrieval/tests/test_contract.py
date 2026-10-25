from retrieval.export_openapi import CONTRACT_FILE, build_contract


def test_the_versioned_contract_matches_the_code() -> None:
    assert CONTRACT_FILE.exists(), "Gere o contrato: uv run python -m retrieval.export_openapi"
    assert CONTRACT_FILE.read_text(encoding="utf-8") == build_contract(), (
        "contracts/retrieval.json está desatualizado. Rode: uv run python -m retrieval.export_openapi"
    )
