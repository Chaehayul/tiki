"""Jira REST API v3 클라이언트."""

from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import json
import urllib.error
import urllib.parse
import urllib.request

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
    issue_id: str
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
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            logger.error("Jira API error %s: %s", exc.code, body_text)
            raise RuntimeError(f"Jira API {exc.code}: {body_text}") from exc

    def create_issue(
        self,
        title: str,
        description: str,
        priority: str = "medium",
        assignee: str | None = None,
        due_at: datetime | None = None,
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
            body["fields"]["assignee"] = {"accountId": assignee}
        if due_at:
            body["fields"]["duedate"] = due_at.date().isoformat()

        result = self._request("POST", "issue", body)
        issue_key = result["key"]
        issue_url = f"{self.base_url}/browse/{issue_key}"

        logger.info("Jira issue created: %s", issue_url)
        return JiraIssueResult(issue_id=result.get("id", issue_key), issue_key=issue_key, issue_url=issue_url)

    def is_configured(self) -> bool:
        return bool(self.base_url and self.email and self.api_token and self.project_key)


def get_jira_client() -> JiraClient:
    return JiraClient()


@dataclass
class JiraOAuthTokenResult:
    access_token: str
    refresh_token: str | None
    expires_in: int | None
    scope: str | None


@dataclass
class JiraResource:
    cloud_id: str
    name: str
    url: str


@dataclass
class JiraProjectOption:
    key: str
    name: str
    id: str


class JiraOAuthClient:
    def __init__(self, access_token: str | None = None, cloud_id: str | None = None, site_url: str | None = None) -> None:
        self.client_id = settings.jira_client_id or ""
        self.client_secret = settings.jira_client_secret or ""
        self.redirect_uri = settings.jira_redirect_uri or ""
        self.access_token = access_token or ""
        self.cloud_id = cloud_id or ""
        self.site_url = (site_url or "").rstrip("/")

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)

    def get_authorization_url(self, state: str) -> str:
        params = {
            "audience": "api.atlassian.com",
            "client_id": self.client_id,
            "scope": "read:jira-work write:jira-work read:jira-user offline_access",
            "redirect_uri": self.redirect_uri,
            "state": state,
            "response_type": "code",
            "prompt": "consent",
        }
        return "https://auth.atlassian.com/authorize?" + urllib.parse.urlencode(params)

    def exchange_code_for_token(self, code: str) -> JiraOAuthTokenResult:
        body = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri,
        }
        req = urllib.request.Request(
            "https://auth.atlassian.com/oauth/token",
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Jira OAuth {exc.code}: {body_text}") from exc
        return JiraOAuthTokenResult(
            access_token=result["access_token"],
            refresh_token=result.get("refresh_token"),
            expires_in=result.get("expires_in"),
            scope=result.get("scope"),
        )

    def refresh_access_token(self, refresh_token: str) -> JiraOAuthTokenResult:
        body = {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
        }
        req = urllib.request.Request(
            "https://auth.atlassian.com/oauth/token",
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Jira OAuth refresh {exc.code}: {body_text}") from exc
        return JiraOAuthTokenResult(
            access_token=result["access_token"],
            # Atlassian issues a new rotating refresh_token on every refresh; fall back to
            # the previous one only if the response omits it (shouldn't normally happen).
            refresh_token=result.get("refresh_token") or refresh_token,
            expires_in=result.get("expires_in"),
            scope=result.get("scope"),
        )

    def list_accessible_resources(self) -> list[JiraResource]:
        req = urllib.request.Request(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            method="GET",
            headers={"Authorization": f"Bearer {self.access_token}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))
        return [
            JiraResource(cloud_id=item.get("id", ""), name=item.get("name", ""), url=item.get("url", ""))
            for item in result
            if item.get("id")
        ]

    def list_projects(self) -> list["JiraProjectOption"]:
        result = self._api_request("GET", "project/search?maxResults=100")
        return [
            JiraProjectOption(key=item["key"], name=item.get("name", item["key"]), id=item.get("id", ""))
            for item in result.get("values", [])
            if item.get("key")
        ]

    def _api_request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"https://api.atlassian.com/ex/jira/{self.cloud_id}/rest/api/3/{path.lstrip('/')}"
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8") if body is not None else None,
            method=method,
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                text = response.read().decode("utf-8")
                return json.loads(text) if text else {}
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Jira API {exc.code}: {body_text}") from exc

    @staticmethod
    def _doc(text: str) -> dict[str, Any]:
        return {
            "type": "doc",
            "version": 1,
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": text[:30000]}]}],
        }

    def find_account_id(self, query: str) -> str | None:
        """Look up a Jira Cloud account id by display name or email.

        Returns None if nobody on the connected site matches — callers should
        leave the issue unassigned in that case rather than guessing.
        """
        query = (query or "").strip()
        if not query:
            return None
        result = self._api_request("GET", f"user/search?query={urllib.parse.quote(query)}&maxResults=1")
        if isinstance(result, list) and result:
            return result[0].get("accountId")
        return None

    def get_container_issue_type(self, project_key: str) -> dict[str, Any] | None:
        """Return this project's top-of-hierarchy issue type (Jira's "Epic" in
        software projects, "Workstream" in business projects), if it has one.

        Used so a whole meeting can be represented as one container issue with
        its action items as real child issues, instead of everything being a
        flat, same-looking "Task".
        """
        project = self._api_request("GET", f"project/{project_key}")
        project_id = project.get("id")
        if not project_id:
            return None
        issue_types = self._api_request("GET", f"issuetype/project?projectId={project_id}")
        return next((t for t in issue_types if t.get("hierarchyLevel") == 1), None)

    def get_standard_issue_type(self, project_key: str) -> dict[str, Any] | None:
        """Return a normal, non-subtask issue type for the project.

        Jira localizes issue type names (for example, Korean business projects use
        "작업" instead of "Task"), so API calls should prefer IDs over English names.
        """
        project = self._api_request("GET", f"project/{project_key}")
        project_id = project.get("id")
        if not project_id:
            return None
        issue_types = self._api_request("GET", f"issuetype/project?projectId={project_id}")
        return next((t for t in issue_types if t.get("hierarchyLevel") == 0 and not t.get("subtask")), None)

    def create_issue(
        self,
        *,
        project_key: str,
        title: str,
        description: str,
        issue_type: str = "Task",
        issue_type_id: str | None = None,
        due_date: str | None = None,
        assignee_account_id: str | None = None,
        parent_key: str | None = None,
    ) -> JiraIssueResult:
        fields: dict[str, Any] = {
            "project": {"key": project_key},
            "summary": title[:255],
            "description": self._doc(description or title),
            "issuetype": {"id": issue_type_id} if issue_type_id else {"name": issue_type},
        }
        if due_date:
            fields["duedate"] = due_date[:10]
        if assignee_account_id:
            fields["assignee"] = {"accountId": assignee_account_id}
        if parent_key:
            fields["parent"] = {"key": parent_key}
        try:
            result = self._api_request("POST", "issue", {"fields": fields})
        except RuntimeError as exc:
            # Description is optional and may be hidden by a project's field
            # configuration. Summary, however, is required by Jira, so retrying
            # the same summary payload cannot recover from a summary-field error.
            if "Field 'description' cannot be set" not in str(exc):
                raise
            minimal_fields: dict[str, Any] = {
                "project": {"key": project_key},
                "summary": title[:255],
                "issuetype": {"id": issue_type_id} if issue_type_id else {"name": issue_type},
            }
            if parent_key:
                minimal_fields["parent"] = {"key": parent_key}
            result = self._api_request("POST", "issue", {"fields": minimal_fields})
        issue_key = result["key"]
        return JiraIssueResult(
            issue_id=result.get("id", issue_key),
            issue_key=issue_key,
            issue_url=f"{self.site_url}/browse/{issue_key}" if self.site_url else "",
        )

    def update_issue(
        self,
        issue_id_or_key: str,
        *,
        title: str,
        description: str,
        due_date: str | None = None,
        assignee_account_id: str | None = None,
    ) -> None:
        fields: dict[str, Any] = {
            "summary": title[:255],
            "description": self._doc(description or title),
        }
        if due_date:
            fields["duedate"] = due_date[:10]
        if assignee_account_id:
            fields["assignee"] = {"accountId": assignee_account_id}
        self._api_request("PUT", f"issue/{issue_id_or_key}", {"fields": fields})

    def issue_exists(self, issue_id_or_key: str) -> bool:
        try:
            self._api_request("GET", f"issue/{issue_id_or_key}?fields=key")
            return True
        except RuntimeError as exc:
            if "Jira API 404" in str(exc):
                return False
            raise

    def get_issue_project_key(self, issue_id_or_key: str) -> str | None:
        """Return the project key an existing issue belongs to, or None if it
        no longer exists. Used to detect a stale link left over from before
        the user switched which Jira project this TIKI project syncs to —
        the issue ID can still resolve on the site while belonging to a
        completely different (old) project."""
        try:
            result = self._api_request("GET", f"issue/{issue_id_or_key}?fields=project")
        except RuntimeError as exc:
            if "Jira API 404" in str(exc):
                return None
            raise
        return result.get("fields", {}).get("project", {}).get("key")

    def get_transitions(self, issue_id_or_key: str) -> list[dict[str, Any]]:
        result = self._api_request("GET", f"issue/{issue_id_or_key}/transitions")
        return result.get("transitions", [])

    def transition_issue(self, issue_id_or_key: str, transition_id: str) -> None:
        self._api_request("POST", f"issue/{issue_id_or_key}/transitions", {"transition": {"id": transition_id}})

    def transition_to_category(self, issue_id_or_key: str, category_key: str) -> bool:
        """Move an issue to a status in the given Jira status category.

        category_key is one of Jira's three fixed categories: "new" (to do),
        "indeterminate" (in progress), or "done". Workflows are per-project and
        can have several statuses per category (e.g. "In Progress", "In Review"
        both under "indeterminate") — we simply take the first matching
        transition available from the issue's current status. Returns False if
        no transition into that category exists from where the issue is now.
        """
        transitions = self.get_transitions(issue_id_or_key)
        match = next(
            (t for t in transitions if (t.get("to") or {}).get("statusCategory", {}).get("key") == category_key),
            None,
        )
        if match is None:
            return False
        self.transition_issue(issue_id_or_key, match["id"])
        return True

    def complete_issue(self, issue_id_or_key: str) -> bool:
        """Move an issue to a "Done"-category status. Returns False if no such transition exists."""
        return self.transition_to_category(issue_id_or_key, "done")

    def start_progress_issue(self, issue_id_or_key: str) -> bool:
        """Move an issue to an "In Progress"-category status. Returns False if no such transition exists."""
        return self.transition_to_category(issue_id_or_key, "indeterminate")

    def link_issues(self, inward_issue_key: str, outward_issue_key: str) -> None:
        try:
            self._api_request(
                "POST",
                "issueLink",
                {
                    "type": {"name": "Relates"},
                    "inwardIssue": {"key": inward_issue_key},
                    "outwardIssue": {"key": outward_issue_key},
                },
            )
        except RuntimeError as exc:
            if "already exists" not in str(exc).lower():
                raise
