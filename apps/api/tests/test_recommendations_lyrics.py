import sqlite3

from tests.test_catalog import seed_track


def test_recommendations_same_artist_as_seed(client, auth_headers, tmp_path):
    db_path = tmp_path / "test.db"
    seed_track(db_path, title="Low Tide", artist="Nocturne Field", album="Low Tide Archive")
    seed_track(db_path, title="Archive Room", artist="Nocturne Field", album="Low Tide Archive")
    tracks = client.get("/tracks", headers=auth_headers).json()
    seed_id = next(t["id"] for t in tracks if t["title"] == "Low Tide")

    response = client.get(
        "/recommendations", params={"seed_track_id": seed_id}, headers=auth_headers
    )
    assert response.status_code == 200
    titles = [t["title"] for t in response.json()]
    assert "Archive Room" in titles
    assert "Low Tide" not in titles  # never recommends the seed itself


def test_recommendations_fall_back_to_most_favorited_with_no_seed(client, auth_headers, tmp_path):
    db_path = tmp_path / "test.db"
    seed_track(db_path, title="Low Tide", artist="Nocturne Field", album="Low Tide Archive")
    track_id = client.get("/tracks", headers=auth_headers).json()[0]["id"]
    client.post("/favorites", json={"track_id": track_id}, headers=auth_headers)

    response = client.get("/recommendations", headers=auth_headers)
    assert response.status_code == 200
    assert any(t["id"] == track_id for t in response.json())


def test_recommendations_require_auth(client):
    assert client.get("/recommendations").status_code == 401


def test_lyrics_not_available_when_uncached(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    track_id = client.get("/tracks", headers=auth_headers).json()[0]["id"]
    response = client.get(f"/lyrics/{track_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["available"] is False


def test_lyrics_available_when_cached(client, auth_headers, tmp_path):
    db_path = tmp_path / "test.db"
    seed_track(db_path)
    track_id = client.get("/tracks", headers=auth_headers).json()[0]["id"]
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO lyrics (track_id, plain_lyrics) VALUES (?, ?)", (track_id, "La la la")
    )
    conn.commit()
    conn.close()

    response = client.get(f"/lyrics/{track_id}", headers=auth_headers)
    body = response.json()
    assert body["available"] is True
    assert body["plain_lyrics"] == "La la la"


def test_lyrics_require_auth(client):
    assert client.get("/lyrics/1").status_code == 401
