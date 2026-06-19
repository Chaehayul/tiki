from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.exceptions import AppException
from app.db.database import get_db
from app.integrations.jira import get_jira_client
from app.integrations.notion import get_notion_client
from app.models.enums import IntegrationProvider, SyncStatus
from app.models.integration import ExternalSync
from app.models.ticket import Ticket
from app.models.user import User
from app.models.user_integration import UserIntegration

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ── Notion OAuth ──────────────────────────────────────────────────────────────

@router.get("/notion/authorize")
def notion_authorize(
    current_user: User = Depends(get_current_user),
) -> RedirectResponse:
    client = get_notion_client()
    if not client.is_configured():
        raise AppException(detail="Notion is not configured", status_code=503, code="notion_not_configured")
    url = client.get_authorization_url(state=str(current_user.id))
    return RedirectResponse(url=url)


@router.get("/notion/callback")
def notion_callback(
    code: str = Query(...),
    state: str = Query(default=""),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    client = get_notion_client()
    try:
        token_result = client.exchange_code_for_token(code)
    except Exception as exc:
        raise AppException(detail=f"Notion OAuth failed: {exc}", status_code=400, code="notion_oauth_failed")

    if state:
        try:
            user_id = UUID(state)
            existing = db.scalar(
                select(UserIntegration).where(
                    UserIntegration.user_id == user_id,
                    UserIntegration.provider == IntegrationProvider.NOTION,
                )
            )
            if existing:
                existing.access_token = token_result.access_token
                existing.workspace_id = token_result.workspace_id
                existing.workspace_name = token_result.workspace_name
                existing.bot_id = token_result.bot_id
            else:
                db.add(UserIntegration(
                    user_id=user_id,
                    provider=IntegrationProvider.NOTION,
                    access_token=token_result.access_token,
                    workspace_id=token_result.workspace_id,
                    workspace_name=token_result.workspace_name,
                    bot_id=token_result.bot_id,
                ))
            db.commit()
        except (ValueError, Exception):
            pass

    frontend_origin = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
    return RedirectResponse(url=f"{frontend_origin}/configuration?notion=connected")


@router.get("/notion/status")
def notion_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    integration = db.scalar(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.provider == IntegrationProvider.NOTION,
        )
    )
    if not integration:
        return {"connected": False}
    return {
        "connected": True,
        "workspace_name": integration.workspace_name,
        "workspace_id": integration.workspace_id,
    }


# ── Ticket 싱크 ───────────────────────────────────────────────────────────────

@router.post("/tickets/{ticket_id}/sync/jira")
def sync_ticket_to_jira(
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    ticket = db.scalar(
        select(Ticket).where(Ticket.id == ticket_id).options(selectinload(Ticket.external_syncs))
    )
    if ticket is None:
        raise AppException(detail="Ticket not found", status_code=404, code="ticket_not_found")

    client = get_jira_client()
    if not client.is_configured():
        raise AppException(detail="Jira is not configured", status_code=503, code="jira_not_configured")

    try:
        result = client.create_issue(
            title=ticket.title,
            description=ticket.description,
            priority=ticket.priority,
            assignee=ticket.assignee,
        )
    except Exception as exc:
        sync = ExternalSync(
            ticket_id=ticket.id,
            provider=IntegrationProvider.JIRA,
            status=SyncStatus.FAILED,
            error_message=str(exc),
        )
        db.add(sync)
        db.commit()
        raise AppException(detail=f"Jira sync failed: {exc}", status_code=502, code="jira_sync_failed")

    sync = ExternalSync(
        ticket_id=ticket.id,
        provider=IntegrationProvider.JIRA,
        status=SyncStatus.SYNCED,
        external_id=result.issue_key,
        external_url=result.issue_url,
        synced_at=datetime.now(UTC),
    )
    db.add(sync)
    db.commit()

    return {"issue_key": result.issue_key, "issue_url": result.issue_url}


@router.post("/tickets/{ticket_id}/sync/notion")
def sync_ticket_to_notion(
    ticket_id: UUID,
    database_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    ticket = db.scalar(
        select(Ticket).where(Ticket.id == ticket_id).options(selectinload(Ticket.external_syncs))
    )
    if ticket is None:
        raise AppException(detail="Ticket not found", status_code=404, code="ticket_not_found")

    integration = db.scalar(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.provider == IntegrationProvider.NOTION,
        )
    )
    if not integration:
        raise AppException(detail="Notion is not connected", status_code=403, code="notion_not_connected")

    client = get_notion_client(access_token=integration.access_token)

    try:
        result = client.create_page(
            title=ticket.title,
            description=ticket.description,
            priority=ticket.priority,
            assignee=ticket.assignee,
            database_id=database_id,
        )
    except Exception as exc:
        sync = ExternalSync(
            ticket_id=ticket.id,
            provider=IntegrationProvider.NOTION,
            status=SyncStatus.FAILED,
            error_message=str(exc),
        )
        db.add(sync)
        db.commit()
        raise AppException(detail=f"Notion sync failed: {exc}", status_code=502, code="notion_sync_failed")

    sync = ExternalSync(
        ticket_id=ticket.id,
        provider=IntegrationProvider.NOTION,
        status=SyncStatus.SYNCED,
        external_id=result.page_id,
        external_url=result.page_url,
        synced_at=datetime.now(UTC),
    )
    db.add(sync)
    db.commit()

    return {"page_id": result.page_id, "page_url": result.page_url}
