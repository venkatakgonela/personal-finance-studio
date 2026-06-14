from pydantic import BaseModel


class ForecastPoint(BaseModel):
    date: str
    label: str
    kind: str
    amount: str
    projected_balance: str | None
    confidence: str


class ForecastResponse(BaseModel):
    entity_id: str
    entity_name: str
    start_date: str
    end_date: str
    starting_balance: str | None
    projected_ending_balance: str | None
    lowest_projected_balance: str | None
    confirmed_commitments_total: str
    candidate_commitments_total: str
    confidence: str
    points: list[ForecastPoint]
