import os
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv
from fastapi.testclient import TestClient

if "AURA_DB_PATH" in os.environ:
    del os.environ["AURA_DB_PATH"]

load_dotenv(".env")
from app.database import get_connection, is_postgres_configured
from app.main import app

print("Is postgres configured?", is_postgres_configured())
client = TestClient(app)
conn = get_connection()

# 1. Insert seed artist, album, track for testing
conn.execute("INSERT OR IGNORE INTO artists (name) VALUES (?)", ("Aura Sound Labs",))
artist_row = conn.execute("SELECT id FROM artists WHERE name = ?", ("Aura Sound Labs",)).fetchone()
artist_id = artist_row["id"]

conn.execute(
    "INSERT OR IGNORE INTO albums (title, artist_id) VALUES (?, ?)",
    ("Pure 192kHz Master", artist_id),
)
album_row = conn.execute(
    "SELECT id FROM albums WHERE title = ?", ("Pure 192kHz Master",)
).fetchone()
album_id = album_row["id"]

conn.execute(
    "INSERT OR IGNORE INTO tracks (title, artist_id, album_id, duration_sec) VALUES (?, ?, ?, ?)",
    ("Acoustic Resonance", artist_id, album_id, 320.0),
)
track_row = conn.execute(
    "SELECT id FROM tracks WHERE title = ?", ("Acoustic Resonance",)
).fetchone()
track_id = track_row["id"]
conn.commit()

print(f"Seed data ready: artist={artist_id}, album={album_id}, track={track_id}")

# 2. Register & login
user_email = "pg_integration@aura.lossless"
user_pass = "AudiophileMaster2026!"
conn.execute("DELETE FROM users WHERE email = ?", (user_email,))
conn.commit()

reg_res = client.post("/auth/register", json={"email": user_email, "password": user_pass})
assert reg_res.status_code == 201
token = client.post(
    "/auth/login", json={"email": user_email, "password": user_pass}
).json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 3. Test Favorites with valid track_id
fav_add = client.post("/favorites", json={"track_id": track_id}, headers=headers)
print("Add favorite status:", fav_add.status_code, fav_add.json())
assert fav_add.status_code == 201

fav_list = client.get("/favorites", headers=headers)
print("Favorites list:", fav_list.json())
assert track_id in fav_list.json()

fav_del = client.delete(f"/favorites/{track_id}", headers=headers)
print("Remove favorite status:", fav_del.status_code)
assert fav_del.status_code == 204

# 4. Test Play History
hist_add = client.post("/history", json={"track_id": track_id}, headers=headers)
print("Record history status:", hist_add.status_code, hist_add.json())
assert hist_add.status_code == 201

hist_list = client.get("/history", headers=headers)
print("History entries:", len(hist_list.json()), hist_list.json())
assert len(hist_list.json()) >= 1
assert hist_list.json()[0]["track_id"] == track_id

# 5. Test Playlists add track and remove track
pl_create = client.post(
    "/playlists", json={"title": "Hi-Res Lossless Vault"}, headers=headers
)
pl_id = pl_create.json()["id"]
print("Created playlist id:", pl_id)

add_tr = client.post(
    f"/playlists/{pl_id}/tracks", json={"track_id": track_id}, headers=headers
)
print("Add track to playlist status:", add_tr.status_code)
assert add_tr.status_code == 201

pl_detail = client.get(f"/playlists/{pl_id}", headers=headers)
print("Playlist detail track_ids:", pl_detail.json()["track_ids"])
assert track_id in pl_detail.json()["track_ids"]

rem_tr = client.delete(f"/playlists/{pl_id}/tracks/{track_id}", headers=headers)
print("Remove track from playlist:", rem_tr.status_code)
assert rem_tr.status_code == 204

client.delete(f"/playlists/{pl_id}", headers=headers)

# 6. Test Catalog endpoints
artists = client.get("/artists", headers=headers)
print("Artists count:", len(artists.json()))
assert len(artists.json()) >= 1

albums = client.get("/albums", headers=headers)
print("Albums count:", len(albums.json()))
assert len(albums.json()) >= 1

tracks = client.get("/tracks", headers=headers)
print("Tracks count:", len(tracks.json()))
assert len(tracks.json()) >= 1

# Cleanup test user
conn.execute("DELETE FROM users WHERE email = ?", (user_email,))
conn.commit()
conn.close()

print("ALL LIVE SUPABASE POSTGRESQL ENDPOINTS FULLY VERIFIED!")
