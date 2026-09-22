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
