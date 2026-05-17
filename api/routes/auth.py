"""
Authentication endpoints.

Uses the project's `users` table directly with bcrypt-hashed passwords.
No JWT / session tokens -- the frontend stores the returned profile in
localStorage. Acceptable for a campus demo, not for anything beyond
(see CLAUDE.md known-followups).

Error codes returned in HTTPException `detail` are short machine strings
(account_not_found, invalid_password, email_taken) so the frontend can
key off them and render localized messages.
"""

from datetime import datetime
from uuid import uuid4

import bcrypt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from db.supabase_client import get_client

router = APIRouter()


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"),
                          bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"),
                               password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _user_response(row: dict) -> dict:
    return {
        "user_id": row["user_id"],
        "email": row["email"],
        "name": row.get("name", ""),
        "created_at": row.get("created_at"),
    }


@router.post("/signup")
def signup(req: SignUpRequest):
    """Register a new account against the `users` table."""
    sb = get_client()
    email = req.email.lower().strip()

    existing = (sb.table("users").select("user_id")
                .eq("email", email).execute())
    if existing.data:
        raise HTTPException(status_code=409, detail="email_taken")

    row = {
        "user_id": str(uuid4()),
        "email": email,
        "name": req.name.strip(),
        "password_hash": _hash_password(req.password),
        "created_at": datetime.utcnow().isoformat(),
    }
    try:
        result = sb.table("users").insert(row).execute()
    except Exception as e:
        # Unique-index trip is the only expected error we want to surface
        # as a known code; everything else bubbles up as a 500.
        msg = str(e).lower()
        if "duplicate" in msg or "unique" in msg or "23505" in msg:
            raise HTTPException(status_code=409, detail="email_taken")
        raise HTTPException(status_code=500, detail="signup_failed")

    return _user_response(result.data[0] if result.data else row)


@router.post("/login")
def login(req: LoginRequest):
    """Log in an existing user. Returns the profile on success."""
    sb = get_client()
    email = req.email.lower().strip()

    found = (sb.table("users").select(
        "user_id,email,name,password_hash,created_at"
    ).eq("email", email).execute())

    if not found.data:
        raise HTTPException(status_code=404, detail="account_not_found")

    user_row = found.data[0]
    if not _verify_password(req.password, user_row.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="invalid_password")

    return _user_response(user_row)
