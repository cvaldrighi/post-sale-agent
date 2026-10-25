from fastapi.testclient import TestClient

from .conftest import AUTH


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_search_requires_the_api_key(client: TestClient) -> None:
    response = client.post("/search", json={"query": "estorno"})

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["code"] == "unauthorized"


def test_ingestion_requires_the_api_key_and_writes_nothing(client: TestClient) -> None:
    response = client.post(
        "/documents",
        headers={"x-api-key": "wrong-key-0123456789"},
        json={"source": "x", "title": "X", "content": "# X\n\nTexto."},
    )

    assert response.status_code == 401
    assert client.post("/search", headers=AUTH, json={"query": "Texto"}).json() == {"results": []}


def test_echoes_the_correlation_id(client: TestClient) -> None:
    response = client.get("/health", headers={"x-correlation-id": "abc-123"})

    assert response.headers["x-correlation-id"] == "abc-123"


def test_replaces_an_invalid_correlation_id(client: TestClient) -> None:
    response = client.get("/health", headers={"x-correlation-id": "abc 123 {bad}"})

    assert response.headers["x-correlation-id"] != "abc 123 {bad}"


def test_validation_errors_are_problem_json_with_400(client: TestClient) -> None:
    response = client.post("/search", headers=AUTH, json={"query": ""})

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_unknown_routes_are_problem_json(client: TestClient) -> None:
    response = client.get("/nope")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
