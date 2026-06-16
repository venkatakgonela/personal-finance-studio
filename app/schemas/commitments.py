from pydantic import BaseModel


class CommitmentSummary(BaseModel):
    id: str
    name: str
    source_label: str | None
    commitment_type: str
    category: str
    frequency: str
    expected_amount: str
    next_due_date: str | None
    end_date: str | None
    occurrence_count: int | None
    status: str
    source: str
    source_transaction_id: str | None = None
    instance_count: int


class CommitmentCreate(BaseModel):
    name: str
    source_label: str | None = None
    commitment_type: str = "bill"
    category: str | None = None
    frequency: str = "monthly"
    expected_amount: str
    next_due_date: str
    end_date: str | None = None
    occurrence_count: int | None = None
    source_transaction_id: str | None = None
    status: str = "confirmed"


class CommitmentUpdate(BaseModel):
    name: str | None = None
    commitment_type: str | None = None
    category: str | None = None
    frequency: str | None = None
    expected_amount: str | None = None
    next_due_date: str | None = None
    end_date: str | None = None
    occurrence_count: int | None = None
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
