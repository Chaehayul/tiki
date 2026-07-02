from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.exceptions import AppException
from app.integrations.jira import JiraOAuthClient
from app.integrations.notion import get_notion_client
from app.models.enums import IntegrationProvider, SyncStatus
from app.models.integration import MeetingExternalLink, OAuthState, ProjectIntegration, TaskExternalLink
from app.models.project import Meeting, Project
from app.schemas.integration import ExternalTaskLinkResponse, ProviderIntegrationStatus, TaskSendResponse
from app.services import project_service


def _now() -> datetime:
    return datetime.now(UTC)


def _frontend_configuration_url(project_id: UUID, provider: str, status: str) -> str:
    base = settings.frontend_base_url.rstrip("/") or "http://localhost:5173"
    return f"{base}/configuration?projectId={project_id}&{provider}={status}"


def _get_meeting_or_404(db: Session, meeting_id: UUID) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if meeting is None:
        raise AppException(detail="Meeting not found", status_code=404, code="meeting_not_found")
    return meeting


def create_oauth_state(db: Session, project_id: UUID, provider: IntegrationProvider, user_id: UUID) -> str:
    project_service.get_project(db, project_id, user_id)
    state = secrets.token_urlsafe(48)
    db.add(
        OAuthState(
            state=state,
            user_id=user_id,
            project_id=project_id,
            provider=provider,
            expires_at=_now() + timedelta(minutes=15),
        )
    )
    db.commit()
    return state


def pop_oauth_state(db: Session, state: str, provider: IntegrationProvider) -> OAuthState:
    oauth_state = db.scalar(
        select(OAuthState).where(OAuthState.state == state, OAuthState.provider == provider)
    )
    if oauth_state is None:
        raise AppException(detail="Invalid OAuth state", status_code=400, code="invalid_oauth_state")
    if oauth_state.expires_at < _now():
        db.delete(oauth_state)
        db.commit()
        raise AppException(detail="Expired OAuth state", status_code=400, code="expired_oauth_state")
    db.delete(oauth_state)
    db.flush()
    return oauth_state


def upsert_project_integration(
    db: Session,
    *,
    project_id: UUID,
    provider: IntegrationProvider,
    access_token: str,
    refresh_token: str | None = None,
    expires_at: datetime | None = None,
    scope: str | None = None,
    external_workspace_id: str | None = None,
    external_site_url: str | None = None,
    external_site_name: str | None = None,
    cloud_id: str | None = None,
    notion_workspace_id: str | None = None,
    notion_bot_id: str | None = None,
    connected_by_user_id: UUID | None = None,
) -> ProjectIntegration:
    integration = db.scalar(
        select(ProjectIntegration).where(
            ProjectIntegration.project_id == project_id,
            ProjectIntegration.provider == provider,
        )
    )
    if integration is None:
        integration = ProjectIntegration(project_id=project_id, provider=provider, access_token="")
        db.add(integration)

    integration.access_token = encrypt_secret(access_token) or ""
    integration.refresh_token = encrypt_secret(refresh_token)
    integration.expires_at = expires_at
    integration.scope = scope
    integration.external_workspace_id = external_workspace_id
    integration.external_site_url = external_site_url
    integration.external_site_name = external_site_name
    integration.cloud_id = cloud_id
    integration.notion_workspace_id = notion_workspace_id
    integration.notion_bot_id = notion_bot_id
    integration.connected_by_user_id = connected_by_user_id
    integration.status = "connected"
    db.commit()
    db.refresh(integration)
    return integration


def list_project_integration_status(db: Session, project_id: UUID, user_id: UUID) -> dict[str, ProviderIntegrationStatus]:
    project_service.get_project(db, project_id, user_id)
    rows = db.scalars(select(ProjectIntegration).where(ProjectIntegration.project_id == project_id)).all()
    result = {
        "jira": ProviderIntegrationStatus(),
        "notion": ProviderIntegrationStatus(),
    }
    for row in rows:
        key = row.provider.value
        result[key] = ProviderIntegrationStatus(
            connected=row.status == "connected",
            status=row.status,
            siteName=row.external_site_name,
            siteUrl=row.external_site_url,
            workspaceName=row.external_site_name,
            workspaceId=row.external_workspace_id or row.notion_workspace_id,
            connectedAt=row.created_at,
        )
    return result


def disconnect_project_integration(db: Session, project_id: UUID, provider: IntegrationProvider, user_id: UUID) -> None:
    project_service.get_project(db, project_id, user_id)
    row = db.scalar(
        select(ProjectIntegration).where(
            ProjectIntegration.project_id == project_id,
            ProjectIntegration.provider == provider,
        )
    )
    if row is not None:
        db.delete(row)
        db.commit()


def _project_integration(db: Session, project_id: UUID, provider: IntegrationProvider) -> ProjectIntegration | None:
    return db.scalar(
        select(ProjectIntegration).where(
            ProjectIntegration.project_id == project_id,
            ProjectIntegration.provider == provider,
            ProjectIntegration.status == "connected",
        )
    )


def _meeting_description(meeting: Meeting) -> str:
    decisions = meeting.action_items if False else []
    return "\n".join(
        [
            f"회의 제목: {meeting.title}",
            f"회의 날짜: {meeting.date}",
            "",
            "회의 요약:",
            meeting.summary or "",
            "",
            "업무:",
            *[
                f"- {item.get('title') or item.get('text') or '업무'} / 담당자: {item.get('assignee') or '-'} / 마감일: {item.get('due') or item.get('due_at') or item.get('dueDate') or '-'}"
                for item in (meeting.action_items or [])
                if isinstance(item, dict)
            ],
        ]
    )


def _task_id(meeting: Meeting, item: dict, index: int) -> str:
    existing = str(item.get("id") or item.get("task_id") or "").strip()
    if existing:
        return existing
    generated = f"{meeting.id}-task-{index + 1}"
    item["id"] = generated
    return generated


def ensure_meeting_external_resource(db: Session, meeting: Meeting, provider: IntegrationProvider, *, force: bool = False) -> MeetingExternalLink:
    integration = _project_integration(db, meeting.project_id, provider)
    if integration is None:
        raise AppException(detail=f"{provider.value} is not connected", status_code=403, code=f"{provider.value}_not_connected")

    link = db.scalar(
        select(MeetingExternalLink).where(
            MeetingExternalLink.meeting_id == meeting.id,
            MeetingExternalLink.provider == provider,
        )
    )
    if link and link.sync_status == SyncStatus.SYNCED and link.external_id and not force:
        return link
    if link is None:
        link = MeetingExternalLink(
            meeting_id=meeting.id,
            project_id=meeting.project_id,
            provider=provider,
            external_type="meeting_issue" if provider == IntegrationProvider.JIRA else "notion_page",
            sync_status=SyncStatus.PENDING,
        )
        db.add(link)
        db.flush()

    try:
        if provider == IntegrationProvider.JIRA:
            token = decrypt_secret(integration.access_token) or ""
            client = JiraOAuthClient(
                access_token=token,
                cloud_id=integration.cloud_id,
                site_url=integration.external_site_url,
            )
            project_key = settings.jira_project_key
            if not project_key:
                raise RuntimeError("JIRA_PROJECT_KEY is required")
            issue = client.create_issue(
                project_key=project_key,
                title=f"Meeting - {meeting.date} {meeting.title}",
                description=_meeting_description(meeting),
                issue_type="Task",
            )
            link.external_id = issue.issue_id
            link.external_url = issue.issue_url
        else:
            token = decrypt_secret(integration.access_token) or ""
            database_id = settings.notion_meeting_database_id
            parent_page_id = settings.notion_parent_page_id
            client = get_notion_client(access_token=token)
            if force and link.external_id:
                try:
                    client.archive_page(link.external_id)
                except Exception:
                    pass
            if not database_id and not parent_page_id:
                parent_page_id = client.ensure_workspace_page_id()
            if not database_id and not parent_page_id:
                raise RuntimeError("Notion에 회의록을 만들 수 있는 페이지가 없습니다. Notion 연동 시 TIKI가 사용할 페이지를 선택하거나 NOTION_PARENT_PAGE_ID를 설정해 주세요.")
            page = client.create_meeting_page(
                title=f"{meeting.date} {meeting.title}",
                meeting_date=meeting.date,
                summary=meeting.summary or "",
                decisions=[],
                action_items=meeting.action_items or [],
                database_id=database_id,
                parent_page_id=parent_page_id,
            )
            link.external_id = page.page_id
            link.external_url = page.page_url
        link.sync_status = SyncStatus.SYNCED
        link.error_message = None
        link.last_synced_at = _now()
    except Exception as exc:
        link.sync_status = SyncStatus.FAILED
        link.error_message = str(exc)
        link.last_synced_at = _now()
    db.commit()
    db.refresh(link)
    return link


def sync_connected_meeting_resources(db: Session, meeting: Meeting) -> None:
    providers = db.scalars(
        select(ProjectIntegration.provider).where(
            ProjectIntegration.project_id == meeting.project_id,
            ProjectIntegration.status == "connected",
        )
    ).all()
    for provider in providers:
        ensure_meeting_external_resource(db, meeting, provider)


def sync_project_meeting_resources(db: Session, project_id: UUID, provider: IntegrationProvider) -> dict:
    meetings = db.scalars(
        select(Meeting)
        .where(Meeting.project_id == project_id)
        .order_by(Meeting.created_at.asc())
    ).all()
    result = {"total": len(meetings), "synced": 0, "failed": 0, "errors": []}
    for meeting in meetings:
        link = ensure_meeting_external_resource(db, meeting, provider, force=provider == IntegrationProvider.NOTION)
        if link.sync_status == SyncStatus.SYNCED:
            result["synced"] += 1
        elif link.sync_status == SyncStatus.FAILED:
            result["failed"] += 1
            result["errors"].append({
                "meetingId": str(meeting.id),
                "meetingTitle": meeting.title,
                "message": link.error_message,
            })
    return result


def _find_action_item(meeting: Meeting, task_id: str) -> tuple[int, dict] | None:
    for index, item in enumerate(meeting.action_items or []):
        if not isinstance(item, dict):
            continue
        if _task_id(meeting, item, index) == str(task_id):
            return index, item
    return None


def send_meeting_tasks(
    db: Session,
    *,
    meeting_id: UUID,
    provider: IntegrationProvider,
    task_ids: list[str],
    user_id: UUID,
) -> TaskSendResponse:
    meeting = _get_meeting_or_404(db, meeting_id)
    project_service.get_project(db, meeting.project_id, user_id)
    meeting_link = ensure_meeting_external_resource(db, meeting, provider)
    if meeting_link.sync_status == SyncStatus.FAILED:
        raise AppException(detail=meeting_link.error_message or "Meeting sync failed", status_code=502, code="meeting_sync_failed")

    integration = _project_integration(db, meeting.project_id, provider)
    if integration is None:
        raise AppException(detail=f"{provider.value} is not connected", status_code=403, code=f"{provider.value}_not_connected")

    results: list[ExternalTaskLinkResponse] = []
    selected_ids = [str(item) for item in task_ids]

    for task_id in selected_ids:
        found = _find_action_item(meeting, task_id)
        if found is None:
            results.append(ExternalTaskLinkResponse(taskId=task_id, provider=provider, syncStatus=SyncStatus.FAILED, errorMessage="Task not found"))
            continue
        index, task = found
        stable_task_id = _task_id(meeting, task, index)
        link = db.scalar(
            select(TaskExternalLink).where(
                TaskExternalLink.task_id == stable_task_id,
                TaskExternalLink.project_id == meeting.project_id,
                TaskExternalLink.provider == provider,
            )
        )
        if link is None:
            link = TaskExternalLink(
                task_id=stable_task_id,
                meeting_id=meeting.id,
                project_id=meeting.project_id,
                provider=provider,
                external_type="jira_issue" if provider == IntegrationProvider.JIRA else "notion_database_item",
                sync_status=SyncStatus.PENDING,
            )
            db.add(link)
            db.flush()

        try:
            title = str(task.get("title") or task.get("text") or "업무")
            description = str(task.get("description") or meeting.summary or title)
            due_date = str(task.get("due") or task.get("due_at") or task.get("dueDate") or "").strip() or None
            if provider == IntegrationProvider.JIRA:
                token = decrypt_secret(integration.access_token) or ""
                client = JiraOAuthClient(access_token=token, cloud_id=integration.cloud_id, site_url=integration.external_site_url)
                project_key = settings.jira_project_key
                if not project_key:
                    raise RuntimeError("JIRA_PROJECT_KEY is required")
                if link.external_id or link.external_key:
                    client.update_issue(link.external_key or link.external_id or "", title=title, description=description, due_date=due_date)
                else:
                    issue = client.create_issue(project_key=project_key, title=title, description=description, issue_type="Task", due_date=due_date)
                    link.external_id = issue.issue_id
                    link.external_key = issue.issue_key
                    link.external_url = issue.issue_url
                    if meeting_link.external_url and issue.issue_key:
                        parent_key = meeting_link.external_url.rstrip("/").split("/")[-1]
                        client.link_issues(parent_key, issue.issue_key)
            else:
                token = decrypt_secret(integration.access_token) or ""
                client = get_notion_client(access_token=token)
                task_database_id = settings.notion_task_database_id
                if task_database_id:
                    if link.external_id:
                        client.update_task_item(
                            page_id=link.external_id,
                            title=title,
                            assignee=task.get("assignee"),
                            due_date=due_date,
                            status=str(task.get("status") or "검토대기"),
                            priority=task.get("priority"),
                        )
                    else:
                        page = client.create_task_item(
                            database_id=task_database_id,
                            title=title,
                            assignee=task.get("assignee"),
                            due_date=due_date,
                            status=str(task.get("status") or "검토대기"),
                            priority=task.get("priority"),
                            meeting_title=meeting.title,
                            tiki_task_id=stable_task_id,
                            description=description,
                        )
                        link.external_id = page.page_id
                        link.external_url = page.page_url
                else:
                    client.append_task_blocks(meeting_link.external_id or "", [task])
                    link.external_id = meeting_link.external_id
                    link.external_url = meeting_link.external_url
                    link.external_type = "notion_page_task_block"

            link.sync_status = SyncStatus.SYNCED
            link.error_message = None
            link.last_synced_at = _now()
            task["status"] = "연동완료" if task.get("status") != "수행완료" else "수행완료"
            task.setdefault("integrationLinks", {})[provider.value] = link.external_url
            task["externalLink"] = link.external_url
            task["integrationTool"] = "Notion" if provider == IntegrationProvider.NOTION else "Jira"
        except Exception as exc:
            link.sync_status = SyncStatus.FAILED
            link.error_message = str(exc)
            link.last_synced_at = _now()

        results.append(
            ExternalTaskLinkResponse(
                taskId=stable_task_id,
                provider=provider,
                syncStatus=link.sync_status,
                externalId=link.external_id,
                externalKey=link.external_key,
                externalUrl=link.external_url,
                errorMessage=link.error_message,
            )
        )

    meeting.action_items = list(meeting.action_items or [])
    db.commit()
    return TaskSendResponse(meetingId=meeting.id, provider=provider, results=results)
