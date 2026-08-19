"""
Authentication service for Lemma.

Handles password hashing, JWT issuance/verification, and FastAPI dependencies
for retrieving the current authenticated user (required or optional).
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt

from app.config import settings
from app.services.database import DatabaseService

# tokenUrl is only used to populate the OpenAPI docs "Authorize" button;
# the actual login endpoint returns JSON rather than redirecting.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)


class AuthError(Exception):
    """Raised for invalid credentials or bad/expired tokens."""


def hash_password(plain_password: str) -> str:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    hashed_bytes = hashed_password.encode("utf-8")
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """Returns the user_id encoded in the token, or raises AuthError."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("Token missing subject claim.")
        return user_id
    except JWTError as e:
        raise AuthError(f"Invalid or expired token: {e}")


class AuthService:
    """User registration/login helpers backed by DatabaseService."""

    @staticmethod
    def register_user(email: str, password: str, full_name: str | None) -> dict:
        email_normalized = email.strip().lower()
        if DatabaseService.get_user_by_email(email_normalized):
            raise AuthError("An account with this email already exists.")

        user_id = str(uuid.uuid4())
        password_hash = hash_password(password)
        DatabaseService.create_user(
            user_id=user_id,
            email=email_normalized,
            password_hash=password_hash,
            full_name=full_name,
        )
        return DatabaseService.get_user_by_id(user_id)

    @staticmethod
    def authenticate_user(email: str, password: str) -> dict:
        email_normalized = email.strip().lower()
        user = DatabaseService.get_user_by_email(email_normalized, include_password_hash=True)
        if not user or not verify_password(password, user["password_hash"]):
            raise AuthError("Incorrect email or password.")
        return user


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Required-auth dependency. Raises 401 if no/invalid token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        user_id = decode_access_token(token)
    except AuthError:
        raise credentials_exception

    user = DatabaseService.get_user_by_id(user_id)
    if not user:
        raise credentials_exception
    return user


async def get_optional_current_user(token: str | None = Depends(oauth2_scheme)) -> dict | None:
    """Optional-auth dependency for endpoints usable both anonymously and while logged in
    (e.g. /analyze — anonymous uploads still work, but logged-in uploads get saved to history)."""
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
    except AuthError:
        return None
    return DatabaseService.get_user_by_id(user_id)
