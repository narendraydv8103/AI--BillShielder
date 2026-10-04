from fastapi import APIRouter
from backend.app.api.v1.health import router as health_router
from backend.app.api.v1.audit import router as audit_router
from backend.app.api.v1.rules import router as rules_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(audit_router)
api_router.include_router(rules_router)
