from pydantic_settings import BaseSettings
from pydantic import Field  # noqa: F401


class Settings(BaseSettings):
    app_name: str = "AI Compliance Copilot"
    app_version: str = "1.0.0"
    debug: bool = False

    # Google Gemini API key (optional — used for enhanced extraction)
    gemini_api_key: str = Field(default="", env="GEMINI_API_KEY")

    # Max upload size in bytes (10 MB)
    max_upload_size: int = 10 * 1024 * 1024

    # Allowed image MIME types
    allowed_mime_types: list[str] = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
