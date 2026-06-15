from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Personal Finance Studio"
    app_env: str = "local"
    database_url: str = "postgresql+psycopg://pfs:pfs_local@localhost:5435/personal_finance_studio"
    pfs_secret_key: str | None = None
    pfs_secret_key_file: str = "data/.pfs_secret.key"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:5175,http://127.0.0.1:5175,"
        "http://localhost:5176,http://127.0.0.1:5176,"
        "http://localhost:5177,http://127.0.0.1:5177"
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
