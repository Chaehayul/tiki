from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str | None = Field(default=None, max_length=50)
    position: str | None = Field(default=None, max_length=50)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    role: str | None
    position: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserLookupResponse(BaseModel):
    found: bool
    email: EmailStr
    name: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    role: str | None = Field(default=None, max_length=50)
    position: str | None = Field(default=None, max_length=50)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AccountDelete(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class UserSessionResponse(BaseModel):
    id: UUID
    device_name: str
    browser: str | None
    os: str | None
    ip_address: str | None
    is_current: bool = False
    is_active: bool
    created_at: datetime
    last_seen_at: datetime | None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
