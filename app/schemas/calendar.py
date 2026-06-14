from pydantic import BaseModel


class UpcomingCommitmentInstance(BaseModel):
    id: str
    commitment_id: str
    commitment_name: str
    commitment_status: str
    commitment_type: str
    due_date: str
    expected_amount: str
    estimated_amount: str | None
    actual_amount: str | None
    status: str


class UpcomingCommitmentsResponse(BaseModel):
    entity_id: str
    entity_name: str
    start_date: str
    end_date: str
    total_count: int
    expected_total: str
    items: list[UpcomingCommitmentInstance]
