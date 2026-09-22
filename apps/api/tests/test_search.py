from tests.test_catalog import seed_track


def test_search_matches_track_title(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    response = client.get("/search", params={"q": "Low Tide"}, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert any(t["title"] == "Low Tide" for t in body["tracks"])


def test_search_matches_artist_name(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    response = client.get("/search", params={"q": "Nocturne"}, headers=auth_headers)
    assert any(a["name"] == "Nocturne Field" for a in response.json()["artists"])


def test_search_matches_album_title(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    response = client.get("/search", params={"q": "Archive"}, headers=auth_headers)
    assert any(a["title"] == "Low Tide Archive" for a in response.json()["albums"])


def test_search_returns_empty_results_for_no_match(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    response = client.get("/search", params={"q": "nonexistent-xyz"}, headers=auth_headers)
    body = response.json()
    assert body == {"artists": [], "albums": [], "tracks": []}


def test_search_requires_auth(client):
    response = client.get("/search", params={"q": "x"})
    assert response.status_code == 401
