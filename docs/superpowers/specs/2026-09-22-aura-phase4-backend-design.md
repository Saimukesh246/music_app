# AURA — Phase 4 Design: Standalone FastAPI Backend

Date: 2026-09-22
Status: Approved

## Purpose

The original spec's Phase 4 calls for a backend, auth, cloud library, and
streaming of user-owned audio. Confirmed with the user: build this as a
real, tested, locally-runnable FastAPI service — no cloud hosting, no
external auth provider, no wiring into the mobile app. The mobile app
continues exactly as it is today (direct local SQLite via `LocalProvider`),
unaffected by this work.

## Scope framing

This is a different technology stack from every phase so far (Python, not
TypeScript/React Native) and a genuinely separate deliverable: `apps/api`,
a FastAPI service a developer can run locally (`uvicorn app.main:app`)
against its own SQLite database, with its own test suite (`pytest`), proving
the backend code is real and correct on its own terms — not a mobile
feature.

## Non-goals for this slice

- Any cloud deployment or hosting decision — this runs locally only.
- Any change to the mobile app — it does not call this backend.
- Re-integrating MusicBrainz/Cover Art Archive/LRCLIB/ReccoBeats into the
  backend — those already exist client-side (Phase 3). The backend's
  `/lyrics` and `/recommendations` endpoints use simple, honest,
  locally-computed logic (see below), not a second copy of the external
  provider stack.
- PostgreSQL — the original spec allows SQLite for local development, which
  is exactly this slice's situation. Postgres becomes relevant only if/when
  real cloud deployment happens.
- OAuth / third-party identity providers — auth here is self-contained
  (email + password, hashed, JWT-issued), since it needs to work with zero
  external accounts or registrations, matching "no cloud" scope.

## Components

### 1. Project layout — `apps/api/`

```
apps/api/
├── app/
│   ├── main.py               FastAPI app, router registration
│   ├── database.py           sqlite3 connection + schema creation
│   ├── core/
│   │   └── security.py       password hashing, JWT issue/verify
│   ├── models/
│   │   └── schemas.py        Pydantic request/response models
│   └── routers/
│       ├── auth.py
│       ├── artists.py
│       ├── albums.py
│       ├── tracks.py
│       ├── search.py
│       ├── playlists.py
│       ├── favorites.py
│       ├── history.py
│       ├── recommendations.py
│       ├── lyrics.py
│       └── stream.py
├── tests/
│   └── (one test module per router)
├── requirements.txt
└── README.md
```

No ORM — plain `sqlite3` from the standard library, matching the "simplest
maintainable solution" principle the original spec itself states, and
mirroring the mobile app's own choice (Phase 2a used `expo-sqlite` directly,
no ORM either). Pydantic models handle request/response validation; FastAPI
dependency injection handles the DB connection per request.

### 2. Database schema

Tables, per the original spec's Section 24 list, scoped to what this backend
actually uses: `users`, `artists`, `albums`, `tracks`, `playlists`,
`playlist_tracks`, `favorites`, `play_history`. (`queue`, `audio_files`, and
`providers` from the original spec's full list are not needed by a
single-process local backend with no provider abstraction of its own —
`audio_files` duplicates `tracks`' `file_path`, and `providers`/`queue` are
mobile-side concerns already solved in Phase 2b's `playerStore`.)

### 3. Auth

Self-contained: `POST /auth/register` (email + password, `pbkdf2_hmac`
hashed with a random salt — no third-party crypto dependency), `POST
/auth/login` (returns a JWT via `PyJWT`, a minimal, standard dependency with
no external service). Every other endpoint except `register`/`login`
requires a valid bearer token.

### 4. Endpoints

Matching the original spec's Section 23 list:

- `GET /artists`, `GET /artists/{id}`
- `GET /albums`, `GET /albums/{id}`
- `GET /tracks`, `GET /tracks/{id}`
- `GET /search?q=` — searches tracks/albums/artists by name
- `GET /playlists`, `POST /playlists`, `GET/PUT/DELETE /playlists/{id}`,
  `POST/DELETE /playlists/{id}/tracks`
- `GET /favorites`, `POST /favorites`, `DELETE /favorites/{track_id}`
- `GET /history`, `POST /history` (records a play)
- `GET /recommendations?seed_track_id=` — same-artist / most-favorited
  fallback (see below)
- `GET /lyrics/{track_id}` — returns cached lyrics if present, otherwise a
  clear "not available" response; this backend does not call LRCLIB itself
- `GET /stream/{track_id}` — HTTP range-request streaming of a file already
  present in `audio_files`' referenced path on disk

### 5. Recommendations — honest scope

Without re-importing the mobile app's ReccoBeats-fed audio-feature pipeline
(out of scope, see above), `/recommendations` uses a simple, defensible
fallback: tracks by the same artist as the seed, or — with no seed — the
most-favorited tracks. This is explicitly a simpler algorithm than the
mobile app's local nearest-neighbor recommender from Phase 3c, and the
response says so isn't dressed up as more sophisticated than it is.

### 6. Streaming

`GET /stream/{track_id}` reads the track's file path from `audio_files`,
honors `Range` request headers (so seeking works), and streams via
FastAPI's `StreamingResponse` — never loads a whole file into memory, the
same performance principle Phase 2a's scanner already established
client-side.

## Testing

Every router gets `pytest` tests using FastAPI's `TestClient`, against a
temporary SQLite file created fresh per test session:

- Auth: register, login, wrong password rejected, protected endpoint
  rejects a missing/invalid token
- CRUD endpoints: create/read/update/delete round-trips, 404 on missing IDs
- Search: matches across tracks/albums/artists, empty query handling
- Recommendations: same-artist fallback, most-favorited fallback with no
  seed
- Lyrics: cached hit, "not available" on miss
- Streaming: range request returns a partial-content response with correct
  byte ranges

This is fully verifiable by me — a local Python backend with `pytest` has
no device dependency, unlike the mobile phases.

## Verification honesty

Unlike every mobile phase, this one has no "requires the user's device" gap
— it's a local Python process I can run, curl, and test directly. Claims
here will be backed by actual `pytest` runs and real HTTP requests against a
running instance, not device-only checklists.
