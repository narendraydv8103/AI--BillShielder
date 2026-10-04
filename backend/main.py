import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.api.v1.router import api_router
from backend.app.db.session import engine, check_db_connection
from backend.app.db.base import Base

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hospital_auditor")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown hooks."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} in {settings.ENVIRONMENT} mode")
    logger.info(f"DEMO_MODE: {settings.DEMO_MODE}")
    logger.info(f"OCR Provider: {settings.OCR_PROVIDER}, LLM Provider: {settings.LLM_PROVIDER}")

    # Ensure local storage directory exists
    Path(settings.LOCAL_STORAGE_DIR).mkdir(parents=True, exist_ok=True)
    Path("./database").mkdir(parents=True, exist_ok=True)

    # Initialize tables if SQLite is used in local/demo mode
    if settings.is_sqlite:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("SQLite database tables verified/initialized")

    db_health = await check_db_connection()
    logger.info(f"Initial Database connectivity check: {db_health.get('status')}")

    yield

    logger.info("Shutting down application resources...")
    await engine.dispose()
    logger.info("Application shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-assisted hospital bill auditing platform for India. "
        "Deterministic audit engine grounded in verified government circulars (CGHS, PMJAY, NPPA). "
        "LLMs strictly perform classification and explanation; rule engine is 100% deterministic."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "demo_mode": settings.DEMO_MODE,
        "documentation": "/docs",
        "api_v1": settings.API_V1_PREFIX,
    }


# Include V1 API Router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Also expose top-level /health alias for container health checkers
from backend.app.api.v1.health import router as health_router
app.include_router(health_router)
