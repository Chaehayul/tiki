from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.core.exceptions import AppException
from app.db.database import get_db
from app.integrations.jira import JiraOAuthClient, get_jira_client
from app.integrations.notion import get_notion_client
from app.models.enums import IntegrationProvider, SyncStatus
from app.models.integration import ExternalSync
from app.models.project import Project
from app.models.ticket import Ticket
from app.models.user import User
from app.models.user_integration import UserIntegration
from app.schemas.integration import IntegrationConnectResponse, TaskSendRequest, TaskSendResponse
from app.services import external_integration_service
from app.services.ticket_access import assert_ticket_access

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/jira/connect", response_model=IntegrationConnectResponse)
def jira_connect(
    projectId: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IntegrationConnectResponse:
    client = JiraOAuthClient()
    if not client.is_configured():
        raise AppException(detail="Jira OAuth is not configured", status_code=503, code="jira_oauth_not_configured")
    state = external_integration_service.create_oauth_state(db, projectId, IntegrationProvider.JIRA, current_user.id)
    return IntegrationConnectResponse(authorization_url=client.get_authorization_url(state))


@router.get("/jira/callback")
def jira_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    oauth_state = external_integration_service.pop_oauth_state(db, state, IntegrationProvider.JIRA)
    client = JiraOAuthClient()
    try:
        token = client.exchange_code_for_token(code)
        resource_client = JiraOAuthClient(access_token=token.access_token)
        resources = resource_client.list_accessible_resources()
        if not resources:
            raise RuntimeError("No accessible Jira site")
        resource = resources[0]
        expires_at = datetime.now(UTC) + timedelta(seconds=token.expires_in or 3600)
        external_integration_service.upsert_project_integration(
            db,
            project_id=oauth_state.project_id,
            provider=IntegrationProvider.JIRA,
            access_token=token.access_token,
            refresh_token=token.refresh_token,
            expires_at=expires_at,
            scope=token.scope,
            external_workspace_id=resource.cloud_id,
            external_site_url=resource.url,
            external_site_name=resource.name,
            cloud_id=resource.cloud_id,
            connected_by_user_id=oauth_state.user_id,
        )
        external_integration_service.sync_project_meeting_resources(db, oauth_state.project_id, IntegrationProvider.JIRA)
    except Exception:
        db.rollback()
        raise
    return RedirectResponse(url=f"{settings.frontend_base_url.rstrip('/')}/configuration?projectId={oauth_state.project_id}&jira=connected")


@router.get("/notion/connect", response_model=IntegrationConnectResponse)
def notion_project_connect(
    projectId: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IntegrationConnectResponse:
    client = get_notion_client()
    if not client.is_configured():
        raise AppException(detail="Notion OAuth is not configured", status_code=503, code="notion_oauth_not_configured")
    state = external_integration_service.create_oauth_state(db, projectId, IntegrationProvider.NOTION, current_user.id)
    return IntegrationConnectResponse(authorization_url=client.get_authorization_url(state=state))


@router.get("/meetings/{meeting_id}/tasks/send", include_in_schema=False)
def unsupported_get_send_tasks() -> None:
    raise AppException(detail="Use POST /api/v1/integrations/meetings/{meetingId}/tasks/send", status_code=405, code="method_not_allowed")


@router.post("/meetings/{meeting_id}/tasks/send", response_model=TaskSendResponse)
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
        from app.models.integration import OAuthState

        oauth_state = db.scalar(
            select(OAuthState).where(
                OAuthState.state == state,
                OAuthState.provider == IntegrationProvider.NOTION,
            )
        )
        if oauth_state is not None:
            oauth_state = external_integration_service.pop_oauth_state(db, state, IntegrationProvider.NOTION)
            project = db.get(Project, oauth_state.project_id)
            notion_client = get_notion_client(access_token=token_result.access_token)
            notion_database_id = notion_client.ensure_project_meeting_database_id(project.name if project else "TIKI 프로젝트")
            external_integration_service.upsert_project_integration(
                db,
                project_id=oauth_state.project_id,
                provider=IntegrationProvider.NOTION,
                access_token=token_result.access_token,
                refresh_token=None,
                expires_at=None,
                scope=None,
                external_workspace_id=token_result.workspace_id,
                external_site_url=notion_database_id,
                external_site_name=token_result.workspace_name,
                notion_workspace_id=token_result.workspace_id,
                notion_bot_id=token_result.bot_id,
                connected_by_user_id=oauth_state.user_id,
            )
            return RedirectResponse(url=f"{settings.frontend_base_url.rstrip('/')}/configuration?projectId={oauth_state.project_id}&notion=connected")
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
        except ValueError as exc:
            db.rollback()
            raise AppException(detail="Invalid Notion OAuth state", status_code=400, code="notion_invalid_state") from exc
        except Exception as exc:
            db.rollback()
            raise AppException(detail="Failed to save Notion integration", status_code=500, code="notion_save_failed") from exc

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
    assert_ticket_access(db, ticket, current_user.id)

    client = get_jira_client()
    if not client.is_configured():
        raise AppException(detail="Jira is not configured", status_code=503, code="jira_not_configured")

    try:
        result = client.create_issue(
            title=ticket.title,
            description=ticket.description,
            priority=ticket.priority,
            assignee=ticket.assignee,
            due_at=ticket.due_at,
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
    assert_ticket_access(db, ticket, current_user.id)

    integration = db.scalar(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.provider == IntegrationProvider.NOTION,
        )
    )
    if not integration:
        raise AppException(detail="Notion is not connected", status_code=403, code="notion_not_connected")

    client = get_notion_client(access_token=decrypt_secret(integration.access_token) or "")

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
