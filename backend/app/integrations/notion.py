"""Notion API 클라이언트 (OAuth 2.0 + 페이지 생성)."""

from __future__ import annotations

import base64
import json
import logging
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
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))

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
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))

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
            page_id = parent_page_id or ""
            parent = {"type": "page_id", "page_id": page_id} if page_id else {"type": "workspace", "workspace": True}
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
