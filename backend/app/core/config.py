"""Configuration centrale de l'application."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "The Human Archive"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me"
    api_prefix: str = "/api/v1"
    port: int = 8000

    # PostgreSQL (individuel – Docker Compose)
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_db: str = "human_archive"
    postgres_user: str = "archive_user"
    postgres_password: str = "change-me"

    # PostgreSQL (URL directe – Railway)
    database_url_override: str | None = None  # alias DATABASE_URL

    # Stockage
    storage_backend: str = "s3"  # "s3" ou "local"
    storage_local_dir: str = "/app/uploads"

    # MinIO / S3 (utilisé si storage_backend == "s3")
    minio_endpoint: str = "minio:9000"
    minio_public_endpoint: str = "localhost:9000"
    minio_root_user: str = "minioadmin"
    minio_root_password: str = "minioadmin123"
    minio_bucket: str = "archives"
    minio_use_ssl: bool = False

    # JWT
    jwt_secret_key: str = "change-me-jwt"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Upload
    max_upload_size_mb: int = 2048
    allowed_video_extensions: str = "mp4,mov,avi,mkv,webm"
    allowed_audio_extensions: str = "mp3,wav,flac,ogg,aac"
    allowed_image_extensions: str = "jpg,jpeg,png,webp,tiff"

    # Low-bandwidth
    chunk_size_kb: int = 256
    enable_compression: bool = True
    thumbnail_quality: int = 60

    # Railway
    railway_public_domain: str | None = None

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            url = self.database_url_override
            # Railway fournit postgresql://, asyncpg a besoin de postgresql+asyncpg://
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        if self.database_url_override:
            url = self.database_url_override
            if url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
            return url
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
