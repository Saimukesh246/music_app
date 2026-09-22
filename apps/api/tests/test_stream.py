import sqlite3


def seed_track_with_file(db_path, file_path: str, content: bytes):
    with open(file_path, "wb") as f:
        f.write(content)

    conn = sqlite3.connect(db_path)
    conn.execute("INSERT OR IGNORE INTO artists (name) VALUES ('Artist')")
    artist_id = conn.execute("SELECT id FROM artists WHERE name = 'Artist'").fetchone()[0]
    conn.execute("INSERT OR IGNORE INTO albums (title, artist_id) VALUES ('Album', ?)", (artist_id,))
    album_id = conn.execute("SELECT id FROM albums WHERE title = 'Album'").fetchone()[0]
    conn.execute(
        "INSERT INTO tracks (title, artist_id, album_id, duration_sec, file_path) VALUES (?, ?, ?, ?, ?)",
        ("Track", artist_id, album_id, 10.0, str(file_path)),
    )
    conn.commit()
    track_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return track_id


def test_stream_full_file_without_range_header(client, auth_headers, tmp_path):
    file_path = tmp_path / "audio.bin"
    content = b"0123456789" * 100
    track_id = seed_track_with_file(tmp_path / "test.db", file_path, content)

    response = client.get(f"/stream/{track_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.content == content


def test_stream_honors_range_header(client, auth_headers, tmp_path):
    file_path = tmp_path / "audio.bin"
    content = b"0123456789" * 100
    track_id = seed_track_with_file(tmp_path / "test.db", file_path, content)

    response = client.get(
        f"/stream/{track_id}", headers={**auth_headers, "Range": "bytes=10-19"}
    )
    assert response.status_code == 206
    assert response.content == content[10:20]
    assert response.headers["Content-Range"] == f"bytes 10-19/{len(content)}"


def test_stream_404_when_track_missing(client, auth_headers):
    response = client.get("/stream/999", headers=auth_headers)
    assert response.status_code == 404


def test_stream_requires_auth(client):
    assert client.get("/stream/1").status_code == 401
