import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.schemas import TokenResponse, UserLogin, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(body: UserRegister, db: sqlite3.Connection = Depends(get_db)):
    existing = db.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash, salt = hash_password(body.password)
    db.execute(
        "INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)",
        (body.email, password_hash, salt),
    )
    return {"status": "registered"}


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, password_hash, password_salt FROM users WHERE email = ?", (body.email,)
    ).fetchone()
    if not row or not verify_password(body.password, row["password_hash"], row["password_salt"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=row["id"])
    return TokenResponse(access_token=token)


def require_user_id(authorization: str = Header(default="")) -> int:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    user_id = decode_access_token(authorization.removeprefix("Bearer "))
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user_id
