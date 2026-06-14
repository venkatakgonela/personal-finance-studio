from pydantic import BaseModel


class TransactionSummary(BaseModel):
    id: str
    date: str
    provider: str
    account_name: str
    merchant_name: str
    description: str
    amount: str
    direction: str
    source_category: str
    normalized_group: str
    status: str
    reviewed: bool
    transaction_type: str
    is_transfer_candidate: bool


class TransactionUpdate(BaseModel):
    source_category: str | None = None
    transaction_type: str | None = None
    reviewed: bool | None = None
    notes: str | None = None


class TransactionLedgerResponse(BaseModel):
    entity_id: str
    entity_name: str
    total_count: int
    returned_count: int
    transactions: list[TransactionSummary]
