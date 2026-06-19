from fastapi import APIRouter

from app.api.v1 import auth, health, integrations, projects, uploads

router = APIRouter()

router.include_router(auth.router)
router.include_router(health.router)
router.include_router(integrations.router)
router.include_router(projects.router)
router.include_router(uploads.router)
