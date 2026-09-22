# AURA API

Standalone FastAPI backend for AURA. Runs locally only — no cloud hosting,
no external auth provider. Not currently called by the mobile app (see
`docs/superpowers/specs/2026-09-22-aura-phase4-backend-design.md`).

## Setup

```bash
cd apps/api
pip install -r requirements.txt
```

## Run

```bash
python -m uvicorn app.main:app --reload
```

Interactive API docs: http://127.0.0.1:8000/docs

## Test

```bash
python -m pytest -v
```

## Auth

All endpoints except `POST /auth/register` and `POST /auth/login` require
an `Authorization: Bearer <token>` header, obtained from `/auth/login`.

## Database

SQLite, path controlled by the `AURA_DB_PATH` environment variable
(defaults to `aura.db` in the working directory). Schema is created
automatically on first connection.
