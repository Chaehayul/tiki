import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.models.registry import import_all_models
from app.services.ai_engine import get_default_ai_engine

import_all_models()
app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)


@app.on_event("startup")
def warm_up_ai_services() -> None:
    """Preload reusable AI models in long-lived server processes."""
    engine = get_default_ai_engine()
    engine.warm_up(preload_secondary_models=False, preload_diarization=True)


@app.get("/", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_v1_router, prefix=settings.api_v1_prefix)
