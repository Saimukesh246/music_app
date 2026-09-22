import hashlib
import hmac
import os
import time

import jwt

SECRET_KEY = os.environ.get(
    "AURA_SECRET_KEY", "dev-secret-change-me-before-any-real-deployment-32b"
)
ALGORITHM = "HS256"
PBKDF2_ITERATIONS = 100_000
TOKEN_LIFETIME_SEC = 3600


def hash_password(password: str) -> tuple[str, str]:
    salt = os.urandom(16).hex()
    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return password_hash, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return hmac.compare_digest(candidate, password_hash)


def create_access_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": int(time.time()) + TOKEN_LIFETIME_SEC}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except jwt.PyJWTError:
        return None
