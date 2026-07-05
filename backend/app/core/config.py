from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="TIKI Backend", alias="APP_NAME")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    database_url: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/tiki",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    upload_dir: str = Field(default="uploads", alias="UPLOAD_DIR")
    auth_secret_key: str = Field(default="change-me-in-production", alias="AUTH_SECRET_KEY")
    access_token_expire_minutes: int = Field(default=60 * 24, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    backend_cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        alias="BACKEND_CORS_ORIGINS",
    )
    jira_base_url: str | None = Field(default=None, alias="JIRA_BASE_URL")
    jira_email: str | None = Field(default=None, alias="JIRA_EMAIL")
    jira_api_token: str | None = Field(default=None, alias="JIRA_API_TOKEN")
    jira_project_key: str | None = Field(default=None, alias="JIRA_PROJECT_KEY")
    jira_client_id: str | None = Field(default=None, alias="JIRA_CLIENT_ID")
    jira_client_secret: str | None = Field(default=None, alias="JIRA_CLIENT_SECRET")
    jira_redirect_uri: str | None = Field(default=None, alias="JIRA_REDIRECT_URI")
    notion_client_id: str | None = Field(default=None, alias="NOTION_CLIENT_ID")
    notion_client_secret: str | None = Field(default=None, alias="NOTION_CLIENT_SECRET")
    notion_redirect_uri: str | None = Field(default=None, alias="NOTION_REDIRECT_URI")
    notion_meeting_database_id: str | None = Field(default=None, alias="NOTION_MEETING_DATABASE_ID")
    notion_task_database_id: str | None = Field(default=None, alias="NOTION_TASK_DATABASE_ID")
    notion_parent_page_id: str | None = Field(default=None, alias="NOTION_PARENT_PAGE_ID")
    frontend_base_url: str = Field(default="http://localhost:5173", alias="FRONTEND_BASE_URL")
    toss_secret_key: str | None = Field(default=None, alias="TOSS_SECRET_KEY")
    toss_client_key: str | None = Field(default=None, alias="TOSS_CLIENT_KEY")
    integration_token_encryption_key: str | None = Field(default=None, alias="INTEGRATION_TOKEN_ENCRYPTION_KEY")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-5.4-mini", alias="OPENAI_MODEL")
    openai_small_model: str | None = Field(default=None, alias="OPENAI_SMALL_MODEL")
    openai_medium_model: str | None = Field(default=None, alias="OPENAI_MEDIUM_MODEL")
    openai_large_model: str | None = Field(default=None, alias="OPENAI_LARGE_MODEL")
    groq_api_key: str | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.1-70b-versatile", alias="GROQ_MODEL")
    groq_base_url: str = Field(default="https://api.groq.com/openai/v1", alias="GROQ_BASE_URL")
    llm_analysis_provider: str = Field(default="langchain", alias="LLM_ANALYSIS_PROVIDER")
    whisper_engine: str = Field(default="auto", alias="WHISPER_ENGINE")
    whisper_model: str = Field(default="large", alias="WHISPER_MODEL")
    whisper_medium_model: str | None = Field(default="medium", alias="WHISPER_MEDIUM_MODEL")
    whisper_light_model: str = Field(default="small", alias="WHISPER_LIGHT_MODEL")
    diarization_enabled: bool = Field(default=False, alias="DIARIZATION_ENABLED")
    diarization_model: str = Field(
        default="pyannote/speaker-diarization-3.1",
        alias="DIARIZATION_MODEL",
    )
    huggingface_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("HF_TOKEN", "HUGGINGFACE_ACCESS_TOKEN", "HUGGINGFACE_HUB_TOKEN"),
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()
