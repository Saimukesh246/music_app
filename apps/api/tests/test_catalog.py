import sqlite3


def seed_track(db_path, title="Low Tide", artist="Nocturne Field", album="Low Tide Archive"):
    conn = sqlite3.connect(db_path)
    conn.execute("INSERT INTO artists (name) VALUES (?)", (artist,))
    artist_id = conn.execute("SELECT id FROM artists WHERE name = ?", (artist,)).fetchone()[0]
    conn.execute(
        "INSERT INTO albums (title, artist_id) VALUES (?, ?)", (album, artist_id)
    )
    album_id = conn.execute("SELECT id FROM albums WHERE title = ?", (album,)).fetchone()[0]
    conn.execute(
        "INSERT INTO tracks (title, artist_id, album_id, duration_sec) VALUES (?, ?, ?, ?)",
        (title, artist_id, album_id, 272.0),
    )
    conn.commit()
    conn.close()
    return artist_id, album_id


def test_list_artists(client, auth_headers, tmp_path, monkeypatch):
    seed_track(tmp_path / "test.db")
    response = client.get("/artists", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()[0]["name"] == "Nocturne Field"


def test_get_artist_by_id(client, auth_headers, tmp_path):
    artist_id, _ = seed_track(tmp_path / "test.db")
    response = client.get(f"/artists/{artist_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Nocturne Field"


def test_get_artist_404_when_missing(client, auth_headers):
    response = client.get("/artists/999", headers=auth_headers)
    assert response.status_code == 404


def test_list_albums_includes_artist_name(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    response = client.get("/albums", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()[0]["artist_name"] == "Nocturne Field"


def test_get_album_404_when_missing(client, auth_headers):
    response = client.get("/albums/999", headers=auth_headers)
    assert response.status_code == 404


def test_list_tracks_includes_artist_and_album_names(client, auth_headers, tmp_path):
    seed_track(tmp_path / "test.db")
    response = client.get("/tracks", headers=auth_headers)
    assert response.status_code == 200
    track = response.json()[0]
    assert track["title"] == "Low Tide"
    assert track["artist_name"] == "Nocturne Field"
    assert track["album_title"] == "Low Tide Archive"


def test_get_track_404_when_missing(client, auth_headers):
    response = client.get("/tracks/999", headers=auth_headers)
    assert response.status_code == 404
