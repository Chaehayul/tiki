import re
import secrets
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_scheme, get_current_user
from app.core.exceptions import AppException
from app.core.security import create_access_token, decode_access_token_payload, hash_password, verify_password
from app.db.database import get_db
from app.models.project import ProjectMember
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import (
    AccountDelete,
    AuthResponse,
    PasswordChange,
    UserCreate,
    UserLogin,
    UserLookupResponse,
    UserResponse,
    UserSessionResponse,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])
PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$")


def _parse_user_agent(user_agent: str | None) -> tuple[str, str | None, str | None]:
    raw = user_agent or ""
    if "Edg/" in raw:
        browser = "Microsoft Edge"
    elif "Chrome/" in raw and "Chromium" not in raw:
        browser = "Chrome"
    elif "Firefox/" in raw:
        browser = "Firefox"
    elif "Safari/" in raw and "Chrome/" not in raw:
        browser = "Safari"
    else:
        browser = "브라우저"

    if "Windows" in raw:
        os_name = "Windows"
    elif "Mac OS X" in raw or "Macintosh" in raw:
        os_name = "macOS"
    elif "iPhone" in raw or "iPad" in raw:
        os_name = "iOS"
    elif "Android" in raw:
        os_name = "Android"
    elif "Linux" in raw:
        os_name = "Linux"
    else:
        os_name = None

    device = f"{browser} · {os_name}" if os_name else browser
    return device, browser, os_name


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else None


def _create_user_session(user: User, request: Request, db: Session) -> UserSession:
    user_agent = request.headers.get("user-agent")
    device_name, browser, os_name = _parse_user_agent(user_agent)
    session = UserSession(
        user_id=user.id,
        token_id=secrets.token_urlsafe(32),
        device_name=device_name,
        browser=browser,
        os=os_name,
        ip_address=_client_ip(request),
        user_agent=user_agent,
        is_active=True,
        last_seen_at=datetime.now(UTC),
    )
    db.add(session)
    db.flush()
    return session


def _current_token_id(credentials) -> str | None:
    if credentials is None:
        return None
    payload = decode_access_token_payload(credentials.credentials)
    if payload is None:
        return None
    token_id = payload.get("jti")
    return str(token_id) if token_id else None


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
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
        position=payload.position,
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
    session = _create_user_session(user, request, db)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id, session.token_id),
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
) -> AuthResponse:
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
    session = _create_user_session(user, request, db)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        access_token=create_access_token(user.id, session.token_id),
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.get("/sessions", response_model=list[UserSessionResponse])
def list_sessions(
    current_user: User = Depends(get_current_user),
    credentials=Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> list[UserSessionResponse]:
    current_token_id = _current_token_id(credentials)
    sessions = db.scalars(
        select(UserSession)
        .where(UserSession.user_id == current_user.id, UserSession.is_active.is_(True))
        .order_by(UserSession.last_seen_at.desc().nullslast(), UserSession.created_at.desc())
    ).all()
    return [
        UserSessionResponse(
            id=session.id,
            device_name=session.device_name,
            browser=session.browser,
            os=session.os,
            ip_address=session.ip_address,
            is_current=session.token_id == current_token_id,
            is_active=session.is_active,
            created_at=session.created_at,
            last_seen_at=session.last_seen_at,
        )
        for session in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    credentials=Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> None:
    current_token_id = _current_token_id(credentials)
    session = db.scalar(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == current_user.id,
            UserSession.is_active.is_(True),
        )
    )
    if session is None:
        raise AppException(detail="Session not found", status_code=404, code="session_not_found")
    if session.token_id == current_token_id:
        raise AppException(detail="Current session cannot be revoked here", status_code=400, code="current_session")

    session.is_active = False
    session.revoked_at = datetime.now(UTC)
    db.commit()


@router.post("/sessions/logout-others", status_code=status.HTTP_204_NO_CONTENT)
def revoke_other_sessions(
    current_user: User = Depends(get_current_user),
    credentials=Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> None:
    current_token_id = _current_token_id(credentials)
    now = datetime.now(UTC)
    sessions = db.scalars(
        select(UserSession).where(
            UserSession.user_id == current_user.id,
            UserSession.is_active.is_(True),
        )
    ).all()
    for session in sessions:
        if session.token_id != current_token_id:
            session.is_active = False
            session.revoked_at = now
    db.commit()


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
    changes = payload.model_dump(exclude_unset=True)

    if "email" in changes and changes["email"] is not None:
        next_email = str(changes["email"]).lower().strip()
        existing_user = db.scalar(
            select(User).where(User.email == next_email, User.id != current_user.id)
        )
        if existing_user is not None:
            raise AppException(
                detail="Email is already registered",
                status_code=409,
                code="email_already_registered",
            )
        current_user.email = next_email

    if "name" in changes and changes["name"] is not None:
        current_user.name = str(changes["name"]).strip()

    if "role" in changes:
        current_user.role = changes["role"]

    if "position" in changes:
        current_user.position = changes["position"]

    linked_members = db.scalars(
        select(ProjectMember).where(ProjectMember.user_id == current_user.id)
    ).all()
    for member in linked_members:
        member.email = current_user.email
        member.name = current_user.name

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise AppException(
            detail="Current password is incorrect",
            status_code=400,
            code="invalid_current_password",
        )

    if not PASSWORD_PATTERN.match(payload.new_password):
        raise AppException(
            detail="Password must include letters, numbers, and special characters",
            status_code=400,
            code="weak_password",
        )

    if verify_password(payload.new_password, current_user.hashed_password):
        raise AppException(
            detail="New password must be different from current password",
            status_code=400,
            code="same_password",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    payload: AccountDelete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.password, current_user.hashed_password):
        raise AppException(
            detail="Password is incorrect",
            status_code=400,
            code="invalid_password",
        )

    deleted_email = f"deleted-{current_user.id}@deleted.tiki.local"
    current_user.is_active = False
    current_user.email = deleted_email
    current_user.name = "탈퇴한 사용자"

    linked_members = db.scalars(
        select(ProjectMember).where(ProjectMember.user_id == current_user.id)
    ).all()
    for member in linked_members:
        member.email = deleted_email
        member.name = "탈퇴한 사용자"

    db.commit()
