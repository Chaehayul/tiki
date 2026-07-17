from __future__ import annotations

import unittest

from app.integrations.jira import JiraOAuthClient
from app.integrations.notion import NotionClient


class RecordingNotionClient(NotionClient):
    def __init__(self) -> None:
        super().__init__(access_token="test-token")
        self.calls: list[tuple[str, str, dict | None]] = []

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        self.calls.append((method, path, body))
        if method == "GET" and "start_cursor=page-2" in path:
            return {"results": [{"id": "old-3"}], "has_more": False}
        if method == "GET":
            return {
                "results": [{"id": "old-1"}, {"id": "old-2"}],
                "has_more": True,
                "next_cursor": "page-2",
            }
        return {}


class RecordingJiraClient(JiraOAuthClient):
    def __init__(self, responses: list[object]) -> None:
        super().__init__(access_token="test-token", cloud_id="cloud", site_url="https://example.atlassian.net")
        self.responses = list(responses)
        self.requests: list[tuple[str, str, dict | None]] = []

    def _api_request(self, method: str, path: str, body: dict | None = None) -> dict:
        self.requests.append((method, path, body))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class IntegrationClientTests(unittest.TestCase):
    def test_notion_replacement_collects_all_pages_before_deleting(self) -> None:
        client = RecordingNotionClient()
        new_blocks = [{"object": "block", "type": "paragraph"}] * 205

        client.replace_page_children("page-id", new_blocks)

        methods = [method for method, _, _ in client.calls]
        self.assertEqual(methods[:2], ["GET", "GET"])
        delete_paths = [path for method, path, _ in client.calls if method == "DELETE"]
        self.assertEqual(delete_paths, ["blocks/old-1", "blocks/old-2", "blocks/old-3"])
        patch_sizes = [
            len(body["children"])
            for method, _, body in client.calls
            if method == "PATCH" and body is not None
        ]
        self.assertEqual(patch_sizes, [100, 100, 5])

    def test_jira_retries_without_optional_description(self) -> None:
        client = RecordingJiraClient([
            RuntimeError("Jira API 400: Field 'description' cannot be set"),
            {"id": "10001", "key": "TIKI-1"},
        ])

        result = client.create_issue(project_key="TIKI", title="테스트", description="설명")

        self.assertEqual(result.issue_key, "TIKI-1")
        self.assertEqual(len(client.requests), 2)
        retry_fields = client.requests[1][2]["fields"]
        self.assertNotIn("description", retry_fields)

    def test_jira_does_not_retry_required_summary_error(self) -> None:
        client = RecordingJiraClient([
            RuntimeError("Jira API 400: Field 'summary' cannot be set"),
        ])

        with self.assertRaisesRegex(RuntimeError, "summary"):
            client.create_issue(project_key="TIKI", title="테스트", description="설명")

        self.assertEqual(len(client.requests), 1)


if __name__ == "__main__":
    unittest.main()
