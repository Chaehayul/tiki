from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import IntegrationProvider, SyncStatus


class IntegrationConnectResponse(BaseModel):
    authorization_url: str


class ProviderIntegrationStatus(BaseModel):
    connected: bool = False
    status: str = "disconnected"
    siteName: str | None = None
    siteUrl: str | None = None
    workspaceName: str | None = None
    workspaceId: str | None = None
    connectedAt: datetime | None = None
    jiraProjectKey: str | None = None
    jiraProjectName: str | None = None


class JiraProjectOptionResponse(BaseModel):
    key: str
    name: str


class JiraProjectSelectRequest(BaseModel):
    key: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)


class ProjectIntegrationsResponse(BaseModel):
    jira: ProviderIntegrationStatus = Field(default_factory=ProviderIntegrationStatus)
    notion: ProviderIntegrationStatus = Field(default_factory=ProviderIntegrationStatus)


class TaskSendRequest(BaseModel):
    provider: IntegrationProvider
    taskIds: list[str] = Field(min_length=1)


class ExternalTaskLinkResponse(BaseModel):
    taskId: str
    provider: IntegrationProvider
    syncStatus: SyncStatus
    externalId: str | None = None
    externalKey: str | None = None
    externalUrl: str | None = None
    errorMessage: str | None = None


class TaskSendResponse(BaseModel):
    meetingId: UUID
    provider: IntegrationProvider
    results: list[ExternalTaskLinkResponse]
