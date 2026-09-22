from tests.test_catalog import seed_track


def test_add_list_and_remove_favorite(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    track_id = client.get("/tracks", headers=auth_headers).json()[0]["id"]

    add = client.post("/favorites", json={"track_id": track_id}, headers=auth_headers)
    assert add.status_code == 201
    assert track_id in client.get("/favorites", headers=auth_headers).json()

    remove = client.delete(f"/favorites/{track_id}", headers=auth_headers)
    assert remove.status_code == 204
    assert track_id not in client.get("/favorites", headers=auth_headers).json()


def test_favorites_require_auth(client):
    assert client.get("/favorites").status_code == 401


def test_record_and_list_history(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    track_id = client.get("/tracks", headers=auth_headers).json()[0]["id"]

    record = client.post("/history", json={"track_id": track_id}, headers=auth_headers)
    assert record.status_code == 201

    listing = client.get("/history", headers=auth_headers)
    assert listing.status_code == 200
    assert any(entry["track_id"] == track_id for entry in listing.json())


def test_history_requires_auth(client):
    assert client.get("/history").status_code == 401
