from pydantic import BaseModel


class CategoryInsight(BaseModel):
    group: str
    transaction_count: int
    inflow_total: str
    outflow_total: str
    net_total: str


class MerchantInsight(BaseModel):
    merchant_name: str
    transaction_count: int
    outflow_total: str


class InsightsResponse(BaseModel):
    entity_id: str
    entity_name: str
    start_date: str | None
    end_date: str | None
    category_groups: list[CategoryInsight]
    top_merchants: list[MerchantInsight]
    internal_transfers_excluded: bool
