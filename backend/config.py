"""Application configuration loaded from .env file."""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "clarus_health"
    DB_USER: str
    DB_PASSWORD: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # App
    APP_ENV: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # Phase 2 — File storage
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 20
    EXTERNAL_BASE_URL: str = "http://localhost:5173"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def upload_dir_abs(self) -> str:
        """Absolute path to uploads directory, created if missing."""
        path = os.path.abspath(self.UPLOAD_DIR)
        os.makedirs(path, exist_ok=True)
        return path

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def quarantine_dir_abs(self) -> str:
        """Where suspended record files are moved (awaiting admin review)."""
        path = os.path.join(self.upload_dir_abs, "quarantine")
        os.makedirs(path, exist_ok=True)
        return path

    @property
    def recycle_bin_dir_abs(self) -> str:
        """Where permanently-deleted record files are moved (soft-delete safety net)."""
        path = os.path.join(self.upload_dir_abs, "recycle_bin")
        os.makedirs(path, exist_ok=True)
        return path


settings = Settings()
