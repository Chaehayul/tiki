from uuid import UUID

from pydantic import BaseModel


class UploadedFileResponse(BaseModel):
    id: UUID
    project_id: str
    project_key: str
    project_name: str
    original_filename: str
    file_size_bytes: int
    file_extension: str
    file_kind: str
    status: str

    model_config = {"from_attributes": True}


class UploadBatchResponse(BaseModel):
    files: list[UploadedFileResponse]
    message: str = "upload accepted"
