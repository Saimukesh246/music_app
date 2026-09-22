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
