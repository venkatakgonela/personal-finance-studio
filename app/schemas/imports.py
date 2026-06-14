from pydantic import BaseModel, Field


class DetectedAccount(BaseModel):
    provider: str
    name: str
    transaction_count: int
    inflow_total: str
    outflow_total: str
    net_total: str
    suggested_type: str


class DetectedCategory(BaseModel):
    source_category: str
    transaction_count: int
    net_total: str
    normalized_group: str


class SnoopImportPreview(BaseModel):
    source_filename: str
    row_count: int
    valid_row_count: int
    invalid_row_count: int
    duplicate_fingerprint_count: int
    date_start: str | None = None
    date_end: str | None = None
    pending_count: int
    inflow_total: str
    outflow_total: str
    net_total: str
    accounts: list[DetectedAccount]
    categories: list[DetectedCategory]
    warnings: list[str] = Field(default_factory=list)


class SnoopImportCommitResult(BaseModel):
    import_id: str
    entity_id: str
    entity_name: str
    profile_id: str
    profile_name: str
    row_count: int
    imported_transaction_count: int
    skipped_duplicate_count: int
    created_account_count: int
    reused_account_count: int
    date_start: str | None = None
    date_end: str | None = None
    warnings: list[str] = Field(default_factory=list)
