from typing import Optional

from pydantic import BaseModel


class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ArtistOut(BaseModel):
    id: int
    name: str


class AlbumOut(BaseModel):
    id: int
    title: str
    artist_id: int
    artist_name: str
    release_date: Optional[str] = None


class TrackOut(BaseModel):
    id: int
    title: str
    artist_id: int
    artist_name: str
    album_id: int
    album_title: str
    duration_sec: float


class SearchResults(BaseModel):
    artists: list[ArtistOut]
    albums: list[AlbumOut]
    tracks: list[TrackOut]


class PlaylistCreate(BaseModel):
    title: str


class PlaylistOut(BaseModel):
    id: int
    title: str
    track_ids: list[int]


class PlaylistTrackAdd(BaseModel):
    track_id: int


class FavoriteAdd(BaseModel):
    track_id: int


class HistoryEntryCreate(BaseModel):
    track_id: int


class HistoryEntryOut(BaseModel):
    id: int
    track_id: int
    played_at: str


class LyricsOut(BaseModel):
    track_id: int
    plain_lyrics: Optional[str] = None
    synced_lyrics: Optional[str] = None
    available: bool
