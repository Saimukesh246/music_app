"""
Internet Archive proxy router.

Forwards search and item-metadata requests to archive.org so the mobile
app never calls the IA API directly (avoids CORS, enables server-side
caching, matches the spec's Mobile → Backend → Provider API architecture).

Both endpoints require a valid bearer token.
"""

import sqlite3
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.routers.auth import require_user_id

router = APIRouter(prefix="/ia", tags=["internet-archive"])

IA_BASE = "https://archive.org"
_HTTP_TIMEOUT = 10.0


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class IATrack(BaseModel):
    id: str
    title: str
    artist_name: str
    artwork_url: str


class IASearchResults(BaseModel):
    tracks: list[IATrack]
    total: int


class IAAudioFile(BaseModel):
    name: str
    format: str
    duration_sec: float
    bitrate_kbps: Optional[float] = None
    stream_url: str


class IAItemDetail(BaseModel):
    id: str
    title: str
    artist_name: str
    artwork_url: str
    best_audio_file: Optional[IAAudioFile] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _first_str(v: Any) -> str:
    if isinstance(v, list):
        return v[0] if v else ""
    return str(v) if v is not None else ""


def _parse_duration(length: Any) -> float:
    """Convert 'mm:ss.xx' or a plain seconds string to a float."""
    if not length:
        return 0.0
    s = str(length)
    if ":" in s:
        parts = [float(p) for p in s.split(":")]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
    try:
        return float(s)
    except ValueError:
        return 0.0


_AUDIO_RANK = {
    "flac": 0,
    "wav": 1,
    "mp3": 2,
    "vbr mp3": 2,
    "128kbps mp3": 2,
    "64kbps mp3": 2,
    "aac": 3,
    "ogg vorbis": 4,
    "ogg": 4,
}


def _pick_best_audio(files: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    audio = [
        f
        for f in files
        if f.get("name") and any(k in (f.get("format") or "").lower() for k in _AUDIO_RANK)
    ]
    if not audio:
        return None
    return sorted(audio, key=lambda f: _AUDIO_RANK.get((f.get("format") or "").lower(), 99))[0]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/search", response_model=IASearchResults)
def ia_search(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    user_id: int = Depends(require_user_id),
) -> IASearchResults:
    params = {
        "q": f"({q}) AND mediatype:(audio)",
        "fl[]": "identifier,title,creator",
        "rows": str(size),
        "page": str(page),
        "output": "json",
    }
    try:
        resp = httpx.get(f"{IA_BASE}/advancedsearch.php", params=params, timeout=_HTTP_TIMEOUT)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Internet Archive unreachable: {exc}") from exc

    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"Internet Archive returned {resp.status_code}")

    try:
        body = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Internet Archive returned invalid JSON") from exc

    docs = (body.get("response") or {}).get("docs") or []
    total = (body.get("response") or {}).get("numFound") or 0

    tracks = [
        IATrack(
            id=doc.get("identifier", ""),
            title=doc.get("title") or doc.get("identifier", ""),
            artist_name=_first_str(doc.get("creator")) or "Unknown Artist",
            artwork_url=f"{IA_BASE}/services/img/{doc.get('identifier', '')}",
        )
        for doc in docs
        if doc.get("identifier")
    ]

    return IASearchResults(tracks=tracks, total=total)


@router.get("/item/{identifier}", response_model=IAItemDetail)
def ia_item(
    identifier: str,
    user_id: int = Depends(require_user_id),
) -> IAItemDetail:
    try:
        resp = httpx.get(f"{IA_BASE}/metadata/{identifier}", timeout=_HTTP_TIMEOUT)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Internet Archive unreachable: {exc}") from exc

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail=f"Internet Archive item not found: {identifier}")
    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"Internet Archive returned {resp.status_code}")

    try:
        body = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Internet Archive returned invalid JSON") from exc

    metadata = body.get("metadata") or {}
    files: list[dict[str, Any]] = body.get("files") or []
    artist_name = _first_str(metadata.get("creator")) or "Unknown Artist"
    best = _pick_best_audio(files)

    best_audio: Optional[IAAudioFile] = None
    if best:
        best_audio = IAAudioFile(
            name=best.get("name", ""),
            format=best.get("format", "UNKNOWN"),
            duration_sec=_parse_duration(best.get("length")),
            bitrate_kbps=float(best["bitrate"]) if best.get("bitrate") else None,
            stream_url=f"{IA_BASE}/download/{identifier}/{best.get('name', '')}",
        )

    return IAItemDetail(
        id=identifier,
        title=metadata.get("title") or identifier,
        artist_name=artist_name,
        artwork_url=f"{IA_BASE}/services/img/{identifier}",
        best_audio_file=best_audio,
    )
