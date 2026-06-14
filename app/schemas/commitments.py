from pydantic import BaseModel


class CommitmentSummary(BaseModel):
    id: str
    name: str
    commitment_type: str
    frequency: str
    expected_amount: str
    next_due_date: str | None
    status: str
    source: str
    instance_count: int


class CommitmentUpdate(BaseModel):
    name: str | None = None
    commitment_type: str | None = None
    frequency: str | None = None
    expected_amount: str | None = None
    next_due_date: str | None = None
    status: str | None = None


class BillInstancePayment(BaseModel):
    actual_amount: str
    paid_date: str
    paid_account_id: str | None = None


class BillInstanceSummary(BaseModel):
    id: str
    commitment_id: str
    due_date: str
    expected_amount: str
    estimated_amount: str | None
    actual_amount: str | None
    paid_date: str | None
    status: str


class CommitmentsResponse(BaseModel):
    entity_id: str
    entity_name: str
    total_count: int
    commitments: list[CommitmentSummary]


class CommitmentDetectionResult(BaseModel):
    entity_id: str
    created_count: int
    existing_count: int
    candidate_count: int
    commitments: list[CommitmentSummary]
