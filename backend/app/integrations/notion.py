"""Notion API 클라이언트 (OAuth 2.0 + 페이지 생성)."""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

NOTION_API_VERSION = "2022-06-28"
PRIORITY_EMOJI = {
    "low": "🟢",
    "medium": "🟡",
    "high": "🔴",
    "urgent": "🚨",
}


@dataclass
class NotionTokenResult:
    access_token: str
    workspace_id: str
    workspace_name: str
    bot_id: str


@dataclass
class NotionPageResult:
    page_id: str
    page_url: str


class NotionClient:
    def __init__(self, access_token: str | None = None) -> None:
        self.access_token = access_token or ""
        self.client_id = settings.notion_client_id or ""
        self.client_secret = settings.notion_client_secret or ""
        self.redirect_uri = settings.notion_redirect_uri or ""

    # ── OAuth ──────────────────────────────────────────────────────────────────

    def get_authorization_url(self, state: str = "") -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "owner": "user",
            "redirect_uri": self.redirect_uri,
        }
        if state:
            params["state"] = state
        return "https://api.notion.com/v1/oauth/authorize?" + urllib.parse.urlencode(params)

    def exchange_code_for_token(self, code: str) -> NotionTokenResult:
        credentials = f"{self.client_id}:{self.client_secret}"
        auth_header = "Basic " + base64.b64encode(credentials.encode()).decode()

        body = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
        }
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            "https://api.notion.com/v1/oauth/token",
            data=data,
            method="POST",
            headers={
                "Authorization": auth_header,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            logger.error("Notion OAuth error %s: %s", exc.code, body_text)
            raise RuntimeError(f"Notion OAuth {exc.code}: {body_text}") from exc

        return NotionTokenResult(
            access_token=result["access_token"],
            workspace_id=result.get("workspace_id", ""),
            workspace_name=result.get("workspace_name", ""),
            bot_id=result.get("bot_id", ""),
        )

    # ── API 요청 ──────────────────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"https://api.notion.com/v1/{path.lstrip('/')}"
        data = json.dumps(body).encode("utf-8") if body else None
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Notion-Version": NOTION_API_VERSION,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            logger.error("Notion API error %s: %s", exc.code, body_text)
            raise RuntimeError(f"Notion API {exc.code}: {body_text}") from exc

    @staticmethod
    def _rich_text(content: str) -> list[dict[str, Any]]:
        return [{"type": "text", "text": {"content": str(content or "")[:2000]}}]

    @staticmethod
    def _split_text(content: str, size: int = 1800) -> list[str]:
        text = str(content or "").strip()
        if not text:
            return []
        chunks: list[str] = []
        while text:
            chunk = text[:size]
            cut = max(chunk.rfind("\n"), chunk.rfind(". "), chunk.rfind("다."))
            if cut > size * 0.45:
                chunk = text[: cut + 1]
            chunks.append(chunk.strip())
            text = text[len(chunk):].strip()
        return chunks

    @staticmethod
    def _paragraph(content: str) -> dict[str, Any]:
        return {
            "object": "block",
            "type": "paragraph",
            "paragraph": {"rich_text": NotionClient._rich_text(content)},
        }

    @staticmethod
    def _paragraphs(content: str, fallback: str = "") -> list[dict[str, Any]]:
        chunks = NotionClient._split_text(content)
        if not chunks and fallback:
            chunks = [fallback]
        return [NotionClient._paragraph(chunk) for chunk in chunks]

    @staticmethod
    def _heading(content: str) -> dict[str, Any]:
        return {
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": NotionClient._rich_text(content)},
        }

    @staticmethod
    def _todo(content: str, checked: bool = False) -> dict[str, Any]:
        return {
            "object": "block",
            "type": "to_do",
            "to_do": {"rich_text": NotionClient._rich_text(content), "checked": checked},
        }

    def create_meeting_page(
        self,
        *,
        title: str,
        meeting_date: str,
        summary: str,
        decisions: list[str],
        action_items: list[dict[str, Any]],
        database_id: str | None = None,
        parent_page_id: str | None = None,
    ) -> NotionPageResult:
        if database_id:
            parent = {"type": "database_id", "database_id": database_id}
            properties = {
                "Name": {"title": self._rich_text(title)},
                "Date": {"rich_text": self._rich_text(meeting_date)},
            }
        elif parent_page_id:
            parent = {"type": "page_id", "page_id": parent_page_id}
            properties = {"title": self._rich_text(title)}
        else:
            raise ValueError("Notion meeting database or parent page is required")

        children: list[dict[str, Any]] = [
            self._heading("회의 요약"),
            self._paragraph(summary or "요약이 없습니다."),
            self._heading("결정사항"),
            *(self._paragraph(f"- {item}") for item in decisions),
            self._heading("업무"),
            *(
                self._todo(
                    f"{item.get('title') or item.get('text') or '업무'} / 담당자: {item.get('assignee') or '-'} / 마감일: {item.get('due') or item.get('due_at') or item.get('dueDate') or '-'}"
                )
                for item in action_items
            ),
        ]
        result = self._request("POST", "pages", {"parent": parent, "properties": properties, "children": children[:100]})
        page_id_result = result["id"]
        return NotionPageResult(page_id=page_id_result, page_url=result.get("url", f"https://notion.so/{page_id_result.replace('-', '')}"))

    def create_meeting_page(
        self,
        *,
        title: str,
        meeting_date: str,
        summary: str,
        decisions: list[str],
        action_items: list[dict[str, Any]],
        database_id: str | None = None,
        parent_page_id: str | None = None,
    ) -> NotionPageResult:
        if database_id:
            parent = {"type": "database_id", "database_id": database_id}
            properties = {
                "Name": {"title": self._rich_text(title)},
                "Date": {"rich_text": self._rich_text(meeting_date)},
            }
        elif parent_page_id:
            parent = {"type": "page_id", "page_id": parent_page_id}
            properties = {"title": self._rich_text(title)}
        else:
            raise ValueError("Notion meeting database or parent page is required")

        children: list[dict[str, Any]] = [
            self._heading("회의 요약"),
            *self._paragraphs(summary, "요약이 없습니다."),
            self._heading("결정사항"),
        ]
        for item in decisions:
            children.extend(self._paragraphs(f"- {item}"))
        children.append(self._heading("해야 할 일"))
        for item in action_items:
            if not isinstance(item, dict):
                continue
            title_text = item.get("title") or item.get("text") or "업무"
            due_text = item.get("due") or item.get("due_at") or item.get("dueDate") or "-"
            children.append(self._todo(f"{title_text} / 담당자: {item.get('assignee') or '-'} / 마감일: {due_text}"))
            children.extend(self._paragraphs(item.get("description") or item.get("detail") or ""))

        result = self._request("POST", "pages", {"parent": parent, "properties": properties, "children": children[:100]})
        page_id_result = result["id"]
        return NotionPageResult(page_id=page_id_result, page_url=result.get("url", f"https://notion.so/{page_id_result.replace('-', '')}"))

    def find_accessible_page_id(self) -> str | None:
        result = self._request(
            "POST",
            "search",
            {
                "filter": {"value": "page", "property": "object"},
                "sort": {"direction": "descending", "timestamp": "last_edited_time"},
                "page_size": 1,
            },
        )
        pages = result.get("results") or []
        if not pages:
            return None
        page_id = pages[0].get("id")
        return str(page_id) if page_id else None

    @staticmethod
    def _page_title(page: dict[str, Any]) -> str:
        properties = page.get("properties") or {}
        for prop in properties.values():
            if not isinstance(prop, dict) or prop.get("type") != "title":
                continue
            parts = prop.get("title") or []
            return "".join(str(part.get("plain_text") or "") for part in parts if isinstance(part, dict)).strip()
        return ""

    def find_page_by_title(self, title: str) -> str | None:
        result = self._request(
            "POST",
            "search",
            {
                "query": title,
                "filter": {"value": "page", "property": "object"},
                "sort": {"direction": "descending", "timestamp": "last_edited_time"},
                "page_size": 20,
            },
        )
        for page in result.get("results") or []:
            if self._page_title(page) == title:
                page_id = page.get("id")
                return str(page_id) if page_id else None
        return None

    def create_child_page(self, *, parent_page_id: str, title: str, description: str = "") -> NotionPageResult:
        children = self._paragraphs(description) if description else []
        result = self._request(
            "POST",
            "pages",
            {
                "parent": {"type": "page_id", "page_id": parent_page_id},
                "properties": {"title": self._rich_text(title)},
                "children": children[:100],
            },
        )
        page_id_result = result["id"]
        return NotionPageResult(page_id=page_id_result, page_url=result.get("url", f"https://notion.so/{page_id_result.replace('-', '')}"))

    def ensure_workspace_page_id(self, title: str = "TIKI 회의록") -> str | None:
        existing = self.find_page_by_title(title)
        if existing:
            return existing
        parent_page_id = self.find_accessible_page_id()
        if not parent_page_id:
            return None
        page = self.create_child_page(
            parent_page_id=parent_page_id,
            title=title,
            description="TIKI에서 프로젝트 회의록을 자동으로 모아두는 페이지입니다.",
        )
        return page.page_id

    def archive_page(self, page_id: str) -> None:
        if page_id:
            self._request("PATCH", f"pages/{page_id}", {"archived": True})

    def append_task_blocks(self, page_id: str, action_items: list[dict[str, Any]]) -> None:
        children = [
            self._todo(
                f"{item.get('title') or item.get('text') or '업무'} / 담당자: {item.get('assignee') or '-'} / 마감일: {item.get('due') or item.get('due_at') or item.get('dueDate') or '-'}"
            )
            for item in action_items
        ]
        if children:
            self._request("PATCH", f"blocks/{page_id}/children", {"children": children[:100]})

    def create_task_item(
        self,
        *,
        database_id: str,
        title: str,
        assignee: str | None,
        due_date: str | None,
        status: str,
        priority: str | None,
        meeting_title: str,
        tiki_task_id: str,
        description: str,
    ) -> NotionPageResult:
        properties: dict[str, Any] = {
            "Name": {"title": self._rich_text(title)},
            "Status": {"select": {"name": status or "검토대기"}},
            "TIKI task id": {"rich_text": self._rich_text(tiki_task_id)},
            "Meeting": {"rich_text": self._rich_text(meeting_title)},
        }
        if assignee:
            properties["Assignee"] = {"rich_text": self._rich_text(assignee)}
        if due_date:
            properties["Due"] = {"date": {"start": due_date[:10]}}
        if priority:
            properties["Priority"] = {"select": {"name": str(priority).capitalize()}}
        result = self._request(
            "POST",
            "pages",
            {
                "parent": {"type": "database_id", "database_id": database_id},
                "properties": properties,
                "children": [self._paragraph(description or title)],
            },
        )
        page_id_result = result["id"]
        return NotionPageResult(page_id=page_id_result, page_url=result.get("url", f"https://notion.so/{page_id_result.replace('-', '')}"))

    def update_task_item(
        self,
        *,
        page_id: str,
        title: str,
        assignee: str | None,
        due_date: str | None,
        status: str,
        priority: str | None,
    ) -> None:
        properties: dict[str, Any] = {
            "Name": {"title": self._rich_text(title)},
            "Status": {"select": {"name": status or "검토대기"}},
        }
        if assignee:
            properties["Assignee"] = {"rich_text": self._rich_text(assignee)}
        if due_date:
            properties["Due"] = {"date": {"start": due_date[:10]}}
        if priority:
            properties["Priority"] = {"select": {"name": str(priority).capitalize()}}
        self._request("PATCH", f"pages/{page_id}", {"properties": properties})

    # ── 페이지 생성 ───────────────────────────────────────────────────────────

    def create_page(
        self,
        title: str,
        description: str,
        priority: str = "medium",
        assignee: str | None = None,
        database_id: str | None = None,
        parent_page_id: str | None = None,
    ) -> NotionPageResult:
        emoji = PRIORITY_EMOJI.get(priority.lower(), "🟡")

        content_blocks: list[dict[str, Any]] = [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": description}}]
                },
            }
        ]
        if assignee:
            content_blocks.append({
                "object": "block",
                "type": "callout",
                "callout": {
                    "icon": {"type": "emoji", "emoji": "👤"},
                    "rich_text": [{"type": "text", "text": {"content": f"담당자: {assignee}"}}],
                },
            })

        if database_id:
            parent: dict[str, Any] = {"type": "database_id", "database_id": database_id}
            properties: dict[str, Any] = {
                "Name": {
                    "title": [{"type": "text", "text": {"content": f"{emoji} {title}"}}]
                },
                "Priority": {"select": {"name": priority.capitalize()}},
            }
            if assignee:
                properties["Assignee"] = {
                    "rich_text": [{"type": "text", "text": {"content": assignee}}]
                }
        else:
            if not parent_page_id:
                raise ValueError("database_id 또는 parent_page_id 중 하나는 필요합니다.")
            parent = {"type": "page_id", "page_id": parent_page_id}
            properties = {
                "title": [{"type": "text", "text": {"content": f"{emoji} {title}"}}]
            }

        body: dict[str, Any] = {
            "parent": parent,
            "properties": properties,
            "children": content_blocks,
        }

        result = self._request("POST", "pages", body)
        page_id_result = result["id"]
        page_url = result.get("url", f"https://notion.so/{page_id_result.replace('-', '')}")

        logger.info("Notion page created: %s", page_url)
        return NotionPageResult(page_id=page_id_result, page_url=page_url)

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)


def get_notion_client(access_token: str | None = None) -> NotionClient:
    return NotionClient(access_token=access_token)
