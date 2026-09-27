from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ORDERFLOW_", extra="ignore")

    database_url: str = "sqlite:///./orders.db"
    scheduler_enabled: bool = True
    processing_interval_seconds: int = Field(default=300, ge=1)
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    ai_provider: Literal["disabled", "openai_compatible", "anthropic"] = "disabled"
    ai_api_key: SecretStr = SecretStr("")
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = ""
    ai_timeout_seconds: float = Field(default=10, gt=0, le=60)
