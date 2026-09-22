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
