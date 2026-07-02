from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.integration import TaskSendRequest, TaskSendResponse
from app.services import external_integration_service

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.post("/{meeting_id}/tasks/send", response_model=TaskSendResponse)
def send_meeting_tasks(
    meeting_id: UUID,
    payload: TaskSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskSendResponse:
    return external_integration_service.send_meeting_tasks(
        db,
        meeting_id=meeting_id,
        provider=payload.provider,
        task_ids=payload.taskIds,
        user_id=current_user.id,
    )
