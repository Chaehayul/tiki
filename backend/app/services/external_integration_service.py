from __future__ import annotations

import re
import secrets
import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.exceptions import AppException
from app.integrations.jira import JiraOAuthClient, JiraProjectOption
from app.integrations.notion import get_notion_client
from app.models.analysis import AnalysisResult
from app.models.enums import IntegrationProvider, SyncStatus
from app.models.integration import MeetingExternalLink, OAuthState, ProjectIntegration, TaskExternalLink
from app.models.project import Meeting, Project
from app.schemas.integration import ExternalTaskLinkResponse, ProviderIntegrationStatus, TaskSendResponse
from app.services import project_service

logger = logging.getLogger(__name__)


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


def _get_valid_jira_access_token(db: Session, integration: ProjectIntegration) -> str:
    """Return a usable Jira access token, refreshing it first if it's expired.

    Atlassian access tokens issued via the 3LO OAuth flow expire after about an
    hour; without this, every sync started more than an hour after connecting
    would fail with a 401 from Jira.
    """
    token = decrypt_secret(integration.access_token) or ""
    expires_at = integration.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    is_expiring = expires_at is not None and expires_at <= _now() + timedelta(seconds=60)
    if not is_expiring:
        return token

    refresh_token = decrypt_secret(integration.refresh_token) if integration.refresh_token else None
    if not refresh_token:
        return token

    client = JiraOAuthClient()
    result = client.refresh_access_token(refresh_token)
    integration.access_token = encrypt_secret(result.access_token) or ""
    integration.refresh_token = encrypt_secret(result.refresh_token) if result.refresh_token else integration.refresh_token
    integration.expires_at = _now() + timedelta(seconds=result.expires_in) if result.expires_in else None
    db.flush()
    return result.access_token


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
            jiraProjectKey=row.jira_project_key,
            jiraProjectName=row.jira_project_name,
        )
    return result


def list_jira_projects(db: Session, project_id: UUID, user_id: UUID) -> list[JiraProjectOption]:
    project_service.get_project(db, project_id, user_id)
    integration = _project_integration(db, project_id, IntegrationProvider.JIRA)
    if integration is None:
        raise AppException(detail="Jira is not connected", status_code=403, code="jira_not_connected")
    token = _get_valid_jira_access_token(db, integration)
    db.commit()
    client = JiraOAuthClient(access_token=token, cloud_id=integration.cloud_id, site_url=integration.external_site_url)
    return client.list_projects()


def set_jira_project(db: Session, project_id: UUID, user_id: UUID, key: str, name: str) -> ProjectIntegration:
    project_service.get_project(db, project_id, user_id)
    integration = _project_integration(db, project_id, IntegrationProvider.JIRA)
    if integration is None:
        raise AppException(detail="Jira is not connected", status_code=403, code="jira_not_connected")
    integration.jira_project_key = key
    integration.jira_project_name = name
    db.commit()
    db.refresh(integration)
    return integration


# TIKI action-item status -> Jira status category to push it into when that status is reached.
TASK_STATUS_TO_JIRA_CATEGORY = {
    "검토완료": "indeterminate",  # review done, work starts -> Jira "In Progress"
    "수행완료": "done",  # actually completed -> Jira "Done"
}


def sync_task_status_to_jira(db: Session, project_id: UUID, task_id: str, category_key: str) -> None:
    """Push a TIKI task's status to its linked Jira issue, if one exists."""
    integration = _project_integration(db, project_id, IntegrationProvider.JIRA)
    if integration is None:
        return
    link = db.scalar(
        select(TaskExternalLink).where(
            TaskExternalLink.task_id == task_id,
            TaskExternalLink.project_id == project_id,
            TaskExternalLink.provider == IntegrationProvider.JIRA,
        )
    )
    issue_key = link.external_key or link.external_id if link else None
    if not issue_key:
        return
    token = _get_valid_jira_access_token(db, integration)
    db.commit()
    client = JiraOAuthClient(access_token=token, cloud_id=integration.cloud_id, site_url=integration.external_site_url)
    client.transition_to_category(issue_key, category_key)


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


def _notion_meeting_database_id(db: Session, integration: ProjectIntegration, client, project: Project) -> str:
    database_id = client.ensure_project_meeting_database_id(
        project.name,
        configured_database_id=integration.external_site_url,
    )
    if integration.external_site_url != database_id:
        integration.external_site_url = database_id
        db.flush()
    return database_id


def _meeting_description(db: Session, meeting: Meeting) -> str:
    payload = _analysis_payload_for_meeting(db, meeting)
    decisions = [_text_from_item(item) for item in payload.get("decisions", []) if _text_from_item(item)]
    issues = [_text_from_item(item) for item in payload.get("issues", []) if _text_from_item(item)]
    next_agenda = [_text_from_item(item) for item in payload.get("next_agenda", []) if _text_from_item(item)]
    action_items = [item for item in payload.get("action_items", []) if isinstance(item, dict)]

    lines = [
        f"회의 제목: {meeting.title}",
        f"회의 날짜: {meeting.date}",
        "",
        "회의 요약:",
        payload.get("summary") or meeting.summary or "",
        "",
        "주요 결정사항:",
        *([f"- {item}" for item in decisions] or ["- 없음"]),
        "",
        "해야 할 일:",
        *(
            [
                f"- {item.get('title') or item.get('text') or '업무'} / 담당자: {item.get('assignee') or '-'} / 마감일: {item.get('due') or item.get('due_at') or item.get('dueDate') or '-'}"
                for item in action_items
            ]
            or ["- 없음"]
        ),
        "",
        "이슈:",
        *([f"- {item}" for item in issues] or ["- 없음"]),
        "",
        "다음 안건:",
        *([f"- {item}" for item in next_agenda] or ["- 없음"]),
    ]
    return "\n".join(lines)


def _task_id(meeting: Meeting, item: dict, index: int) -> str:
    existing = str(item.get("id") or item.get("task_id") or "").strip()
    if existing:
        return existing
    generated = f"{meeting.id}-task-{index + 1}"
    item["id"] = generated
    return generated


def _text_from_item(item: object) -> str:
    if isinstance(item, dict):
        return str(item.get("text") or item.get("title") or item.get("content") or "").strip()
    return str(item or "").strip()


def _service_text(value: object) -> str:
    text = str(value or "")
    replacements = {
        "Action Items": "해야 할 일",
        "Action Item": "해야 할 일",
        "action items": "해야 할 일",
        "action item": "해야 할 일",
        "액션아이템": "해야 할 일",
        "액션 아이템": "해야 할 일",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def _meeting_meta(meeting: Meeting) -> dict:
    for item in meeting.action_items or []:
        if not isinstance(item, dict):
            continue
        if item.get("__tiki_meta") or item.get("type") == "__tiki_meeting_meta":
            data = item.get("data") if isinstance(item.get("data"), dict) else item
            return dict(data)
    return {}


def _visible_meeting_actions(meeting: Meeting) -> list[dict]:
    return [
        item
        for item in meeting.action_items or []
        if isinstance(item, dict)
        and not item.get("__tiki_meta")
        and item.get("type") != "__tiki_meeting_meta"
    ]


def _list_from_meta(value: object) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [line.strip() for line in value.splitlines() if line.strip()]
    return [value]


def _analysis_extra_for_meeting(db: Session, meeting: Meeting) -> dict:
    """The structured summary (keywords/decisions/issues/next agenda) for a
    "회의록 직접 작성" meeting lives in a __tiki_meeting_meta marker inside
    action_items (see _meeting_meta) — but an uploaded/AI-analyzed meeting
    never gets that marker at all, so this returned {} for every such
    meeting and the Jira/Notion sync always rendered "없음" for issues/next
    agenda even when the real AI analysis clearly had them. Look up the
    AnalysisResult tied to this meeting (via the created_meeting_id it was
    tagged with in app/workers/tasks.py) as a fallback source instead.
    """
    result = db.scalar(
        select(AnalysisResult).where(
            AnalysisResult.extra_data["created_meeting_id"].astext == str(meeting.id)
        )
    )
    if result is None:
        return {}
    extra = dict(result.extra_data or {})
    extra.setdefault("summary", result.summary)
    if not extra.get("raw_text") and result.extracted_content is not None:
        extra["raw_text"] = result.extracted_content.masked_text or result.extracted_content.raw_text
    return extra


def _analysis_payload_for_meeting(db: Session, meeting: Meeting) -> dict:
    meta = _meeting_meta(meeting)
    if not meta:
        meta = _analysis_extra_for_meeting(db, meeting)
    keywords = _list_from_meta(meta.get("keywords")) or meeting.tags or []
    raw_text = meta.get("raw_text") or meta.get("content") or meta.get("fullText") or meeting.summary
    return {
        "summary": _service_text(meta.get("summary") or meeting.summary),
        "decisions": _list_from_meta(meta.get("decisions")),
        "action_items": _visible_meeting_actions(meeting),
        "issues": _list_from_meta(meta.get("issues")),
        "next_agenda": _list_from_meta(meta.get("nextAgenda") or meta.get("next_agenda")),
        "raw_text": _service_text(raw_text),
        "keywords": keywords,
        "ai_extra": meta,
    }


def _clean_tag(value: object) -> str:
    return str(value or "").strip().lstrip("#")


def _format_due(value: object) -> str:
    return str(value or "").strip().replace("-", ".") or "-"


_JIRA_DUE_DATE_RE = re.compile(r"^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})")


def _normalize_jira_due_date(value: object) -> str | None:
    """Coerce TIKI's various due-date formats (e.g. "2026.07.11") into the
    "yyyy-MM-dd" shape Jira's API requires. Returns None (omit the field)
    rather than send a value Jira would reject with a 400."""
    match = _JIRA_DUE_DATE_RE.match(str(value or "").strip())
    if not match:
        return None
    year, month, day = match.groups()
    return f"{year}-{int(month):02d}-{int(day):02d}"


def _meeting_markdown(db: Session, meeting: Meeting) -> str:
    project = db.get(Project, meeting.project_id)
    payload = _analysis_payload_for_meeting(db, meeting)
    meta = payload.get("ai_extra") or {}
    participants = [str(name).strip() for name in (meeting.participants or []) if str(name).strip()]
    keywords = [_clean_tag(tag) for tag in (payload.get("keywords") or []) if _clean_tag(tag)]
    decisions = [_text_from_item(item) for item in payload.get("decisions", []) if _text_from_item(item)]
    issues = [_text_from_item(item) for item in payload.get("issues", []) if _text_from_item(item)]
    next_agenda = [_text_from_item(item) for item in payload.get("next_agenda", []) if _text_from_item(item)]
    action_items = [item for item in payload.get("action_items", []) if isinstance(item, dict)]

    lines: list[str] = [
        f"# {meeting.date} {_service_text(meeting.title)}",
        "",
        "## 기본 정보",
        f"- 프로젝트: {project.name if project else '-'}",
        f"- 회의 날짜: {meeting.date}",
        f"- 회의 유형: {meeting.meeting_type or '-'}",
        f"- 참석자: {', '.join(participants) if participants else '-'}",
        "",
        "## 회의 요약",
        payload.get("summary") or "요약이 없습니다.",
        "",
        "## 핵심 키워드",
    ]
    lines.extend([f"- #{tag}" for tag in keywords] or ["- 없음"])

    lines.extend(["", "## 주요 결정사항"])
    lines.extend([f"- {item}" for item in decisions] or ["- 없음"])

    lines.extend(["", "## 해야 할 일"])
    if action_items:
        for item in action_items:
            title = _service_text(item.get("title") or item.get("text") or "해야 할 일")
            assignee = item.get("assignee") or "-"
            due = _format_due(item.get("due") or item.get("due_at") or item.get("dueDate"))
            status = str(item.get("status") or "").strip()
            checked = "x" if status == "수행완료" or item.get("checked") else " "
            description = _service_text(item.get("description") or "").strip()
            lines.extend(
                [
                    f"- [{checked}] {title}",
                    "",
                    f"담당자 : {assignee}",
                    f"마감일 : {due}",
                    *([f"설명 : {description}"] if description else []),
                    "--------------------",
                ]
            )
    else:
        lines.append("- 없음")

    lines.extend(["", "## 이슈"])
    if issues:
        for item in issues:
            priority = item.get("priority") if isinstance(item, dict) else None
            text = _text_from_item(item)
            lines.append(f"- {text}{f' ({priority})' if priority else ''}")
    else:
        lines.append("- 없음")

    lines.extend(["", "## 다음 안건"])
    lines.extend([f"- {item}" for item in next_agenda] or ["- 없음"])

    if isinstance(meta, dict) and meta.get("source") == "manual":
        lines.extend(["", "<!-- TIKI manual meeting metadata synced -->"])
    return "\n".join(lines)


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
        if provider == IntegrationProvider.NOTION:
            token = decrypt_secret(integration.access_token) or ""
            client = get_notion_client(access_token=token)
            if client.page_exists(link.external_id):
                return link
            link.external_id = None
            link.external_url = None
            link.sync_status = SyncStatus.PENDING
            db.flush()
        elif provider == IntegrationProvider.JIRA:
            token = _get_valid_jira_access_token(db, integration)
            db.commit()
            client = JiraOAuthClient(access_token=token, cloud_id=integration.cloud_id, site_url=integration.external_site_url)
            existing_project_key = client.get_issue_project_key(link.external_id)
            target_project_key = integration.jira_project_key or settings.jira_project_key
            if existing_project_key is not None and existing_project_key == target_project_key:
                return link
            link.external_id = None
            link.external_url = None
            link.sync_status = SyncStatus.PENDING
            db.flush()
        else:
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
        if provider == IntegrationProvider.NOTION:
            token = decrypt_secret(integration.access_token) or ""
            client = get_notion_client(access_token=token)
            project = db.get(Project, meeting.project_id)
            if project is None:
                raise RuntimeError("Project not found")
            database_id = _notion_meeting_database_id(db, integration, client, project)
            existing_page_id = link.external_id
            existing_page_alive = client.page_exists(existing_page_id) if existing_page_id else False
            if existing_page_id and not existing_page_alive:
                sync_mode = "recreate"
            elif existing_page_id and existing_page_alive:
                sync_mode = "update"
            else:
                sync_mode = "create"
            logger.info(
                "[Notion Sync] meeting_id=%s project_id=%s meeting_title=%s source_type=meeting analysis_result_id=None uploaded_file_id=None notion_page_id=%s sync_mode=%s",
                meeting.id,
                meeting.project_id,
                meeting.title,
                existing_page_id,
                sync_mode,
            )
            page = client.upsert_meeting_page(
                database_id=database_id,
                meeting_id=str(meeting.id),
                title=f"{meeting.date} {_service_text(meeting.title)}",
                project_name=project.name,
                meeting_date=meeting.date,
                meeting_type=meeting.meeting_type or "",
                participants=meeting.participants or [],
                markdown=_meeting_markdown(db, meeting),
                existing_page_id=existing_page_id if existing_page_alive else None,
            )
            link.external_id = page.page_id
            link.external_url = page.page_url
            logger.info(
                "[Notion Sync] meeting_id=%s project_id=%s notion_page_id=%s sync_mode=%s status=synced",
                meeting.id,
                meeting.project_id,
                page.page_id,
                sync_mode,
            )
        elif provider == IntegrationProvider.JIRA:
            token = _get_valid_jira_access_token(db, integration)
            client = JiraOAuthClient(
                access_token=token,
                cloud_id=integration.cloud_id,
                site_url=integration.external_site_url,
            )
            project_key = integration.jira_project_key or settings.jira_project_key
            if not project_key:
                raise RuntimeError("Jira project is not selected for this project")
            title = f"Meeting - {meeting.date} {_service_text(meeting.title)}"
            description = _meeting_description(db, meeting)
            if link.external_id and not client.issue_exists(link.external_id):
                link.external_id = None
                link.external_url = None
            if link.external_id:
                client.update_issue(link.external_id, title=title, description=description)
            else:
                # Represent the meeting as this project's top-of-hierarchy issue type
                # (Epic in software projects, Workstream in business projects) so it
                # reads as a container/document rather than another flat task — falls
                # back to a plain issue if the project has no such type configured.
                container_type = client.get_container_issue_type(project_key)
                issue = client.create_issue(
                    project_key=project_key,
                    title=title,
                    description=description,
                    issue_type="Task",
                    issue_type_id=container_type["id"] if container_type else None,
                )
                link.external_id = issue.issue_id
                link.external_url = issue.issue_url
        link.sync_status = SyncStatus.SYNCED
        link.error_message = None
        link.last_synced_at = _now()
    except Exception as exc:
        link.sync_status = SyncStatus.FAILED
        link.error_message = str(exc)
        link.last_synced_at = _now()
        if provider == IntegrationProvider.NOTION:
            logger.exception(
                "[Notion Sync] meeting_id=%s project_id=%s meeting_title=%s source_type=meeting analysis_result_id=None uploaded_file_id=None notion_page_id=%s sync_mode=failed",
                meeting.id,
                meeting.project_id,
                meeting.title,
                link.external_id,
            )
    db.commit()
    db.refresh(link)
    return link


def sync_connected_meeting_resources(db: Session, meeting: Meeting, *, force: bool = False) -> None:
    providers = db.scalars(
        select(ProjectIntegration.provider).where(
            ProjectIntegration.project_id == meeting.project_id,
            ProjectIntegration.status == "connected",
        )
    ).all()
    for provider in providers:
        ensure_meeting_external_resource(db, meeting, provider, force=force)
        if provider == IntegrationProvider.JIRA:
            try:
                sync_all_meeting_tasks_to_jira(db, meeting)
            except Exception:
                logger.exception("Failed to auto-sync meeting %s tasks to Jira", meeting.id)
        elif provider == IntegrationProvider.NOTION:
            try:
                sync_all_meeting_tasks_to_notion(db, meeting)
            except Exception:
                logger.exception("Failed to auto-sync meeting %s tasks to Notion", meeting.id)


def archive_meeting_external_resources(db: Session, meeting: Meeting) -> None:
    links = db.scalars(select(MeetingExternalLink).where(MeetingExternalLink.meeting_id == meeting.id)).all()
    for link in links:
        if link.provider != IntegrationProvider.NOTION or not link.external_id:
            continue
        integration = _project_integration(db, meeting.project_id, IntegrationProvider.NOTION)
        if integration is None:
            continue
        try:
            client = get_notion_client(access_token=decrypt_secret(integration.access_token) or "")
            client.mark_meeting_deleted(page_id=link.external_id)
            link.sync_status = SyncStatus.SYNCED
            link.error_message = None
            link.last_synced_at = _now()
        except Exception as exc:
            link.sync_status = SyncStatus.FAILED
            link.error_message = str(exc)
            link.last_synced_at = _now()


def sync_project_meeting_resources(db: Session, project_id: UUID, provider: IntegrationProvider) -> dict:
    meetings = db.scalars(
        select(Meeting)
        .where(Meeting.project_id == project_id)
        .order_by(Meeting.created_at.asc())
    ).all()
    result = {"total": len(meetings), "synced": 0, "failed": 0, "errors": []}
    for meeting in meetings:
        link = ensure_meeting_external_resource(db, meeting, provider, force=True)
        if link.sync_status == SyncStatus.SYNCED:
            result["synced"] += 1
            if provider == IntegrationProvider.JIRA:
                try:
                    sync_all_meeting_tasks_to_jira(db, meeting)
                except Exception:
                    logger.exception("Failed to auto-sync meeting %s tasks to Jira during bulk resync", meeting.id)
            elif provider == IntegrationProvider.NOTION:
                try:
                    sync_all_meeting_tasks_to_notion(db, meeting)
                except Exception:
                    logger.exception("Failed to auto-sync meeting %s tasks to Notion during bulk resync", meeting.id)
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
    results = _sync_tasks_to_provider(db, meeting, provider, task_ids)
    return TaskSendResponse(meetingId=meeting.id, provider=provider, results=results)


def _all_task_ids(meeting: Meeting) -> list[str]:
    return [
        _task_id(meeting, item, index)
        for index, item in enumerate(meeting.action_items or [])
        if isinstance(item, dict) and not item.get("__tiki_meta") and item.get("type") != "__tiki_meeting_meta"
    ]


def sync_all_meeting_tasks_to_jira(db: Session, meeting: Meeting) -> None:
    """Auto-sync every action item on a meeting to its own Jira issue.

    Mirrors what the manual "연동하기" button does per task, but runs whenever the
    meeting itself syncs so users don't have to click through each task by hand.
    """
    integration = _project_integration(db, meeting.project_id, IntegrationProvider.JIRA)
    if integration is None:
        return
    task_ids = _all_task_ids(meeting)
    if not task_ids:
        return
    _sync_tasks_to_provider(db, meeting, IntegrationProvider.JIRA, task_ids)


def sync_all_meeting_tasks_to_notion(db: Session, meeting: Meeting) -> None:
    """Auto-link every action item on a meeting to the meeting's Notion page.

    Notion has no separate per-task issue — tasks live as to-do blocks inside the
    meeting page itself — so this just records that page's URL against each task
    (mirroring the manual "연동하기" button) so the UI can show "Notion 확인" for
    every task, not only ones someone happened to send by hand before.
    """
    integration = _project_integration(db, meeting.project_id, IntegrationProvider.NOTION)
    if integration is None:
        return
    task_ids = _all_task_ids(meeting)
    if not task_ids:
        return
    _sync_tasks_to_provider(db, meeting, IntegrationProvider.NOTION, task_ids)


def _sync_tasks_to_provider(
    db: Session, meeting: Meeting, provider: IntegrationProvider, task_ids: list[str]
) -> list[ExternalTaskLinkResponse]:
    meeting_link = ensure_meeting_external_resource(db, meeting, provider)
    if meeting_link.sync_status == SyncStatus.FAILED:
        raise AppException(detail=meeting_link.error_message or "Meeting sync failed", status_code=502, code="meeting_sync_failed")

    integration = _project_integration(db, meeting.project_id, provider)
    if integration is None:
        raise AppException(detail=f"{provider.value} is not connected", status_code=403, code=f"{provider.value}_not_connected")

    results: list[ExternalTaskLinkResponse] = []
    selected_ids = [str(item) for item in task_ids]
    should_resync_notion_page = False
    jira_account_id_cache: dict[str, str | None] = {}

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
            title = _service_text(task.get("title") or task.get("text") or "업무")
            description = _service_text(task.get("description") or meeting.summary or title)
            due_date = _normalize_jira_due_date(task.get("due") or task.get("due_at") or task.get("dueDate"))
            if provider == IntegrationProvider.JIRA:
                token = _get_valid_jira_access_token(db, integration)
                client = JiraOAuthClient(access_token=token, cloud_id=integration.cloud_id, site_url=integration.external_site_url)
                project_key = integration.jira_project_key or settings.jira_project_key
                if not project_key:
                    raise RuntimeError("Jira project is not selected for this project")
                existing_key = link.external_key or link.external_id or ""
                if existing_key and client.get_issue_project_key(existing_key) != project_key:
                    link.external_id = None
                    link.external_key = None
                    existing_key = ""

                assignee_name = str(task.get("assignee") or "").strip()
                if assignee_name not in jira_account_id_cache:
                    try:
                        jira_account_id_cache[assignee_name] = client.find_account_id(assignee_name) if assignee_name else None
                    except Exception:
                        logger.exception("Failed to look up Jira account for assignee %r", assignee_name)
                        jira_account_id_cache[assignee_name] = None
                assignee_account_id = jira_account_id_cache[assignee_name]

                if existing_key:
                    client.update_issue(
                        existing_key, title=title, description=description, due_date=due_date,
                        assignee_account_id=assignee_account_id,
                    )
                else:
                    parent_key = (
                        meeting_link.external_url.rstrip("/").split("/")[-1] if meeting_link.external_url else None
                    )
                    try:
                        # Prefer making the task a real child of the meeting issue (works
                        # when the project's hierarchy allows it, e.g. a Workstream/Epic
                        # parent) so it visually nests under the meeting instead of just
                        # loosely "relating" to it.
                        issue = client.create_issue(
                            project_key=project_key, title=title, description=description, issue_type="Task",
                            due_date=due_date, assignee_account_id=assignee_account_id, parent_key=parent_key,
                        )
                    except RuntimeError:
                        issue = client.create_issue(
                            project_key=project_key, title=title, description=description, issue_type="Task",
                            due_date=due_date, assignee_account_id=assignee_account_id,
                        )
                        parent_key = None
                    link.external_id = issue.issue_id
                    link.external_key = issue.issue_key
                    link.external_url = issue.issue_url
                    if not parent_key and meeting_link.external_url and issue.issue_key:
                        fallback_parent_key = meeting_link.external_url.rstrip("/").split("/")[-1]
                        client.link_issues(fallback_parent_key, issue.issue_key)
                # Align the issue's Jira status with whatever TIKI status it already has —
                # covers tasks synced for the first time (e.g. via bulk resync) that were
                # already marked 검토완료/수행완료 before a Jira issue existed for them.
                category_key = TASK_STATUS_TO_JIRA_CATEGORY.get(str(task.get("status") or ""))
                if category_key:
                    client.transition_to_category(link.external_key or link.external_id, category_key)
            else:
                should_resync_notion_page = True
                link.external_id = meeting_link.external_id
                link.external_url = meeting_link.external_url
                link.external_type = "notion_page_task_block"

            link.sync_status = SyncStatus.SYNCED
            link.error_message = None
            link.last_synced_at = _now()
            # Don't touch the task's own status here — with sync now running
            # automatically on every meeting update, forcing it to "연동완료" would
            # silently overwrite the user's actual review/completion progress
            # (검토대기/검토완료/수행완료) on every single sync.
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

    # Reassigning to list(meeting.action_items) does NOT reliably mark the JSONB column
    # dirty here: the "new" list is built from the very same (already in-place-mutated)
    # dict objects SQLAlchemy is comparing against for its change-detection, so the
    # before/after values look identical and the UPDATE gets silently skipped. Force it.
    meeting.action_items = list(meeting.action_items or [])
    flag_modified(meeting, "action_items")
    if should_resync_notion_page:
        refreshed_link = ensure_meeting_external_resource(db, meeting, IntegrationProvider.NOTION, force=True)
        for result in results:
            if str(result.provider.value if hasattr(result.provider, "value") else result.provider) == IntegrationProvider.NOTION.value and str(result.syncStatus.value if hasattr(result.syncStatus, "value") else result.syncStatus) == SyncStatus.SYNCED.value:
                result.externalId = refreshed_link.external_id
                result.externalUrl = refreshed_link.external_url
    db.commit()
    return results
