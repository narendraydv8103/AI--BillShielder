from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "healthy"
    app_name: str
    version: str
    environment: str
    demo_mode: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    database: Dict[str, Any]
    providers: Dict[str, Any]
