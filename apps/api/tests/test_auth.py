def test_register_then_login_returns_a_token(client):
    register = client.post(
        "/auth/register", json={"email": "a@example.com", "password": "correct-password"}
    )
    assert register.status_code == 201

    login = client.post(
        "/auth/login", json={"email": "a@example.com", "password": "correct-password"}
    )
    assert login.status_code == 200
    assert "access_token" in login.json()


def test_register_rejects_a_duplicate_email(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "pw"})
    duplicate = client.post("/auth/register", json={"email": "a@example.com", "password": "pw"})
    assert duplicate.status_code == 400


def test_login_rejects_the_wrong_password(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "correct"})
    response = client.post("/auth/login", json={"email": "a@example.com", "password": "wrong"})
    assert response.status_code == 401


def test_login_rejects_an_unknown_email(client):
    response = client.post("/auth/login", json={"email": "nobody@example.com", "password": "x"})
    assert response.status_code == 401


def test_protected_endpoint_rejects_a_missing_token(client):
    response = client.get("/artists")
    assert response.status_code == 401


def test_protected_endpoint_rejects_an_invalid_token(client):
    response = client.get("/artists", headers={"Authorization": "Bearer garbage"})
    assert response.status_code == 401


def test_protected_endpoint_accepts_a_valid_token(client, auth_headers):
    response = client.get("/artists", headers=auth_headers)
    assert response.status_code == 200
