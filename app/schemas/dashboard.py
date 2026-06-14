from pydantic import BaseModel


class DashboardSummary(BaseModel):
    entity_id: str
    entity_name: str
    cash_on_hand: str | None
    available_after_commitments: str | None
    flexible_spend_remaining: str | None
    flexible_spend_actual: str
    flexible_spend_allowance: str
    lowest_projected_balance: str | None
    cash_balance_account_count: int
    missing_balance_account_count: int
    upcoming_confirmed_total: str
    upcoming_candidate_total: str
    decision_count: int
    transaction_count: int
    account_count: int
    commitment_count: int
    confidence: str
    message: str
