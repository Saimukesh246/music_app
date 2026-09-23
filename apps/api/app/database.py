import os
import re
import sqlite3
from pathlib import Path
from typing import Any, Iterator

from dotenv import load_dotenv

# Automatically load .env if present (e.g. apps/api/.env or current working dir)
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

SCHEMA_SQLITE = """
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

SCHEMA_POSTGRES = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artists (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS albums (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id INTEGER NOT NULL REFERENCES artists(id),
    release_date TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id INTEGER NOT NULL REFERENCES artists(id),
    album_id INTEGER NOT NULL REFERENCES albums(id),
    duration_sec REAL NOT NULL,
    file_path TEXT
);

CREATE TABLE IF NOT EXISTS playlists (
    id SERIAL PRIMARY KEY,
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
    id SERIAL PRIMARY KEY,
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

TABLES_WITH_ID = {"users", "artists", "albums", "tracks", "playlists", "play_history"}
_pg_schema_initialized = False


class Row:
    """A dictionary- and tuple-accessible Row wrapper for PostgreSQL query results."""

    def __init__(self, description: Any, tuple_data: tuple):
        self._keys = [d.name for d in description] if description else []
        clean_values = [
            v.isoformat() if hasattr(v, "isoformat") else v
            for v in (tuple_data or ())
        ]
        self._dict = dict(zip(self._keys, clean_values)) if description else {}
        self._tuple = tuple(clean_values)

    def __getitem__(self, item: Any) -> Any:
        if isinstance(item, int):
            return self._tuple[item]
        return self._dict[item]

    def get(self, key: str, default: Any = None) -> Any:
        return self._dict.get(key, default)

    def keys(self):
        return self._keys

    def values(self):
        return self._dict.values()

    def items(self):
        return self._dict.items()

    def __iter__(self):
        return iter(self._keys)

    def __len__(self) -> int:
        return len(self._tuple)

    def __repr__(self) -> str:
        return repr(self._dict)


def _translate_sql(sql: str) -> str:
    """Translates SQLite-style SQL to PostgreSQL syntax."""
    translated = sql.replace("?", "%s")

    if re.search(r"INSERT\s+OR\s+IGNORE\s+INTO", translated, flags=re.IGNORECASE):
        translated = re.sub(
            r"INSERT\s+OR\s+IGNORE\s+INTO", "INSERT INTO", translated, flags=re.IGNORECASE
        )
        translated = translated.rstrip().rstrip(";") + " ON CONFLICT DO NOTHING"

    return translated


class PGCursorWrapper:
    """Cursor wrapper that translates SQLite idioms (question marks, lastrowid, Row access) for psycopg."""

    def __init__(self, raw_cursor: Any):
        self._cur = raw_cursor
        self.lastrowid: int | None = None

    def execute(self, sql: str, params: Any = None) -> "PGCursorWrapper":
        translated = _translate_sql(sql)

        m = re.search(r"^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)", translated, flags=re.IGNORECASE)
        table = m.group(1).lower() if m else None
        if (
            table in TABLES_WITH_ID
            and "RETURNING" not in translated.upper()
            and "ON CONFLICT DO NOTHING" not in translated.upper()
        ):
            translated_with_ret = translated.rstrip().rstrip(";") + " RETURNING id"
            self._cur.execute(translated_with_ret, params or ())
            res = self._cur.fetchone()
            if res:
                self.lastrowid = res[0]
            return self

        self._cur.execute(translated, params or ())
        return self

    def fetchone(self) -> Row | None:
        if not self._cur.description:
            return None
        res = self._cur.fetchone()
        return Row(self._cur.description, res) if res is not None else None

    def fetchall(self) -> list[Row]:
        if not self._cur.description:
            return []
        rows = self._cur.fetchall()
        return [Row(self._cur.description, r) for r in rows]

    def close(self) -> None:
        self._cur.close()


class PGConnectionWrapper:
    """Connection wrapper conforming to standard DB-API / sqlite3 interface for FastAPI routers."""

    def __init__(self, raw_conn: Any):
        self._conn = raw_conn

    def cursor(self) -> PGCursorWrapper:
        return PGCursorWrapper(self._conn.cursor())

    def execute(self, sql: str, params: Any = None) -> PGCursorWrapper:
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def close(self) -> None:
        self._conn.close()


def get_db_url() -> str | None:
    url = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL")
    if not url:
        return None
    return url.split("?")[0]


def is_postgres_configured() -> bool:
    if os.environ.get("AURA_DB_PATH"):
        return False
    return get_db_url() is not None


def get_sqlite_connection() -> sqlite3.Connection:
    db_path = os.environ.get("AURA_DB_PATH", "aura.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQLITE)
    return conn


def get_postgres_connection() -> PGConnectionWrapper:
    global _pg_schema_initialized
    import psycopg

    url = get_db_url()
    raw_conn = psycopg.connect(url, autocommit=False)
    if not _pg_schema_initialized:
        with raw_conn.cursor() as cur:
            cur.execute(SCHEMA_POSTGRES)
        raw_conn.commit()
        _pg_schema_initialized = True
    return PGConnectionWrapper(raw_conn)


def get_connection():
    if is_postgres_configured():
        return get_postgres_connection()
    return get_sqlite_connection()


def get_db() -> Iterator[Any]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
