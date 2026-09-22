# AURA Phase 4 Implementation Plan — Standalone FastAPI Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A real, tested, locally-runnable FastAPI backend in `apps/api` —
self-contained auth, artists/albums/tracks/search/playlists/favorites/
history/recommendations/lyrics/streaming endpoints, plain `sqlite3` — with
no cloud hosting and no mobile app wiring.

**Architecture:** FastAPI app with one router module per resource, plain
`sqlite3` (no ORM) via a per-request connection dependency, Pydantic models
for request/response validation, self-contained JWT auth (`PyJWT` +
`pbkdf2_hmac` password hashing, no third-party identity provider). Every
router is tested with `pytest` + FastAPI's `TestClient` against a fresh
temporary SQLite file per test.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, `PyJWT`, `uvicorn`,
`pytest`, `httpx` (required by `TestClient`).

## Global Constraints

- No ORM — plain `sqlite3` from the standard library, matching the "simplest
  maintainable solution" principle and the mobile app's own choice (Phase
  2a used `expo-sqlite` directly).
- No cloud hosting, no external auth provider, no mobile app changes. This
  backend runs via `uvicorn app.main:app` on the developer's own machine
  only.
- Every endpoint except `POST /auth/register` and `POST /auth/login`
  requires a valid `Authorization: Bearer <token>` header.
- `/recommendations` and `/lyrics` use simple, honest, locally-computed
  logic — no re-integration of MusicBrainz/Cover Art Archive/LRCLIB/
  ReccoBeats (already handled client-side in Phase 3). The recommendations
  response is explicitly a simpler algorithm than the mobile app's Phase 3c
  recommender, not dressed up as equivalent.
- `/stream/{track_id}` honors HTTP `Range` headers and never reads a whole
  file into memory — streamed via `StreamingResponse` in chunks.
- Passwords are never logged, never returned in any response, and stored
  only as a salted `pbkdf2_hmac` hash.

---

## File Structure

```
apps/api/
├── requirements.txt
├── README.md
├── pytest.ini
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── database.py
│   ├── core/
│   │   ├── __init__.py
│   │   └── security.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py
│   └── routers/
│       ├── __init__.py
│       ├── auth.py
│       ├── catalog.py          (artists, albums, tracks)
│       ├── search.py
│       ├── playlists.py
│       ├── favorites.py
│       ├── history.py
│       ├── recommendations.py
│       ├── lyrics.py
│       └── stream.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_health.py
    ├── test_security.py
    ├── test_auth.py
    ├── test_catalog.py
    ├── test_search.py
    ├── test_playlists.py
    ├── test_favorites_history.py
    ├── test_recommendations_lyrics.py
    └── test_stream.py
```

---

### Task 1: Project scaffold, schema, and health check (TDD)

**Files:**
- Create: `apps/api/requirements.txt`
- Create: `apps/api/pytest.ini`
- Create: `apps/api/app/__init__.py`
- Create: `apps/api/app/database.py`
- Create: `apps/api/app/main.py`
- Create: `apps/api/tests/__init__.py`
- Create: `apps/api/tests/conftest.py`
- Create: `apps/api/tests/test_health.py`

**Interfaces:**
- Produces: `get_db_path()`, `get_connection()`, `get_db()` (FastAPI
  dependency) in `database.py`; the `app` FastAPI instance in `main.py`; the
  `client` pytest fixture in `conftest.py` (a `TestClient` pointed at a
  fresh temp-file database), consumed by every later task's tests.

- [x] **Step 1: Create `apps/api/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
pydantic==2.9.2
PyJWT==2.9.0
httpx==0.27.2
pytest==8.3.3
```

- [x] **Step 2: Create `apps/api/pytest.ini`**

```ini
[pytest]
testpaths = tests
```

- [x] **Step 3: Install dependencies**

Run:
```bash
cd apps/api
pip install -r requirements.txt
```
Expected: installs without error.

- [x] **Step 4: Create `apps/api/app/__init__.py`** (empty file, makes `app` a package)

- [x] **Step 5: Write `apps/api/app/database.py`**

```python
import os
import sqlite3

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist_id INTEGER NOT NULL REFERENCES artists(id),
    release_date TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist_id INTEGER NOT NULL REFERENCES artists(id),
    album_id INTEGER NOT NULL REFERENCES albums(id),
    duration_sec REAL NOT NULL,
    file_path TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL REFERENCES playlists(id),
    track_id INTEGER NOT NULL REFERENCES tracks(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(id),
    track_id INTEGER NOT NULL REFERENCES tracks(id),
    PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    track_id INTEGER NOT NULL REFERENCES tracks(id),
    played_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lyrics (
    track_id INTEGER PRIMARY KEY REFERENCES tracks(id),
    plain_lyrics TEXT,
    synced_lyrics TEXT
);
"""


def get_db_path() -> str:
    return os.environ.get("AURA_DB_PATH", "aura.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
```

- [x] **Step 6: Write `apps/api/app/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="AURA API")


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [x] **Step 7: Create `apps/api/tests/__init__.py`** (empty file)

- [x] **Step 8: Write `apps/api/tests/conftest.py`**

```python
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
```

- [x] **Step 9: Write the failing test**

```python
# apps/api/tests/test_health.py
def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [x] **Step 10: Run to verify it passes**

Run (from `apps/api`):
```bash
python -m pytest tests/test_health.py -v
```
Expected: PASS (1 test). (This test doesn't exercise auth yet, so it should
pass immediately — it exists to prove the scaffold, fixture, and app wiring
all work before later tasks build on them.)

- [x] **Step 11: Commit**

```bash
git add apps/api/requirements.txt apps/api/pytest.ini apps/api/app apps/api/tests
git commit -m "chore(api): scaffold FastAPI project with sqlite schema and test fixtures"
```

---

### Task 2: `core/security.py` — password hashing and JWT (TDD)

**Files:**
- Create: `apps/api/app/core/__init__.py`
- Create: `apps/api/app/core/security.py`
- Create: `apps/api/tests/test_security.py`

**Interfaces:**
- Produces: `hash_password(password: str) -> tuple[str, str]` (hash, salt),
  `verify_password(password: str, password_hash: str, salt: str) -> bool`,
  `create_access_token(user_id: int) -> str`,
  `decode_access_token(token: str) -> int | None`. Consumed by the `auth`
  router (Task 3) and the shared auth dependency used by every other router.

- [x] **Step 1: Create `apps/api/app/core/__init__.py`** (empty file)

- [x] **Step 2: Write the failing test**

```python
# apps/api/tests/test_security.py
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_verify_password_accepts_the_correct_password():
    password_hash, salt = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", password_hash, salt) is True


def test_verify_password_rejects_the_wrong_password():
    password_hash, salt = hash_password("correct horse battery staple")
    assert verify_password("wrong password", password_hash, salt) is False


def test_hash_password_uses_a_different_salt_each_time():
    hash_a, salt_a = hash_password("same password")
    hash_b, salt_b = hash_password("same password")
    assert salt_a != salt_b
    assert hash_a != hash_b


def test_access_token_round_trips_the_user_id():
    token = create_access_token(user_id=42)
    assert decode_access_token(token) == 42


def test_decode_access_token_returns_none_for_a_garbage_token():
    assert decode_access_token("not-a-real-token") is None
```

- [x] **Step 3: Run to verify it fails**

Run: `python -m pytest tests/test_security.py -v`
Expected: FAIL — cannot import `app.core.security`.

- [x] **Step 4: Write `apps/api/app/core/security.py`**

```python
import hashlib
import hmac
import os
import time

import jwt

SECRET_KEY = os.environ.get("AURA_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
PBKDF2_ITERATIONS = 100_000
TOKEN_LIFETIME_SEC = 3600


def hash_password(password: str) -> tuple[str, str]:
    salt = os.urandom(16).hex()
    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return password_hash, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return hmac.compare_digest(candidate, password_hash)


def create_access_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": int(time.time()) + TOKEN_LIFETIME_SEC}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except jwt.PyJWTError:
        return None
```

- [x] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_security.py -v`
Expected: PASS (5 tests).

- [x] **Step 6: Commit**

```bash
git add apps/api/app/core apps/api/tests/test_security.py
git commit -m "feat(api): add password hashing and JWT helpers"
```

---

### Task 3: Auth router and shared auth dependency (TDD)

**Files:**
- Create: `apps/api/app/models/__init__.py`
- Create: `apps/api/app/models/schemas.py`
- Create: `apps/api/app/routers/__init__.py`
- Create: `apps/api/app/routers/auth.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_auth.py`

**Interfaces:**
- Consumes: `hash_password`, `verify_password`, `create_access_token`,
  `decode_access_token` (Task 2); `get_db` (Task 1).
- Produces: `require_user_id` (a FastAPI dependency raising 401 on a
  missing/invalid token, otherwise returning the authenticated user's ID),
  exported from `auth.py`. Consumed by every other router (Tasks 4-9).

- [x] **Step 1: Create `apps/api/app/models/__init__.py`** (empty file)

- [x] **Step 2: Write `apps/api/app/models/schemas.py`**

```python
from typing import Optional

from pydantic import BaseModel


class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ArtistOut(BaseModel):
    id: int
    name: str


class AlbumOut(BaseModel):
    id: int
    title: str
    artist_id: int
    artist_name: str
    release_date: Optional[str] = None


class TrackOut(BaseModel):
    id: int
    title: str
    artist_id: int
    artist_name: str
    album_id: int
    album_title: str
    duration_sec: float


class SearchResults(BaseModel):
    artists: list[ArtistOut]
    albums: list[AlbumOut]
    tracks: list[TrackOut]


class PlaylistCreate(BaseModel):
    title: str


class PlaylistOut(BaseModel):
    id: int
    title: str
    track_ids: list[int]


class PlaylistTrackAdd(BaseModel):
    track_id: int


class FavoriteAdd(BaseModel):
    track_id: int


class HistoryEntryCreate(BaseModel):
    track_id: int


class HistoryEntryOut(BaseModel):
    id: int
    track_id: int
    played_at: str


class LyricsOut(BaseModel):
    track_id: int
    plain_lyrics: Optional[str] = None
    synced_lyrics: Optional[str] = None
    available: bool
```

- [x] **Step 3: Create `apps/api/app/routers/__init__.py`** (empty file)

- [x] **Step 4: Write the failing test**

```python
# apps/api/tests/test_auth.py
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
```

Note: `test_protected_endpoint_*` tests reference `GET /artists`, which
Task 4 creates. They're written here because they test auth's *enforcement*,
not the catalog endpoint's own behavior — run them again after Task 4 to
confirm, but they are expected to fail with a 404 (route not found) until
then, not a 401/200 mismatch. If running this file in isolation before Task
4 exists, skip those three by running only the first four with
`-k "not protected_endpoint"`.

- [x] **Step 5: Run the first four tests to verify they fail**

Run: `python -m pytest tests/test_auth.py -v -k "not protected_endpoint"`
Expected: FAIL — no `/auth/register` or `/auth/login` route exists yet.

- [x] **Step 6: Write `apps/api/app/routers/auth.py`**

```python
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.schemas import TokenResponse, UserLogin, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(body: UserRegister, db: sqlite3.Connection = Depends(get_db)):
    existing = db.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash, salt = hash_password(body.password)
    db.execute(
        "INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)",
        (body.email, password_hash, salt),
    )
    return {"status": "registered"}


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, password_hash, password_salt FROM users WHERE email = ?", (body.email,)
    ).fetchone()
    if not row or not verify_password(body.password, row["password_hash"], row["password_salt"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=row["id"])
    return TokenResponse(access_token=token)


def require_user_id(authorization: str = Header(default="")) -> int:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    user_id = decode_access_token(authorization.removeprefix("Bearer "))
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user_id
```

- [x] **Step 7: Register the router in `apps/api/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth

app = FastAPI(title="AURA API")
app.include_router(auth.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [x] **Step 8: Run to verify the first four tests pass**

Run: `python -m pytest tests/test_auth.py -v -k "not protected_endpoint"`
Expected: PASS (4 tests). The three `protected_endpoint` tests still fail
with a 404 until Task 4 adds `/artists` — that's expected at this point.

- [x] **Step 9: Commit**

```bash
git add apps/api/app/models apps/api/app/routers/__init__.py apps/api/app/routers/auth.py apps/api/app/main.py apps/api/tests/test_auth.py
git commit -m "feat(api): add self-contained email/password auth with JWT"
```

---

### Task 4: Catalog router — artists, albums, tracks (TDD)

**Files:**
- Create: `apps/api/app/routers/catalog.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_catalog.py`

**Interfaces:**
- Consumes: `require_user_id` (Task 3); `get_db` (Task 1); `ArtistOut`,
  `AlbumOut`, `TrackOut` (Task 3).
- Produces: `GET /artists`, `GET /artists/{id}`, `GET /albums`,
  `GET /albums/{id}`, `GET /tracks`, `GET /tracks/{id}`. Consumed by
  `search.py` (Task 5) as the pattern to follow for reading the same tables.

- [x] **Step 1: Write the failing test**

```python
# apps/api/tests/test_catalog.py
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
```

- [x] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_catalog.py -v`
Expected: FAIL — 404s for routes that don't exist yet (not the intentional
404-for-missing-ID tests, but "no such route at all").

- [x] **Step 3: Write `apps/api/app/routers/catalog.py`**

```python
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import AlbumOut, ArtistOut, TrackOut
from app.routers.auth import require_user_id

router = APIRouter(dependencies=[Depends(require_user_id)])


@router.get("/artists", response_model=list[ArtistOut])
def list_artists(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("SELECT id, name FROM artists ORDER BY name").fetchall()
    return [ArtistOut(id=row["id"], name=row["name"]) for row in rows]


@router.get("/artists/{artist_id}", response_model=ArtistOut)
def get_artist(artist_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT id, name FROM artists WHERE id = ?", (artist_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Artist not found")
    return ArtistOut(id=row["id"], name=row["name"])


ALBUM_SELECT = """
SELECT albums.id, albums.title, albums.artist_id, albums.release_date,
       artists.name AS artist_name
FROM albums JOIN artists ON artists.id = albums.artist_id
"""


@router.get("/albums", response_model=list[AlbumOut])
def list_albums(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(f"{ALBUM_SELECT} ORDER BY albums.title").fetchall()
    return [AlbumOut(**dict(row)) for row in rows]


@router.get("/albums/{album_id}", response_model=AlbumOut)
def get_album(album_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(f"{ALBUM_SELECT} WHERE albums.id = ?", (album_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Album not found")
    return AlbumOut(**dict(row))


TRACK_SELECT = """
SELECT tracks.id, tracks.title, tracks.artist_id, tracks.album_id, tracks.duration_sec,
       artists.name AS artist_name, albums.title AS album_title
FROM tracks
JOIN artists ON artists.id = tracks.artist_id
JOIN albums  ON albums.id  = tracks.album_id
"""


@router.get("/tracks", response_model=list[TrackOut])
def list_tracks(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(f"{TRACK_SELECT} ORDER BY tracks.title").fetchall()
    return [TrackOut(**dict(row)) for row in rows]


@router.get("/tracks/{track_id}", response_model=TrackOut)
def get_track(track_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(f"{TRACK_SELECT} WHERE tracks.id = ?", (track_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Track not found")
    return TrackOut(**dict(row))
```

- [x] **Step 4: Register the router in `apps/api/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth, catalog

app = FastAPI(title="AURA API")
app.include_router(auth.router)
app.include_router(catalog.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [x] **Step 5: Run to verify `test_catalog.py` passes, then re-run `test_auth.py` in full**

Run: `python -m pytest tests/test_catalog.py -v`
Expected: PASS (7 tests).

Run: `python -m pytest tests/test_auth.py -v`
Expected: PASS (7 tests) — the three `protected_endpoint` tests deferred
from Task 3 now pass too, since `/artists` exists.

- [x] **Step 6: Commit**

```bash
git add apps/api/app/routers/catalog.py apps/api/app/main.py apps/api/tests/test_catalog.py
git commit -m "feat(api): add artists/albums/tracks catalog endpoints"
```

---

### Task 5: Search router (TDD)

**Files:**
- Create: `apps/api/app/routers/search.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_search.py`

**Interfaces:**
- Consumes: `require_user_id` (Task 3); `get_db` (Task 1); `SearchResults`,
  `ALBUM_SELECT`/`TRACK_SELECT` pattern from `catalog.py` (Task 4, imported
  directly rather than duplicated).
- Produces: `GET /search?q=`. No other task depends on this one.

- [x] **Step 1: Write the failing test**

```python
# apps/api/tests/test_search.py
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
```

- [x] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_search.py -v`
Expected: FAIL — no `/search` route exists yet.

- [x] **Step 3: Write `apps/api/app/routers/search.py`**

```python
import sqlite3

from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.schemas import SearchResults, ArtistOut, AlbumOut, TrackOut
from app.routers.auth import require_user_id
from app.routers.catalog import ALBUM_SELECT, TRACK_SELECT

router = APIRouter(dependencies=[Depends(require_user_id)])


@router.get("/search", response_model=SearchResults)
def search(q: str, db: sqlite3.Connection = Depends(get_db)):
    like = f"%{q}%"

    artist_rows = db.execute(
        "SELECT id, name FROM artists WHERE name LIKE ? ORDER BY name", (like,)
    ).fetchall()
    album_rows = db.execute(
        f"{ALBUM_SELECT} WHERE albums.title LIKE ? ORDER BY albums.title", (like,)
    ).fetchall()
    track_rows = db.execute(
        f"{TRACK_SELECT} WHERE tracks.title LIKE ? ORDER BY tracks.title", (like,)
    ).fetchall()

    return SearchResults(
        artists=[ArtistOut(id=row["id"], name=row["name"]) for row in artist_rows],
        albums=[AlbumOut(**dict(row)) for row in album_rows],
        tracks=[TrackOut(**dict(row)) for row in track_rows],
    )
```

- [x] **Step 4: Register the router in `apps/api/app/main.py`**

```python
from app.routers import auth, catalog, search
...
app.include_router(search.router)
```

- [x] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_search.py -v`
Expected: PASS (5 tests).

- [x] **Step 6: Commit**

```bash
git add apps/api/app/routers/search.py apps/api/app/main.py apps/api/tests/test_search.py
git commit -m "feat(api): add search across artists, albums, and tracks"
```

---

### Task 6: Playlists router (TDD)

**Files:**
- Create: `apps/api/app/routers/playlists.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_playlists.py`

**Interfaces:**
- Consumes: `require_user_id` (Task 3); `get_db` (Task 1); `PlaylistCreate`,
  `PlaylistOut`, `PlaylistTrackAdd` (Task 3).
- Produces: `GET /playlists`, `POST /playlists`, `GET /playlists/{id}`,
  `DELETE /playlists/{id}`, `POST /playlists/{id}/tracks`,
  `DELETE /playlists/{id}/tracks/{track_id}`. No other task depends on this
  one.

- [x] **Step 1: Write the failing test**

```python
# apps/api/tests/test_playlists.py
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
```

- [x] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_playlists.py -v`
Expected: FAIL — no `/playlists` routes exist yet.

- [x] **Step 3: Write `apps/api/app/routers/playlists.py`**

```python
import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import PlaylistCreate, PlaylistOut, PlaylistTrackAdd
from app.routers.auth import require_user_id

router = APIRouter(prefix="/playlists", tags=["playlists"])


def _playlist_out(db: sqlite3.Connection, playlist_id: int) -> PlaylistOut | None:
    row = db.execute("SELECT id, title FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
    if not row:
        return None
    track_rows = db.execute(
        "SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
        (playlist_id,),
    ).fetchall()
    return PlaylistOut(id=row["id"], title=row["title"], track_ids=[r["track_id"] for r in track_rows])


@router.get("", response_model=list[PlaylistOut])
def list_playlists(
    user_id: int = Depends(require_user_id), db: sqlite3.Connection = Depends(get_db)
):
    rows = db.execute("SELECT id FROM playlists WHERE user_id = ? ORDER BY id", (user_id,)).fetchall()
    return [_playlist_out(db, row["id"]) for row in rows]


@router.post("", response_model=PlaylistOut, status_code=201)
def create_playlist(
    body: PlaylistCreate,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    cursor = db.execute(
        "INSERT INTO playlists (user_id, title) VALUES (?, ?)", (user_id, body.title)
    )
    return _playlist_out(db, cursor.lastrowid)


@router.get("/{playlist_id}", response_model=PlaylistOut)
def get_playlist(
    playlist_id: int,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    playlist = _playlist_out(db, playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(
    playlist_id: int,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    if not _playlist_out(db, playlist_id):
        raise HTTPException(status_code=404, detail="Playlist not found")
    db.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,))
    db.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))


@router.post("/{playlist_id}/tracks", status_code=201)
def add_track(
    playlist_id: int,
    body: PlaylistTrackAdd,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    if not _playlist_out(db, playlist_id):
        raise HTTPException(status_code=404, detail="Playlist not found")
    next_position = db.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?",
        (playlist_id,),
    ).fetchone()[0]
    db.execute(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
        (playlist_id, body.track_id, next_position),
    )
    return {"status": "added"}


@router.delete("/{playlist_id}/tracks/{track_id}", status_code=204)
def remove_track(
    playlist_id: int,
    track_id: int,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
        (playlist_id, track_id),
    )
```

- [x] **Step 4: Register the router in `apps/api/app/main.py`**

```python
from app.routers import auth, catalog, playlists, search
...
app.include_router(playlists.router)
```

- [x] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_playlists.py -v`
Expected: PASS (5 tests).

- [x] **Step 6: Commit**

```bash
git add apps/api/app/routers/playlists.py apps/api/app/main.py apps/api/tests/test_playlists.py
git commit -m "feat(api): add playlist CRUD and track membership endpoints"
```

---

### Task 7: Favorites and history routers (TDD)

**Files:**
- Create: `apps/api/app/routers/favorites.py`
- Create: `apps/api/app/routers/history.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_favorites_history.py`

**Interfaces:**
- Consumes: `require_user_id` (Task 3); `get_db` (Task 1); `FavoriteAdd`,
  `HistoryEntryCreate`, `HistoryEntryOut` (Task 3).
- Produces: `GET /favorites`, `POST /favorites`,
  `DELETE /favorites/{track_id}`, `GET /history`, `POST /history`. Consumed
  by `recommendations.py` (Task 8), which reads `favorites` for its
  most-favorited fallback.

- [x] **Step 1: Write the failing test**

```python
# apps/api/tests/test_favorites_history.py
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
```

- [x] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_favorites_history.py -v`
Expected: FAIL — no `/favorites` or `/history` routes exist yet.

- [x] **Step 3: Write `apps/api/app/routers/favorites.py`**

```python
import sqlite3

from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.schemas import FavoriteAdd
from app.routers.auth import require_user_id

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[int])
def list_favorites(
    user_id: int = Depends(require_user_id), db: sqlite3.Connection = Depends(get_db)
):
    rows = db.execute("SELECT track_id FROM favorites WHERE user_id = ?", (user_id,)).fetchall()
    return [row["track_id"] for row in rows]


@router.post("", status_code=201)
def add_favorite(
    body: FavoriteAdd,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute(
        "INSERT OR IGNORE INTO favorites (user_id, track_id) VALUES (?, ?)",
        (user_id, body.track_id),
    )
    return {"status": "added"}


@router.delete("/{track_id}", status_code=204)
def remove_favorite(
    track_id: int,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    db.execute(
        "DELETE FROM favorites WHERE user_id = ? AND track_id = ?", (user_id, track_id)
    )
```

- [x] **Step 4: Write `apps/api/app/routers/history.py`**

```python
import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.schemas import HistoryEntryCreate, HistoryEntryOut
from app.routers.auth import require_user_id

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=list[HistoryEntryOut])
def list_history(
    user_id: int = Depends(require_user_id), db: sqlite3.Connection = Depends(get_db)
):
    rows = db.execute(
        "SELECT id, track_id, played_at FROM play_history WHERE user_id = ? ORDER BY played_at DESC",
        (user_id,),
    ).fetchall()
    return [HistoryEntryOut(**dict(row)) for row in rows]


@router.post("", status_code=201)
def record_play(
    body: HistoryEntryCreate,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    played_at = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO play_history (user_id, track_id, played_at) VALUES (?, ?, ?)",
        (user_id, body.track_id, played_at),
    )
    return {"status": "recorded"}
```

- [x] **Step 5: Register both routers in `apps/api/app/main.py`**

```python
from app.routers import auth, catalog, favorites, history, playlists, search
...
app.include_router(favorites.router)
app.include_router(history.router)
```

- [x] **Step 6: Run to verify it passes**

Run: `python -m pytest tests/test_favorites_history.py -v`
Expected: PASS (4 tests).

- [x] **Step 7: Commit**

```bash
git add apps/api/app/routers/favorites.py apps/api/app/routers/history.py apps/api/app/main.py apps/api/tests/test_favorites_history.py
git commit -m "feat(api): add favorites and play-history endpoints"
```

---

### Task 8: Recommendations and lyrics routers (TDD)

**Files:**
- Create: `apps/api/app/routers/recommendations.py`
- Create: `apps/api/app/routers/lyrics.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_recommendations_lyrics.py`

**Interfaces:**
- Consumes: `require_user_id` (Task 3); `get_db` (Task 1); `TrackOut`
  (Task 3), `TRACK_SELECT` (Task 4); `LyricsOut` (Task 3).
- Produces: `GET /recommendations?seed_track_id=`, `GET /lyrics/{track_id}`.
  No other task depends on these.

- [x] **Step 1: Write the failing test**

```python
# apps/api/tests/test_recommendations_lyrics.py
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
```

- [x] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_recommendations_lyrics.py -v`
Expected: FAIL — no `/recommendations` or `/lyrics` routes exist yet.

- [x] **Step 3: Write `apps/api/app/routers/recommendations.py`**

```python
import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.schemas import TrackOut
from app.routers.auth import require_user_id
from app.routers.catalog import TRACK_SELECT

router = APIRouter(tags=["recommendations"])

RECOMMENDATION_LIMIT = 10


@router.get("/recommendations", response_model=list[TrackOut])
def recommendations(
    seed_track_id: Optional[int] = None,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    if seed_track_id is not None:
        seed = db.execute(
            "SELECT artist_id FROM tracks WHERE id = ?", (seed_track_id,)
        ).fetchone()
        if seed:
            rows = db.execute(
                f"{TRACK_SELECT} WHERE tracks.artist_id = ? AND tracks.id != ? LIMIT ?",
                (seed["artist_id"], seed_track_id, RECOMMENDATION_LIMIT),
            ).fetchall()
            return [TrackOut(**dict(row)) for row in rows]

    rows = db.execute(
        f"""
        {TRACK_SELECT}
        JOIN (
            SELECT track_id, COUNT(*) AS favorite_count
            FROM favorites
            GROUP BY track_id
        ) fav_counts ON fav_counts.track_id = tracks.id
        ORDER BY fav_counts.favorite_count DESC
        LIMIT ?
        """,
        (RECOMMENDATION_LIMIT,),
    ).fetchall()
    return [TrackOut(**dict(row)) for row in rows]
```

- [x] **Step 4: Write `apps/api/app/routers/lyrics.py`**

```python
import sqlite3

from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.schemas import LyricsOut
from app.routers.auth import require_user_id

router = APIRouter(prefix="/lyrics", tags=["lyrics"])


@router.get("/{track_id}", response_model=LyricsOut)
def get_lyrics(
    track_id: int,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT plain_lyrics, synced_lyrics FROM lyrics WHERE track_id = ?", (track_id,)
    ).fetchone()
    if not row:
        return LyricsOut(track_id=track_id, available=False)
    return LyricsOut(
        track_id=track_id,
        plain_lyrics=row["plain_lyrics"],
        synced_lyrics=row["synced_lyrics"],
        available=True,
    )
```

- [x] **Step 5: Register both routers in `apps/api/app/main.py`**

```python
from app.routers import auth, catalog, favorites, history, lyrics, playlists, recommendations, search
...
app.include_router(recommendations.router)
app.include_router(lyrics.router)
```

- [x] **Step 6: Run to verify it passes**

Run: `python -m pytest tests/test_recommendations_lyrics.py -v`
Expected: PASS (6 tests).

- [x] **Step 7: Commit**

```bash
git add apps/api/app/routers/recommendations.py apps/api/app/routers/lyrics.py apps/api/app/main.py apps/api/tests/test_recommendations_lyrics.py
git commit -m "feat(api): add same-artist/most-favorited recommendations and cached lyrics"
```

---

### Task 9: Streaming router with range requests (TDD)

**Files:**
- Create: `apps/api/app/routers/stream.py`
- Modify: `apps/api/app/main.py`
- Create: `apps/api/tests/test_stream.py`

**Interfaces:**
- Consumes: `require_user_id` (Task 3); `get_db` (Task 1).
- Produces: `GET /stream/{track_id}`. No other task depends on this one.

- [x] **Step 1: Write the failing test**

```python
# apps/api/tests/test_stream.py
import sqlite3


def seed_track_with_file(db_path, file_path: str, content: bytes):
    with open(file_path, "wb") as f:
        f.write(content)

    conn = sqlite3.connect(db_path)
    conn.execute("INSERT INTO artists (name) VALUES ('Artist')")
    artist_id = conn.execute("SELECT id FROM artists").fetchone()[0]
    conn.execute("INSERT INTO albums (title, artist_id) VALUES ('Album', ?)", (artist_id,))
    album_id = conn.execute("SELECT id FROM albums").fetchone()[0]
    conn.execute(
        "INSERT INTO tracks (title, artist_id, album_id, duration_sec, file_path) VALUES (?, ?, ?, ?, ?)",
        ("Track", artist_id, album_id, 10.0, str(file_path)),
    )
    conn.commit()
    track_id = conn.execute("SELECT id FROM tracks").fetchone()[0]
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
```

- [x] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_stream.py -v`
Expected: FAIL — no `/stream` route exists yet.

- [x] **Step 3: Write `apps/api/app/routers/stream.py`**

```python
import os
import re
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from app.database import get_db
from app.routers.auth import require_user_id

router = APIRouter(prefix="/stream", tags=["stream"])

CHUNK_SIZE = 1024 * 64
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _iter_file(path: str, start: int, end: int):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/{track_id}")
def stream(
    track_id: int,
    request: Request,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT file_path FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if not row or not row["file_path"]:
        raise HTTPException(status_code=404, detail="Track file not found")

    file_path = row["file_path"]
    file_size = os.path.getsize(file_path)

    range_header = request.headers.get("range")
    if not range_header:
        with open(file_path, "rb") as f:
            content = f.read()
        return Response(content=content, media_type="application/octet-stream")

    match = RANGE_RE.match(range_header)
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    start = int(match.group(1)) if match.group(1) else 0
    end = int(match.group(2)) if match.group(2) else file_size - 1
    end = min(end, file_size - 1)

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
    }
    return StreamingResponse(
        _iter_file(file_path, start, end),
        status_code=206,
        media_type="application/octet-stream",
        headers=headers,
    )
```

- [x] **Step 4: Register the router in `apps/api/app/main.py`**

```python
from app.routers import auth, catalog, favorites, history, lyrics, playlists, recommendations, search, stream
...
app.include_router(stream.router)
```

- [x] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_stream.py -v`
Expected: PASS (4 tests).

- [x] **Step 6: Commit**

```bash
git add apps/api/app/routers/stream.py apps/api/app/main.py apps/api/tests/test_stream.py
git commit -m "feat(api): add range-request audio streaming"
```

---

### Task 10: Full suite run, live server smoke test, and README

**Files:**
- Create: `apps/api/README.md`

**Interfaces:** none (verification and documentation only).

- [x] **Step 1: Run the entire backend test suite**

Run (from `apps/api`): `python -m pytest -v`
Expected: PASS — every test from Tasks 1-9 (approximately 42 tests).

- [x] **Step 2: Start the server for real and smoke-test it live**

Run: `python -m uvicorn app.main:app --port 8000 &` (background), then:

```bash
curl -s http://127.0.0.1:8000/health
curl -s -X POST http://127.0.0.1:8000/auth/register -H "Content-Type: application/json" -d '{"email":"smoke@example.com","password":"testpass123"}'
curl -s -X POST http://127.0.0.1:8000/auth/login -H "Content-Type: application/json" -d '{"email":"smoke@example.com","password":"testpass123"}'
```

Expected: `{"status":"ok"}`, a 201 registration, and a response containing
`access_token`. This is the one check in this whole plan that exercises the
*actual* running process (not `TestClient`, which calls into the app
in-process) — it proves `uvicorn app.main:app` genuinely starts and serves
real HTTP, not just that the test harness can reach it.

Stop the server afterward (`kill` the background process).

- [x] **Step 3: Write `apps/api/README.md`**

```markdown
# AURA API

Standalone FastAPI backend for AURA. Runs locally only — no cloud hosting,
no external auth provider. Not currently called by the mobile app (see
`docs/superpowers/specs/2026-09-22-aura-phase4-backend-design.md`).

## Setup

\`\`\`bash
cd apps/api
pip install -r requirements.txt
\`\`\`

## Run

\`\`\`bash
python -m uvicorn app.main:app --reload
\`\`\`

Interactive API docs: http://127.0.0.1:8000/docs

## Test

\`\`\`bash
python -m pytest -v
\`\`\`

## Auth

All endpoints except `POST /auth/register` and `POST /auth/login` require
an `Authorization: Bearer <token>` header, obtained from `/auth/login`.

## Database

SQLite, path controlled by the `AURA_DB_PATH` environment variable
(defaults to `aura.db` in the working directory). Schema is created
automatically on first connection.
```

- [x] **Step 4: Commit**

```bash
git add apps/api/README.md
git commit -m "docs(api): add setup, run, and test instructions"
```

---

## Self-Review Notes

- **Spec coverage:** self-contained auth (register/login/JWT/protected
  routes) ✓ (Tasks 2-3), artists/albums/tracks ✓ (Task 4), search ✓ (Task 5),
  playlists incl. track membership ✓ (Task 6), favorites + history ✓
  (Task 7), recommendations (explicitly simpler than the mobile algorithm,
  same-artist + most-favorited fallback) + lyrics (cache-only, no LRCLIB
  re-integration) ✓ (Task 8), range-request streaming that never loads a
  whole file into memory ✓ (Task 9), live-process smoke test proving
  `uvicorn` actually runs (not just `TestClient`) ✓ (Task 10). `queue`,
  `audio_files`, `providers` tables are explicitly out of scope per the
  design doc's reasoning.
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `ALBUM_SELECT`/`TRACK_SELECT` are defined once in
  `catalog.py` (Task 4) and imported by `search.py` (Task 5) and
  `recommendations.py` (Task 8) rather than duplicated. `require_user_id` is
  defined once in `auth.py` (Task 3) and imported by every other router.
  Every router's `response_model` uses the schema classes from
  `models/schemas.py` (Task 3) consistently.
- **Test ordering dependency, called out explicitly:** Task 3's three
  `protected_endpoint` tests reference `/artists`, which doesn't exist until
  Task 4. The task's steps say exactly when to run which subset and what
  result to expect at each point, so this isn't a silent gap.
