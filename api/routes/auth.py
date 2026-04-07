"""
Authentication endpoints.

Currently uses Supabase Auth for user management.
The frontend currently uses localStorage for auth — these endpoints
provide a proper backend alternative.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional

from db.supabase_client import get_client

router = APIRouter()


class SignUpRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None


@router.post("/signup")
def signup(req: SignUpRequest):
    """Register a new user.

    Uses Supabase Auth for user creation and stores profile in users table.
    """
    sb = get_client()
    try:
        # Create user in Supabase Auth
        auth_response = sb.auth.sign_up({
            "email": req.email,
            "password": req.password,
        })

        if auth_response.user:
            # Store profile in users table
            sb.table("users").upsert({
                "id": auth_response.user.id,
                "email": req.email,
                "full_name": req.full_name,
                "phone": req.phone,
            }, on_conflict="id").execute()

            return {
                "user": {
                    "id": auth_response.user.id,
                    "email": req.email,
                    "full_name": req.full_name,
                },
                "session": {
                    "access_token": auth_response.session.access_token if auth_response.session else None,
                },
            }
        raise HTTPException(status_code=400, detail="Signup failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(req: LoginRequest):
    """Log in with email/password."""
    sb = get_client()
    try:
        auth_response = sb.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })

        if auth_response.user:
            # Get profile from users table
            profile = sb.table("users").select("*").eq(
                "id", auth_response.user.id
            ).execute()

            return {
                "user": {
                    "id": auth_response.user.id,
                    "email": auth_response.user.email,
                    "full_name": profile.data[0]["full_name"] if profile.data else "",
                },
                "session": {
                    "access_token": auth_response.session.access_token,
                },
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
def logout():
    """Log out the current user."""
    return {"status": "ok"}


@router.get("/me")
def get_current_user():
    """Get current user profile.

    Note: In production, this should use JWT token from Authorization header.
    Currently a placeholder for the frontend to call.
    """
    return {"message": "Use Authorization header with Supabase JWT token"}
