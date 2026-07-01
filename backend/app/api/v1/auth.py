from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.exceptions import AppException
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.project import ProjectMember
from app.models.user import User
from app.schemas.auth import AuthResponse, UserCreate, UserLogin, UserLookupResponse, UserResponse, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise AppException(
            detail="Email is already registered",
            status_code=409,
            code="email_already_registered",
        )

    user = User(
        email=email,
        name=payload.name.strip(),
        role=payload.role,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    invited_members = db.scalars(
        select(ProjectMember).where(
            ProjectMember.email == email,
            ProjectMember.user_id.is_(None),
        )
    ).all()
    for member in invited_members:
        member.user_id = user.id
        if not member.name:
            member.name = user.name
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AppException(
            detail="Invalid email or password",
            status_code=401,
            code="invalid_credentials",
        )

    if not user.is_active:
        raise AppException(
            detail="User account is disabled",
            status_code=403,
            code="user_disabled",
        )

    user.last_login_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.get("/users/lookup", response_model=UserLookupResponse)
def lookup_user_by_email(
    email: str = Query(min_length=1, max_length=255),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserLookupResponse:
    normalized_email = email.lower().strip()
    user = db.scalar(select(User).where(User.email == normalized_email, User.is_active.is_(True)))
    return UserLookupResponse(
        found=user is not None,
        email=normalized_email,
        name=user.name if user else None,
    )


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)
