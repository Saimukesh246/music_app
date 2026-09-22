from tests.test_catalog import seed_track


def test_create_and_list_playlists(client, auth_headers):
    create = client.post("/playlists", json={"title": "Night Drive"}, headers=auth_headers)
    assert create.status_code == 201
    playlist_id = create.json()["id"]

    listing = client.get("/playlists", headers=auth_headers)
    assert any(p["id"] == playlist_id for p in listing.json())


def test_get_playlist_404_when_missing(client, auth_headers):
    response = client.get("/playlists/999", headers=auth_headers)
    assert response.status_code == 404


def test_add_and_remove_track(client, auth_headers, tmp_path):
    _, _ = seed_track(tmp_path / "test.db")
    track_id = client.get("/tracks", headers=auth_headers).json()[0]["id"]
    playlist_id = client.post(
        "/playlists", json={"title": "Night Drive"}, headers=auth_headers
    ).json()["id"]

    add = client.post(
        f"/playlists/{playlist_id}/tracks", json={"track_id": track_id}, headers=auth_headers
    )
    assert add.status_code == 201
    assert track_id in client.get(f"/playlists/{playlist_id}", headers=auth_headers).json()["track_ids"]

    remove = client.delete(f"/playlists/{playlist_id}/tracks/{track_id}", headers=auth_headers)
    assert remove.status_code == 204
    assert track_id not in client.get(f"/playlists/{playlist_id}", headers=auth_headers).json()["track_ids"]


def test_delete_playlist(client, auth_headers):
    playlist_id = client.post(
        "/playlists", json={"title": "Temp"}, headers=auth_headers
    ).json()["id"]
    response = client.delete(f"/playlists/{playlist_id}", headers=auth_headers)
    assert response.status_code == 204
    assert client.get(f"/playlists/{playlist_id}", headers=auth_headers).status_code == 404


def test_playlists_require_auth(client):
    assert client.get("/playlists").status_code == 401
