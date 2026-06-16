from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppException(detail="Not authenticated", status_code=401, code="not_authenticated")

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise AppException(detail="Invalid or expired token", status_code=401, code="invalid_token")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AppException(detail="User not found", status_code=401, code="invalid_token")

    return user
