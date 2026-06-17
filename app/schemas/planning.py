from pydantic import BaseModel


class PlanningGoal(BaseModel):
    id: str
    name: str
    target_amount: str
    current_amount: str
    monthly_contribution: str
    progress_percent: int
    status: str
    next_action: str


class SinkingFundPlan(BaseModel):
    id: str
    name: str
    due_date: str | None
    frequency: str
    target_amount: str
    monthly_set_aside: str
    status: str
    source_commitment_id: str | None


class MonthlyReviewSummary(BaseModel):
    start_date: str
    end_date: str
    income_total: str
    outflow_total: str
    net_total: str
    reviewed_count: int
    unreviewed_count: int
    decision_count: int
    headline: str
    next_actions: list[str]
    groups: list["MonthlyReviewGroupSummary"] = []


class MonthlyReviewGroupSummary(BaseModel):
    group: str
    total: str
    transaction_count: int
    reviewed_count: int
    unreviewed_count: int


class SubscriptionReviewItem(BaseModel):
    id: str
    name: str
    expected_amount: str
    frequency: str
    next_due_date: str | None
    status: str
    prompt: str
    action: str


class SavedReportFilter(BaseModel):
    id: str
    label: str
    description: str
    route: str
    query: str


class ImportFreshness(BaseModel):
    status: str
    message: str
    latest_import_date: str | None
    latest_transaction_date: str | None
    days_since_latest_transaction: int | None


class StaleCommitmentReview(BaseModel):
    id: str
    name: str
    expected_amount: str
    next_due_date: str | None
    status: str
    reason: str


class PotCoverageItem(BaseModel):
    commitment_id: str
    name: str
    category: str
    expected_amount: str
    due_date: str
    status: str


class PotCoveragePlan(BaseModel):
    account_id: str
    pot_name: str
    source_account_name: str
    current_balance: str
    required_amount: str
    surplus_or_shortfall: str
    coverage_percent: int
    status: str
    mapped_commitment_count: int
    items: list[PotCoverageItem]


class PlanningOverview(BaseModel):
    entity_id: str
    entity_name: str
    goals: list[PlanningGoal]
    sinking_funds: list[SinkingFundPlan]
    monthly_review: MonthlyReviewSummary
    subscriptions: list[SubscriptionReviewItem]
    saved_filters: list[SavedReportFilter]
    import_freshness: ImportFreshness
    stale_commitments: list[StaleCommitmentReview]
    pot_coverage: list[PotCoveragePlan]
