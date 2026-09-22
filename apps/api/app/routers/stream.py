import os
import re
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from app.database import get_db
from app.routers.auth import require_user_id

router = APIRouter(prefix="/stream", tags=["stream"])

CHUNK_SIZE = 1024 * 64
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _iter_file(path: str, start: int, end: int):
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = f.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@router.get("/{track_id}")
def stream(
    track_id: int,
    request: Request,
    user_id: int = Depends(require_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    row = db.execute("SELECT file_path FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if not row or not row["file_path"]:
        raise HTTPException(status_code=404, detail="Track file not found")

    file_path = row["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Track file not found")
    file_size = os.path.getsize(file_path)

    range_header = request.headers.get("range")
    if not range_header:
        with open(file_path, "rb") as f:
            content = f.read()
        return Response(content=content, media_type="application/octet-stream")

    match = RANGE_RE.match(range_header)
    if not match:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    start = int(match.group(1)) if match.group(1) else 0
    end = int(match.group(2)) if match.group(2) else file_size - 1
    end = min(end, file_size - 1)

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(end - start + 1),
    }
    return StreamingResponse(
        _iter_file(file_path, start, end),
        status_code=206,
        media_type="application/octet-stream",
        headers=headers,
    )
