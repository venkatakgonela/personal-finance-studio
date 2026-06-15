from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

FreeAgentEnvironment = Literal["production", "sandbox", "custom"]


class FreeAgentCredentials(BaseModel):
    environment: FreeAgentEnvironment = "production"
    base_url: HttpUrl | None = None
    auth_url: HttpUrl | None = None
    token_url: HttpUrl | None = None
    client_id: str = Field(min_length=1)
    client_secret: str = Field(min_length=1)
    access_token: str = Field(min_length=1)
    refresh_token: str | None = None


class FreeAgentBankAccount(BaseModel):
    url: str
    name: str
    bank_name: str | None = None
    type: str
    status: str
    currency: str
    current_balance: str | None = None
    latest_activity_date: str | None = None
    updated_at: str | None = None
    is_personal: bool = False
    is_primary: bool = False


class FreeAgentConnectionStatus(BaseModel):
    configured: bool
    validated: bool
    status: str
    message: str
    environment: str | None = None
    base_url: str | None = None
    auth_url: str | None = None
    token_url: str | None = None
    client_id_last4: str | None = None
    company_name: str | None = None
    company_url: str | None = None
    selected_bank_account_url: str | None = None
    selected_bank_account_name: str | None = None
    sync_cursor_updated_since: str | None = None
    last_validated_at: str | None = None
    last_synced_at: str | None = None
    secret_storage: str


class FreeAgentValidationResult(BaseModel):
    status: FreeAgentConnectionStatus
    accounts: list[FreeAgentBankAccount]


class FreeAgentImportRequest(BaseModel):
    bank_account_url: str
    from_date: date | None = None
    to_date: date | None = None
    updated_since: str | None = None
    view: str = "all"
    last_uploaded: bool = False


class FreeAgentImportResult(BaseModel):
    import_id: str
    account_id: str
    account_name: str
    row_count: int
    imported_transaction_count: int
    skipped_duplicate_count: int
    date_start: str | None
    date_end: str | None
    next_updated_since: str | None
    warnings: list[str]
