from pydantic import BaseModel


class AccountSummary(BaseModel):
    id: str
    provider: str
    display_name: str
    source_account_name: str
    account_type: str
    current_balance: str | None
    overdraft_limit: str | None
    available_balance: str | None
    liability_balance: str
    include_in_cash_on_hand: bool
    include_in_forecast: bool
    transaction_count: int
    inflow_total: str
    outflow_total: str
    net_total: str


class AccountUpdate(BaseModel):
    account_type: str | None = None
    current_balance: str | None = None
    overdraft_limit: str | None = None
    balance_as_of: str | None = None
    include_in_cash_on_hand: bool | None = None
    include_in_forecast: bool | None = None


class AccountsSummaryResponse(BaseModel):
    entity_id: str
    entity_name: str
    accounts: list[AccountSummary]
