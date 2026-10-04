import logging
from fastapi import APIRouter, status
from backend.app.core.config import settings
from backend.app.db.session import check_db_connection
from backend.app.providers.factory import get_ocr_provider, get_llm_provider, get_storage_provider
from backend.app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])
logger = logging.getLogger(__name__)


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="System and Component Health Check",
)
async def get_system_health() -> HealthResponse:
    """
    Returns current health status of application, database, and all configured providers.
    In DEMO MODE, runs with mock providers and local storage.
    """
    db_status = await check_db_connection()

    ocr_provider = get_ocr_provider(settings)
    llm_provider = get_llm_provider(settings)
    storage_provider = get_storage_provider(settings)

    ocr_health = await ocr_provider.health_check()
    llm_health = await llm_provider.health_check()
    storage_health = await storage_provider.health_check()

    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        demo_mode=settings.DEMO_MODE,
        database=db_status,
        providers={
            "storage": storage_health.model_dump(),
            "ocr": ocr_health.model_dump(),
            "llm": llm_health.model_dump(),
        },
    )


@router.get(
    "/health/ready",
    status_code=status.HTTP_200_OK,
    summary="Readiness Probe",
)
async def get_readiness():
    return {"ready": True, "app": settings.APP_NAME, "version": settings.APP_VERSION}
