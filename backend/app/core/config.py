import os
from typing import List, Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Hospital Bill Auditor application configuration settings.
    Loads from environment variables or .env file.
    """
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application Info
    APP_NAME: str = "Hospital Bill Auditor (India)"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production", "test"] = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # API Settings
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    # DEMO MODE
    # If true, runs using synthetic bills and mock providers with zero external API keys needed
    DEMO_MODE: bool = True

    # Database Settings
    # Default to SQLite for zero-friction local development/demo if PostgreSQL is not active
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./database/hospital_auditor.db",
        description="Async database connection string"
    )
    ENABLE_PGVECTOR: bool = False
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # Storage Provider Settings ("local" | "s3")
    STORAGE_PROVIDER: Literal["local", "s3"] = "local"
    LOCAL_STORAGE_DIR: str = "./documents/uploads"
    S3_BUCKET_NAME: str = "hospital-bill-audits"
    S3_REGION: str = "ap-south-1"

    # OCR Provider Settings ("mock" | "tesseract" | "google_document_ai" | "azure_document_intelligence")
    OCR_PROVIDER: Literal[
        "mock", "tesseract", "google_document_ai", "azure_document_intelligence"
    ] = "mock"
    TESSERACT_CMD: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: str = ""
    AZURE_DOCUMENT_INTELLIGENCE_KEY: str = ""

    # AI / LLM Provider Settings ("mock" | "gemini" | "openai")
    # Rule engine is strictly deterministic; LLM is used exclusively for explanation/classification
    LLM_PROVIDER: Literal["mock", "gemini", "openai"] = "mock"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "mock-model"

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL.lower()


settings = Settings()
