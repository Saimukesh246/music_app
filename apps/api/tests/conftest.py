import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("AURA_DB_PATH", str(db_path))
    from app.main import app

    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    client.post("/auth/register", json={"email": "test@example.com", "password": "hunter2pass"})
    response = client.post("/auth/login", json={"email": "test@example.com", "password": "hunter2pass"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
