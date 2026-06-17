from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Personal Finance Studio"
    app_env: str = "local"
    database_url: str = "postgresql+psycopg://pfs:pfs_local@localhost:5435/personal_finance_studio"
    pfs_secret_key: str | None = None
    pfs_secret_key_file: str = "data/.pfs_secret.key"
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    plaid_client_id: str | None = None
    plaid_secret: str | None = None
    plaid_env: str = "sandbox"
    plaid_products: str = "transactions"
    plaid_country_codes: str = "GB"
    freeagent_auto_sync_worker_enabled: bool = True
    freeagent_auto_sync_check_seconds: int = 300
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

    @property
    def plaid_product_list(self) -> list[str]:
        return [product.strip() for product in self.plaid_products.split(",") if product.strip()]

    @property
    def plaid_country_code_list(self) -> list[str]:
        return [code.strip() for code in self.plaid_country_codes.split(",") if code.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
