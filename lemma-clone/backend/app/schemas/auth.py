import re
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="The user's email address, used as their login identifier.")
    password: str = Field(..., min_length=8, description="Plaintext password (min 8 chars). Never stored or logged as-is.")
    full_name: str | None = Field(None, description="Optional display name.")

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not re.search(r"[A-Za-z]", value) or not re.search(r"[0-9]", value):
            raise ValueError("Password must contain at least one letter and one number.")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    created_at: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TokenPayload(BaseModel):
    sub: str  # user id
    exp: int
