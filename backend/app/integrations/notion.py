"""Notion OAuth and database/page synchronization client."""

from __future__ import annotations

import base64
import json
import logging
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

NOTION_API_VERSION = "2022-06-28"
MEETING_DATABASE_TITLE = "TIKI 회의록"


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

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)

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
        data = json.dumps({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
        }).encode("utf-8")
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
            with urllib.request.urlopen(req, timeout=15) as response:
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

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"https://api.notion.com/v1/{path.lstrip('/')}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
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
            with urllib.request.urlopen(req, timeout=20) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            logger.error("Notion API error %s: %s", exc.code, body_text)
            raise RuntimeError(f"Notion API {exc.code}: {body_text}") from exc
        except urllib.error.URLError as exc:
            logger.error("Notion network error: %s", exc)
            raise RuntimeError(f"Notion network error: {exc}") from exc

    @staticmethod
    def _rich_text(content: str) -> list[dict[str, Any]]:
        return [{"type": "text", "text": {"content": str(content or "")[:2000]}}]

    @staticmethod
    def _split_text(content: str, size: int = 1800) -> list[str]:
        text = str(content or "").replace("\r\n", "\n").strip()
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

    @classmethod
    def paragraph(cls, content: str) -> dict[str, Any]:
        return {"object": "block", "type": "paragraph", "paragraph": {"rich_text": cls._rich_text(content)}}

    @classmethod
    def heading(cls, content: str, level: int = 2) -> dict[str, Any]:
        block_type = "heading_1" if level == 1 else "heading_3" if level >= 3 else "heading_2"
        return {"object": "block", "type": block_type, block_type: {"rich_text": cls._rich_text(content)}}

    @classmethod
    def bulleted(cls, content: str) -> dict[str, Any]:
        return {"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": cls._rich_text(content)}}

    @classmethod
    def todo(cls, content: str, checked: bool = False) -> dict[str, Any]:
        return {"object": "block", "type": "to_do", "to_do": {"rich_text": cls._rich_text(content), "checked": checked}}

    @classmethod
    def divider(cls) -> dict[str, Any]:
        return {"object": "block", "type": "divider", "divider": {}}

    @classmethod
    def callout(cls, lines: list[str]) -> dict[str, Any]:
        return {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": cls._rich_text("\n".join(line for line in lines if line)),
                "icon": {"emoji": "📌"},
            },
        }

    @classmethod
    def markdown_to_blocks(cls, markdown: str) -> list[dict[str, Any]]:
        blocks: list[dict[str, Any]] = []
        paragraph_lines: list[str] = []

        def flush_paragraph() -> None:
            if not paragraph_lines:
                return
            text = "\n".join(paragraph_lines).strip()
            paragraph_lines.clear()
            for chunk in cls._split_text(text):
                blocks.append(cls.paragraph(chunk))

        for raw_line in str(markdown or "").splitlines():
            line = raw_line.rstrip()
            stripped = line.strip()
            if not stripped:
                flush_paragraph()
                continue
            if stripped in {"---", "----", "***"}:
                flush_paragraph()
                blocks.append(cls.divider())
                continue
            heading_match = re.match(r"^(#{1,3})\s+(.+)$", stripped)
            if heading_match:
                flush_paragraph()
                blocks.append(cls.heading(heading_match.group(2).strip(), len(heading_match.group(1))))
                continue
            todo_match = re.match(r"^[-*]\s+\[( |x|X)\]\s+(.+)$", stripped)
            if todo_match:
                flush_paragraph()
                blocks.append(cls.todo(todo_match.group(2).strip(), todo_match.group(1).lower() == "x"))
                continue
            bullet_match = re.match(r"^[-*]\s+(.+)$", stripped)
            if bullet_match:
                flush_paragraph()
                blocks.append(cls.bulleted(bullet_match.group(1).strip()))
                continue
            paragraph_lines.append(line)

        flush_paragraph()
        return blocks

    @staticmethod
    def _page_title(page: dict[str, Any]) -> str:
        properties = page.get("properties") or {}
        for prop in properties.values():
            if isinstance(prop, dict) and prop.get("type") == "title":
                return "".join(part.get("plain_text", "") for part in prop.get("title", []) if isinstance(part, dict)).strip()
        return ""

    def retrieve_page(self, page_id: str) -> dict[str, Any] | None:
        try:
            return self._request("GET", f"pages/{page_id}")
        except RuntimeError as exc:
            if "Notion API 404" in str(exc):
                return None
            raise

    def page_exists(self, page_id: str | None) -> bool:
        page = self.retrieve_page(page_id) if page_id else None
        return bool(page and not page.get("archived"))

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
        return str(pages[0]["id"]) if pages else None

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
            if not page.get("archived") and self._page_title(page) == title:
                return str(page.get("id"))
        return None

    def create_child_page(self, *, parent_page_id: str, title: str) -> NotionPageResult:
        result = self._request(
            "POST",
            "pages",
            {
                "parent": {"type": "page_id", "page_id": parent_page_id},
                "properties": {"title": self._rich_text(title)},
            },
        )
        page_id = result["id"]
        return NotionPageResult(page_id=page_id, page_url=result.get("url", f"https://notion.so/{page_id.replace('-', '')}"))

    @staticmethod
    def _database_title(database: dict[str, Any]) -> str:
        return "".join(
            part.get("plain_text", "")
            for part in database.get("title", [])
            if isinstance(part, dict)
        ).strip()

    def find_databases_by_title(self, title: str = MEETING_DATABASE_TITLE) -> list[dict[str, Any]]:
        result = self._request(
            "POST",
            "search",
            {"query": title, "filter": {"value": "database", "property": "object"}, "page_size": 20},
        )
        return [
            database
            for database in result.get("results") or []
            if self._database_title(database) == title and not database.get("archived")
        ]

    def database_active_row_count(self, database_id: str) -> int:
        result = self._request("POST", f"databases/{database_id}/query", {"page_size": 100})
        return len([page for page in result.get("results") or [] if not page.get("archived")])

    def query_database(self, database_id: str, *, page_size: int = 100) -> dict[str, Any]:
        return self._request("POST", f"databases/{database_id}/query", {"page_size": page_size})

    def archive_database(self, database_id: str) -> None:
        self._request("PATCH", f"databases/{database_id}", {"archived": True})

    def archive_empty_duplicate_meeting_databases(self, canonical_database_id: str) -> None:
        for database in self.find_databases_by_title():
            database_id = str(database.get("id") or "")
            if not database_id or database_id == canonical_database_id:
                continue
            try:
                if self.database_active_row_count(database_id) == 0:
                    self.archive_database(database_id)
            except Exception:
                logger.exception("Failed to archive empty duplicate Notion meeting database %s", database_id)

    def find_database_by_title(self, title: str = MEETING_DATABASE_TITLE) -> str | None:
        candidates = self.find_databases_by_title(title)
        if not candidates:
            return None
        ranked: list[tuple[int, str]] = []
        for database in candidates:
            database_id = str(database.get("id") or "")
            if not database_id:
                continue
            try:
                row_count = self.database_active_row_count(database_id)
            except Exception:
                logger.exception("Failed to count Notion database rows %s", database_id)
                row_count = 0
            ranked.append((row_count, database_id))
        if not ranked:
            return None
        ranked.sort(key=lambda item: item[0], reverse=True)
        return ranked[0][1]

    def parent_page_title(self, database: dict[str, Any]) -> str:
        parent = database.get("parent") or {}
        if parent.get("type") != "page_id":
            return ""
        page = self.retrieve_page(str(parent.get("page_id") or ""))
        return self._page_title(page or {})

    def find_project_meeting_database(self, project_name: str) -> str | None:
        for database in self.find_databases_by_title():
            database_id = str(database.get("id") or "")
            if not database_id:
                continue
            try:
                self.database_active_row_count(database_id)
            except Exception:
                logger.warning("Skipping inaccessible Notion meeting database %s", database_id)
                continue
            if self.parent_page_title(database) == project_name:
                return database_id
        return None

    def ensure_project_page_id(self, project_name: str) -> str:
        existing = self.find_page_by_title(project_name)
        if existing:
            return existing
        parent_page_id = settings.notion_parent_page_id or self.find_accessible_page_id()
        if not parent_page_id:
            raise RuntimeError("Notion에서 프로젝트 페이지를 만들 수 있는 페이지 권한이 없습니다.")
        return self.create_child_page(parent_page_id=parent_page_id, title=project_name).page_id

    def ensure_project_meeting_database_id(self, project_name: str, configured_database_id: str | None = None) -> str:
        if configured_database_id:
            configured = self.retrieve_database(configured_database_id)
            configured_accessible = False
            if configured:
                try:
                    self.database_active_row_count(configured_database_id)
                    configured_accessible = True
                except Exception:
                    logger.warning("Configured Notion meeting database is not queryable: %s", configured_database_id)
            if configured and configured_accessible and self.parent_page_title(configured) == project_name:
                self.ensure_database_schema(configured_database_id)
                return configured_database_id
        existing = self.find_project_meeting_database(project_name)
        if existing:
            self.ensure_database_schema(existing)
            return existing
        project_page_id = self.ensure_project_page_id(project_name)
        return self.create_meeting_database(project_page_id)

    def retrieve_database(self, database_id: str) -> dict[str, Any] | None:
        try:
            return self._request("GET", f"databases/{database_id}")
        except RuntimeError as exc:
            if "Notion API 404" in str(exc):
                return None
            raise

    def create_meeting_database(self, parent_page_id: str, title: str = MEETING_DATABASE_TITLE) -> str:
        result = self._request(
            "POST",
            "databases",
            {
                "parent": {"type": "page_id", "page_id": parent_page_id},
                "title": self._rich_text(title),
                "properties": {
                    "제목": {"title": {}},
                    "Meeting ID": {"rich_text": {}},
                    "프로젝트": {"rich_text": {}},
                    "회의 날짜": {"date": {}},
                    "회의 유형": {"select": {}},
                    "참석자": {"multi_select": {}},
                    "상태": {"select": {}},
                    "생성일": {"created_time": {}},
                    "수정일": {"last_edited_time": {}},
                },
            },
        )
        return str(result["id"])

    def ensure_meeting_database_id(self) -> str:
        configured = settings.notion_meeting_database_id
        if configured and self.retrieve_database(configured):
            self.ensure_database_schema(configured)
            return configured
        existing = self.find_database_by_title()
        if existing:
            self.ensure_database_schema(existing)
            self.archive_empty_duplicate_meeting_databases(existing)
            return existing
        parent_page_id = settings.notion_parent_page_id or self.find_accessible_page_id()
        if not parent_page_id:
            raise RuntimeError("Notion에서 TIKI 회의록 Database를 만들 수 있는 페이지 권한이 없습니다.")
        return self.create_meeting_database(parent_page_id)

    def title_property_name(self, database_id: str) -> str:
        database = self.retrieve_database(database_id) or {}
        for name, prop in (database.get("properties") or {}).items():
            if prop.get("type") == "title":
                return name
        return "제목"

    def ensure_database_schema(self, database_id: str) -> None:
        database = self.retrieve_database(database_id) or {}
        props = database.get("properties") or {}
        missing: dict[str, Any] = {}
        desired = {
            "Meeting ID": {"rich_text": {}},
            "프로젝트": {"rich_text": {}},
            "회의 날짜": {"date": {}},
            "회의 유형": {"select": {}},
            "참석자": {"multi_select": {}},
            "상태": {"select": {}},
            "생성일": {"created_time": {}},
            "수정일": {"last_edited_time": {}},
        }
        for name, schema in desired.items():
            if name not in props:
                missing[name] = schema
        if missing:
            self._request("PATCH", f"databases/{database_id}", {"properties": missing})

    def query_meeting_page(self, database_id: str, meeting_id: str) -> NotionPageResult | None:
        pages = self.query_meeting_pages(database_id, meeting_id, page_size=1)
        return pages[0] if pages else None

    def query_meeting_pages(self, database_id: str, meeting_id: str, page_size: int = 20) -> list[NotionPageResult]:
        result = self._request(
            "POST",
            f"databases/{database_id}/query",
            {"filter": {"property": "Meeting ID", "rich_text": {"equals": meeting_id}}, "page_size": page_size},
        )
        rows = result.get("results") or []
        return [
            NotionPageResult(page_id=page["id"], page_url=page.get("url", f"https://notion.so/{page['id'].replace('-', '')}"))
            for page in rows
            if not page.get("archived")
        ]

    def meeting_properties(
        self,
        *,
        database_id: str,
        meeting_id: str,
        title: str,
        project_name: str,
        meeting_date: str,
        meeting_type: str,
        participants: list[str],
        status: str = "동기화 완료",
    ) -> dict[str, Any]:
        title_prop = self.title_property_name(database_id)
        properties: dict[str, Any] = {
            title_prop: {"title": self._rich_text(title)},
            "Meeting ID": {"rich_text": self._rich_text(meeting_id)},
            "프로젝트": {"rich_text": self._rich_text(project_name)},
            "회의 유형": {"select": {"name": meeting_type or "회의"}},
            "참석자": {"multi_select": [{"name": str(name)[:100]} for name in participants if str(name).strip()]},
            "상태": {"select": {"name": status}},
        }
        if meeting_date:
            normalized = str(meeting_date).replace(".", "-")[:10]
            properties["회의 날짜"] = {"date": {"start": normalized}}
        return properties

    def replace_page_children(self, page_id: str, children: list[dict[str, Any]]) -> None:
        cursor: str | None = None
        while True:
            suffix = f"?start_cursor={urllib.parse.quote(cursor)}" if cursor else ""
            result = self._request("GET", f"blocks/{page_id}/children{suffix}")
            for block in result.get("results") or []:
                block_id = block.get("id")
                if block_id:
                    self._request("DELETE", f"blocks/{block_id}")
            if not result.get("has_more"):
                break
            cursor = result.get("next_cursor")
        for index in range(0, len(children), 100):
            self._request("PATCH", f"blocks/{page_id}/children", {"children": children[index:index + 100]})

    def upsert_meeting_page(
        self,
        *,
        database_id: str,
        meeting_id: str,
        title: str,
        project_name: str,
        meeting_date: str,
        meeting_type: str,
        participants: list[str],
        markdown: str,
        existing_page_id: str | None = None,
    ) -> NotionPageResult:
        self.ensure_database_schema(database_id)
        existing_pages = [
            page for page in self.query_meeting_pages(database_id, meeting_id)
            if self.page_exists(page.page_id)
        ]
        target_page_id = existing_page_id if existing_page_id and self.page_exists(existing_page_id) else None
        if target_page_id is None and existing_pages:
            target_page_id = existing_pages[0].page_id

        properties = self.meeting_properties(
            database_id=database_id,
            meeting_id=meeting_id,
            title=title,
            project_name=project_name,
            meeting_date=meeting_date,
            meeting_type=meeting_type,
            participants=participants,
        )
        blocks = self.markdown_to_blocks(markdown)
        duplicate_page_ids = {
            page.page_id
            for page in existing_pages
            if page.page_id != target_page_id
        }
        for page_id in duplicate_page_ids:
            try:
                self.mark_meeting_deleted(page_id=page_id, database_id=database_id)
            except Exception:
                logger.exception("Failed to archive duplicate Notion meeting page %s", page_id)

        if target_page_id:
            self._request("PATCH", f"pages/{target_page_id}", {"properties": properties})
            self.replace_page_children(target_page_id, blocks)
            page = self.retrieve_page(target_page_id) or {}
            return NotionPageResult(
                page_id=target_page_id,
                page_url=page.get("url", f"https://notion.so/{target_page_id.replace('-', '')}"),
            )

        result = self._request(
            "POST",
            "pages",
            {"parent": {"type": "database_id", "database_id": database_id}, "properties": properties, "children": blocks[:100]},
        )
        page_id = result["id"]
        for index in range(100, len(blocks), 100):
            self._request("PATCH", f"blocks/{page_id}/children", {"children": blocks[index:index + 100]})
        return NotionPageResult(page_id=page_id, page_url=result.get("url", f"https://notion.so/{page_id.replace('-', '')}"))

    def mark_meeting_deleted(self, *, page_id: str, database_id: str | None = None) -> None:
        if not page_id:
            return
        body: dict[str, Any] = {"archived": True}
        self._request("PATCH", f"pages/{page_id}", body)

    def archive_page(self, page_id: str) -> None:
        self.mark_meeting_deleted(page_id=page_id)

    def create_page(
        self,
        title: str,
        description: str,
        priority: str = "medium",
        assignee: str | None = None,
        database_id: str | None = None,
        parent_page_id: str | None = None,
    ) -> NotionPageResult:
        parent: dict[str, Any]
        properties: dict[str, Any]
        if database_id:
            parent = {"type": "database_id", "database_id": database_id}
            title_prop = self.title_property_name(database_id)
            properties = {
                title_prop: {"title": self._rich_text(title)},
            }
            database = self.retrieve_database(database_id) or {}
            available_props = database.get("properties") or {}
            if "Status" in available_props:
                properties["Status"] = {"select": {"name": "검토대기"}}
            if "Priority" in available_props and priority:
                properties["Priority"] = {"select": {"name": str(priority).capitalize()}}
            if "Assignee" in available_props and assignee:
                properties["Assignee"] = {"rich_text": self._rich_text(assignee)}
        else:
            if not parent_page_id:
                parent_page_id = settings.notion_parent_page_id or self.find_accessible_page_id()
            if not parent_page_id:
                raise ValueError("database_id 또는 parent_page_id 중 하나는 필요합니다.")
            parent = {"type": "page_id", "page_id": parent_page_id}
            properties = {"title": self._rich_text(title)}

        children = [self.paragraph(description or title)]
        if assignee:
            children.append(self.callout([f"담당자: {assignee}"]))
        result = self._request("POST", "pages", {"parent": parent, "properties": properties, "children": children})
        page_id = result["id"]
        return NotionPageResult(page_id=page_id, page_url=result.get("url", f"https://notion.so/{page_id.replace('-', '')}"))

    def append_task_blocks(self, page_id: str, action_items: list[dict[str, Any]]) -> None:
        children = [
            self.todo(
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
                "children": [self.paragraph(description or title)],
            },
        )
        return NotionPageResult(page_id=result["id"], page_url=result.get("url", f"https://notion.so/{result['id'].replace('-', '')}"))

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


def get_notion_client(access_token: str | None = None) -> NotionClient:
    return NotionClient(access_token=access_token)
