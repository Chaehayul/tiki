import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.models.registry import import_all_models
from app.services.ai_engine import get_default_ai_engine

import_all_models()

logger = logging.getLogger(__name__)


def _fail_orphaned_uploads() -> None:
    # Upload analysis runs via FastAPI BackgroundTasks in this same process (see
    # app/workers/tasks.py) rather than a durable task queue, so any restart —
    # including a dev --reload triggered by an unrelated code change — kills the
    # thread mid-analysis and leaves the row stuck at "processing" forever with no
    # error. A row still "processing" at startup can only be orphaned like this,
    # since nothing else could have been running before this process existed.
    from app.db.database import SessionLocal
    from app.models.enums import ProcessingStatus
    from app.models.file import UploadedFile
    from datetime import UTC, datetime

    db = SessionLocal()
    try:
        stuck = db.query(UploadedFile).filter(UploadedFile.status == ProcessingStatus.PROCESSING).all()
        for row in stuck:
            row.status = ProcessingStatus.FAILED
            row.error_message = "서버 재시작으로 분석 작업이 중단되었습니다. 다시 업로드해 주세요."
            row.completed_at = datetime.now(UTC)
        if stuck:
            db.commit()
            logger.warning("Marked %d orphaned uploaded file(s) as failed on startup", len(stuck))
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    _fail_orphaned_uploads()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
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
