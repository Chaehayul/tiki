"""Jira REST API v3 클라이언트."""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Any

import urllib.request
import urllib.parse
import json

from app.core.config import settings

logger = logging.getLogger(__name__)

PRIORITY_MAP = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "urgent": "Highest",
}


@dataclass
class JiraIssueResult:
    issue_key: str
    issue_url: str


class JiraClient:
    def __init__(
        self,
        base_url: str | None = None,
        email: str | None = None,
        api_token: str | None = None,
        project_key: str | None = None,
    ) -> None:
        self.base_url = (base_url or settings.jira_base_url or "").rstrip("/")
        self.email = email or settings.jira_email or ""
        self.api_token = api_token or settings.jira_api_token or ""
        self.project_key = project_key or settings.jira_project_key or ""

        credentials = f"{self.email}:{self.api_token}"
        self._auth_header = "Basic " + base64.b64encode(credentials.encode()).decode()

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base_url}/rest/api/3/{path.lstrip('/')}"
        data = json.dumps(body).encode("utf-8") if body else None
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Authorization": self._auth_header,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))

    def create_issue(
        self,
        title: str,
        description: str,
        priority: str = "medium",
        assignee: str | None = None,
    ) -> JiraIssueResult:
        jira_priority = PRIORITY_MAP.get(priority.lower(), "Medium")

        body: dict[str, Any] = {
            "fields": {
                "project": {"key": self.project_key},
                "summary": title,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": description}],
                        }
                    ],
                },
                "issuetype": {"name": "Task"},
                "priority": {"name": jira_priority},
            }
        }

        if assignee:
            body["fields"]["assignee"] = {"displayName": assignee}

        result = self._request("POST", "issue", body)
        issue_key = result["key"]
        issue_url = f"{self.base_url}/browse/{issue_key}"

        logger.info("Jira issue created: %s", issue_url)
        return JiraIssueResult(issue_key=issue_key, issue_url=issue_url)

    def is_configured(self) -> bool:
        return bool(self.base_url and self.email and self.api_token and self.project_key)


def get_jira_client() -> JiraClient:
    return JiraClient()
