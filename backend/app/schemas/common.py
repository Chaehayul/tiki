from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str
    code: str = "internal_server_error"


class SuccessResponse(BaseModel):
    data: Any
    message: str = "ok"
