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
