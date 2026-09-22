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
