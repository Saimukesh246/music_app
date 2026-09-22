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
