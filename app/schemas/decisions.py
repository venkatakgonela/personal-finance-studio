from pydantic import BaseModel


class DecisionItem(BaseModel):
    id: str
    decision_type: str
    title: str
    detail: str
    amount: str
    status: str
    reason: str


class DecisionQueueResponse(BaseModel):
    entity_id: str
    entity_name: str
    total_count: int
    decisions: list[DecisionItem]


class DecisionActionResult(BaseModel):
    id: str
    decision_type: str
    status: str
    message: str
