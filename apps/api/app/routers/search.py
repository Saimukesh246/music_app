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
