from pydantic import BaseModel, HttpUrl


class GoogleSheetsConfig(BaseModel):
    redirect_uri: HttpUrl
    spreadsheet_url: HttpUrl
    sheet_name: str = "Personal Account Transactions"


class GoogleSheetsStatus(BaseModel):
    configured: bool
    validated: bool
    oauth_configured: bool = False
    status: str
    message: str
    client_id_last4: str | None = None
    spreadsheet_id: str | None = None
    spreadsheet_url: str | None = None
    sheet_name: str | None = None
    auth_url: str | None = None
    last_validated_at: str | None = None
    last_synced_at: str | None = None
    secret_storage: str


class GoogleSheetsImportResult(BaseModel):
    import_id: str
    row_count: int
    imported_transaction_count: int
    skipped_duplicate_count: int
    created_account_count: int
    reused_account_count: int
    date_start: str | None
    date_end: str | None
    warnings: list[str]
