from pydantic import BaseModel


class PlaidStatus(BaseModel):
    account_count: int
    client_id_last4: str | None = None
    configured: bool
    connected: bool
    environment: str
    item_count: int
    last_synced_at: str | None = None
    message: str
    products: list[str]
    secret_storage: str


class PlaidLinkToken(BaseModel):
    expiration: str | None = None
    link_token: str
    request_id: str | None = None


class PlaidExchangeRequest(BaseModel):
    institution_id: str | None = None
    institution_name: str | None = None
    public_token: str


class PlaidAccountPreview(BaseModel):
    account_id: str
    available_balance: str | None
    current_balance: str | None
    institution_name: str
    limit: str | None
    mask: str | None
    name: str
    official_name: str | None
    subtype: str | None
    type: str


class PlaidTransactionPreview(BaseModel):
    account_id: str
    amount: str
    category: str
    date: str
    merchant_name: str
    name: str
    pending: bool
    transaction_id: str


class PlaidPreview(BaseModel):
    accounts: list[PlaidAccountPreview]
    transaction_count: int
    transactions: list[PlaidTransactionPreview]


class PlaidImportRequest(BaseModel):
    days: int = 30


class PlaidImportResult(BaseModel):
    account_count: int
    imported_transaction_count: int
    skipped_duplicate_count: int
    synced_item_count: int
    transaction_count: int
