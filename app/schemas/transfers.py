from pydantic import BaseModel


class TransferTransactionSummary(BaseModel):
    id: str
    account_name: str
    provider: str
    date: str
    amount: str
    merchant_name: str
    description: str


class InternalTransferCandidate(BaseModel):
    id: str
    entity_id: str
    amount: str
    date_gap_days: int
    confidence: str
    status: str
    reason: str
    from_transaction: TransferTransactionSummary
    to_transaction: TransferTransactionSummary


class InternalTransferDetectionResult(BaseModel):
    entity_id: str
    created_count: int
    existing_count: int
    candidate_count: int
    candidates: list[InternalTransferCandidate]
