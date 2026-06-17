export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8025";

const inFlightGetRequests = new Map<string, Promise<unknown>>();

export type HealthResponse = {
  status: string;
  app: string;
  env: string;
};

export type DetectedAccount = {
  provider: string;
  name: string;
  transaction_count: number;
  inflow_total: string;
  outflow_total: string;
  net_total: string;
  suggested_type: string;
};

export type DetectedCategory = {
  source_category: string;
  transaction_count: number;
  net_total: string;
  normalized_group: string;
};

export type ImportPreview = {
  source_filename: string;
  row_count: number;
  valid_row_count: number;
  invalid_row_count: number;
  duplicate_fingerprint_count: number;
  date_start: string | null;
  date_end: string | null;
  pending_count: number;
  inflow_total: string;
  outflow_total: string;
  net_total: string;
  accounts: DetectedAccount[];
  categories: DetectedCategory[];
  warnings: string[];
};

export type ImportCommitResult = {
  import_id: string;
  entity_name: string;
  profile_name: string;
  row_count: number;
  imported_transaction_count: number;
  skipped_duplicate_count: number;
  created_account_count: number;
  reused_account_count: number;
  date_start: string | null;
  date_end: string | null;
  warnings: string[];
};

export type ResetDataResult = {
  deleted: Record<string, number>;
  entity_name: string;
  profile_name: string;
  status: string;
};

export type AccountSummary = {
  id: string;
  provider: string;
  display_name: string;
  source_account_name: string;
  account_type: string;
  current_balance: string | null;
  inferred_balance: string | null;
  effective_balance: string | null;
  balance_source: string;
  balance_as_of: string | null;
  overdraft_limit: string | null;
  available_balance: string | null;
  liability_balance: string;
  include_in_cash_on_hand: boolean;
  include_in_forecast: boolean;
  transaction_count: number;
  inflow_total: string;
  outflow_total: string;
  net_total: string;
  period_inflow_total: string;
  period_outflow_total: string;
  period_net_total: string;
};

export type AccountUpdate = {
  account_type?: string;
  current_balance?: string;
  overdraft_limit?: string;
  balance_as_of?: string;
  include_in_cash_on_hand?: boolean;
  include_in_forecast?: boolean;
};

export type AccountsResponse = {
  entity_name: string;
  accounts: AccountSummary[];
};

export type PlaidStatus = {
  account_count: number;
  client_id_last4: string | null;
  configured: boolean;
  connected: boolean;
  environment: string;
  item_count: number;
  last_synced_at: string | null;
  message: string;
  products: string[];
  secret_storage: string;
};

export type PlaidLinkToken = {
  expiration: string | null;
  link_token: string;
  request_id: string | null;
};

export type PlaidExchangeRequest = {
  institution_id?: string | null;
  institution_name?: string | null;
  public_token: string;
};

export type PlaidAccountPreview = {
  account_id: string;
  available_balance: string | null;
  current_balance: string | null;
  institution_name: string;
  limit: string | null;
  mask: string | null;
  name: string;
  official_name: string | null;
  subtype: string | null;
  type: string;
};

export type PlaidTransactionPreview = {
  account_id: string;
  amount: string;
  category: string;
  date: string;
  merchant_name: string;
  name: string;
  pending: boolean;
  transaction_id: string;
};

export type PlaidPreview = {
  accounts: PlaidAccountPreview[];
  transaction_count: number;
  transactions: PlaidTransactionPreview[];
};

export type PlaidImportResult = {
  account_count: number;
  imported_transaction_count: number;
  skipped_duplicate_count: number;
  synced_item_count: number;
  transaction_count: number;
};

export type TransactionSummary = {
  id: string;
  date: string;
  provider: string;
  account_name: string;
  merchant_name: string;
  description: string;
  amount: string;
  direction: string;
  source_category: string;
  normalized_group: string;
  status: string;
  reviewed: boolean;
  transaction_type: string;
  is_transfer_candidate: boolean;
};

export type TransactionUpdate = {
  source_category?: string;
  transaction_type?: string;
  reviewed?: boolean;
  notes?: string;
};

export type TransactionsResponse = {
  total_count: number;
  returned_count: number;
  transactions: TransactionSummary[];
};

export type TransferDetectionResult = {
  created_count: number;
  existing_count: number;
  candidate_count: number;
  candidates: Array<{
    id: string;
    amount: string;
    confidence: string;
    status: string;
    reason: string;
  }>;
};

export type CommitmentSummary = {
  id: string;
  name: string;
  source_label: string | null;
  commitment_type: string;
  category: string;
  frequency: string;
  expected_amount: string;
  next_due_date: string | null;
  end_date: string | null;
  occurrence_count: number | null;
  status: string;
  source: string;
  source_transaction_id?: string | null;
  instance_count: number;
};

export type CommitmentCreate = {
  name: string;
  source_label?: string | null;
  commitment_type: string;
  category?: string | null;
  frequency: string;
  expected_amount: string;
  next_due_date: string;
  end_date?: string | null;
  occurrence_count?: number | null;
  source_transaction_id?: string | null;
  status?: string;
};

export type CommitmentUpdate = {
  name?: string;
  commitment_type?: string;
  category?: string | null;
  frequency?: string;
  expected_amount?: string;
  next_due_date?: string;
  end_date?: string | null;
  occurrence_count?: number | null;
  status?: string;
};

export type BillInstancePayment = {
  actual_amount: string;
  paid_date: string;
  paid_account_id?: string | null;
};

export type BillInstanceSummary = {
  id: string;
  commitment_id: string;
  due_date: string;
  expected_amount: string;
  estimated_amount: string | null;
  actual_amount: string | null;
  paid_date: string | null;
  status: string;
};

export type CommitmentDetectionResult = {
  created_count: number;
  existing_count: number;
  candidate_count: number;
  commitments: CommitmentSummary[];
};

export type CommitmentsResponse = {
  entity_name: string;
  total_count: number;
  commitments: CommitmentSummary[];
};

export type DecisionItem = {
  id: string;
  decision_type: string;
  title: string;
  detail: string;
  amount: string;
  status: string;
  reason: string;
};

export type DecisionQueueResponse = {
  entity_name: string;
  total_count: number;
  decisions: DecisionItem[];
};

export type DecisionActionResult = {
  id: string;
  decision_type: string;
  status: string;
  message: string;
};

export type DashboardSummary = {
  entity_name: string;
  cash_on_hand: string | null;
  available_after_commitments: string | null;
  flexible_spend_remaining: string | null;
  flexible_spend_actual: string;
  flexible_spend_allowance: string | null;
  lowest_projected_balance: string | null;
  cash_balance_account_count: number;
  missing_balance_account_count: number;
  upcoming_confirmed_total: string;
  upcoming_candidate_total: string;
  decision_count: number;
  transaction_count: number;
  account_count: number;
  commitment_count: number;
  confidence: string;
  message: string;
};

export type ForecastPoint = {
  date: string;
  label: string;
  kind: string;
  amount: string;
  projected_balance: string | null;
  confidence: string;
};

export type ForecastResponse = {
  start_date: string;
  end_date: string;
  starting_balance: string | null;
  projected_ending_balance: string | null;
  lowest_projected_balance: string | null;
  confirmed_commitments_total: string;
  candidate_commitments_total: string;
  confidence: string;
  points: ForecastPoint[];
};

export type CategoryInsight = {
  group: string;
  transaction_count: number;
  inflow_total: string;
  outflow_total: string;
  net_total: string;
};

export type MerchantInsight = {
  merchant_name: string;
  transaction_count: number;
  outflow_total: string;
};

export type IncomeSourceInsight = {
  source_name: string;
  transaction_count: number;
  inflow_total: string;
};

export type MerchantBreakdownInsight = MerchantInsight & {
  group: string;
};

export type InsightsResponse = {
  start_date: string | null;
  end_date: string | null;
  category_groups: CategoryInsight[];
  income_sources: IncomeSourceInsight[];
  top_merchants: MerchantInsight[];
  merchant_breakdowns: MerchantBreakdownInsight[];
  internal_transfers_excluded: boolean;
};

export type PlanningGoal = {
  id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  monthly_contribution: string;
  progress_percent: number;
  status: string;
  next_action: string;
};

export type SinkingFundPlan = {
  id: string;
  name: string;
  due_date: string | null;
  frequency: string;
  target_amount: string;
  monthly_set_aside: string;
  status: string;
  source_commitment_id: string | null;
};

export type MonthlyReviewSummary = {
  start_date: string;
  end_date: string;
  income_total: string;
  outflow_total: string;
  net_total: string;
  reviewed_count: number;
  unreviewed_count: number;
  decision_count: number;
  headline: string;
  next_actions: string[];
  groups: MonthlyReviewGroupSummary[];
};

export type MonthlyReviewGroupSummary = {
  group: string;
  total: string;
  transaction_count: number;
  reviewed_count: number;
  unreviewed_count: number;
};

export type SubscriptionReviewItem = {
  id: string;
  name: string;
  expected_amount: string;
  frequency: string;
  next_due_date: string | null;
  status: string;
  prompt: string;
  action: string;
};

export type SavedReportFilter = {
  id: string;
  label: string;
  description: string;
  route: string;
  query: string;
};

export type ImportFreshness = {
  status: string;
  message: string;
  latest_import_date: string | null;
  latest_transaction_date: string | null;
  days_since_latest_transaction: number | null;
};

export type StaleCommitmentReview = {
  id: string;
  name: string;
  expected_amount: string;
  next_due_date: string | null;
  status: string;
  reason: string;
};

export type PotCoverageItem = {
  commitment_id: string;
  name: string;
  category: string;
  expected_amount: string;
  due_date: string;
  status: string;
};

export type PotCoveragePlan = {
  account_id: string;
  pot_name: string;
  source_account_name: string;
  current_balance: string;
  required_amount: string;
  surplus_or_shortfall: string;
  coverage_percent: number;
  status: string;
  mapped_commitment_count: number;
  items: PotCoverageItem[];
};

export type PlanningOverview = {
  entity_name: string;
  goals: PlanningGoal[];
  import_freshness: ImportFreshness;
  monthly_review: MonthlyReviewSummary;
  pot_coverage: PotCoveragePlan[];
  saved_filters: SavedReportFilter[];
  sinking_funds: SinkingFundPlan[];
  stale_commitments: StaleCommitmentReview[];
  subscriptions: SubscriptionReviewItem[];
};

export type UpcomingCommitment = {
  id: string;
  commitment_id: string;
  commitment_name: string;
  commitment_status: string;
  commitment_type: string;
  due_date: string;
  expected_amount: string;
  estimated_amount: string | null;
  actual_amount: string | null;
  status: string;
};

export type UpcomingCommitmentsResponse = {
  start_date: string;
  end_date: string;
  total_count: number;
  expected_total: string;
  items: UpcomingCommitment[];
};

export type DateWindowParams = {
  days?: number;
  endDate?: string;
  includeCandidates?: boolean;
  startDate?: string;
};

export type InsightParams = {
  endDate?: string;
  startDate?: string;
};

export type TransactionFilters = {
  accountId?: string;
  endDate?: string;
  includeTransferCandidates?: boolean;
  limit?: number;
  normalizedGroup?: string;
  offset?: number;
  reviewed?: boolean;
  search?: string;
  startDate?: string;
  status?: string;
  transactionType?: string;
};

export type FreeAgentBankAccount = {
  url: string;
  name: string;
  bank_name: string | null;
  type: string;
  status: string;
  currency: string;
  current_balance: string | null;
  latest_activity_date: string | null;
  updated_at: string | null;
  is_personal: boolean;
  is_primary: boolean;
  local_account_id: string | null;
  managed: boolean;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  sync_cursor_updated_since: string | null;
  last_synced_at: string | null;
  next_sync_due_at: string | null;
  last_sync_status: string;
  last_sync_message: string | null;
};

export type FreeAgentConnectionStatus = {
  configured: boolean;
  validated: boolean;
  status: string;
  message: string;
  environment: string | null;
  base_url: string | null;
  auth_url: string | null;
  token_url: string | null;
  client_id_last4: string | null;
  company_name: string | null;
  company_url: string | null;
  selected_bank_account_url: string | null;
  selected_bank_account_name: string | null;
  sync_cursor_updated_since: string | null;
  last_validated_at: string | null;
  last_synced_at: string | null;
  secret_storage: string;
};

export type FreeAgentCredentials = {
  environment: "production" | "sandbox" | "custom";
  base_url?: string;
  auth_url?: string;
  token_url?: string;
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token?: string;
};

export type FreeAgentOAuthExchangeRequest = {
  environment: "production" | "sandbox" | "custom";
  base_url?: string;
  auth_url?: string;
  token_url?: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  authorization_code: string;
};

export type FreeAgentValidationResult = {
  status: FreeAgentConnectionStatus;
  accounts: FreeAgentBankAccount[];
};

export type FreeAgentImportRequest = {
  bank_account_url: string;
  from_date?: string;
  to_date?: string;
  updated_since?: string;
  view?: string;
  last_uploaded?: boolean;
};

export type FreeAgentImportResult = {
  import_id: string;
  account_id: string;
  account_name: string;
  row_count: number;
  imported_transaction_count: number;
  skipped_duplicate_count: number;
  date_start: string | null;
  date_end: string | null;
  next_updated_since: string | null;
  warnings: string[];
};

export type FreeAgentAccountManagementRequest = {
  bank_account_url: string;
  managed: boolean;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
};

export type FreeAgentSyncAllRequest = {
  force?: boolean;
  only_auto_sync_enabled?: boolean;
  initial_lookback_days?: number;
};

export type FreeAgentSyncAllResult = {
  account_count: number;
  synced_account_count: number;
  skipped_account_count: number;
  imported_transaction_count: number;
  skipped_duplicate_count: number;
  results: FreeAgentImportResult[];
  warnings: string[];
};

export type GoogleSheetsConfig = {
  redirect_uri: string;
  spreadsheet_url: string;
  sheet_name: string;
};

export type GoogleSheetsStatus = {
  configured: boolean;
  validated: boolean;
  oauth_configured: boolean;
  status: string;
  message: string;
  client_id_last4: string | null;
  spreadsheet_id: string | null;
  spreadsheet_url: string | null;
  sheet_name: string | null;
  auth_url: string | null;
  last_validated_at: string | null;
  last_synced_at: string | null;
  secret_storage: string;
};

export type GoogleSheetsImportResult = {
  import_id: string;
  row_count: number;
  imported_transaction_count: number;
  skipped_duplicate_count: number;
  created_account_count: number;
  reused_account_count: number;
  date_start: string | null;
  date_end: string | null;
  warnings: string[];
};

export async function previewSnoopImport(file: File): Promise<ImportPreview> {
  return uploadCsv<ImportPreview>("/api/imports/snoop/preview", file);
}

export async function commitSnoopImport(file: File): Promise<ImportCommitResult> {
  return uploadCsv<ImportCommitResult>("/api/imports/snoop/commit", file);
}

export async function resetImportedData(): Promise<ResetDataResult> {
  return fetchJson<ResetDataResult>("/api/imports/reset", { method: "POST" });
}

export async function getFreeAgentStatus(): Promise<FreeAgentConnectionStatus> {
  return fetchJson<FreeAgentConnectionStatus>("/api/integrations/freeagent/status");
}

export async function saveFreeAgentCredentials(
  payload: FreeAgentCredentials,
): Promise<FreeAgentConnectionStatus> {
  return fetchJson<FreeAgentConnectionStatus>("/api/integrations/freeagent/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function exchangeFreeAgentOAuthCode(
  payload: FreeAgentOAuthExchangeRequest,
): Promise<FreeAgentConnectionStatus> {
  return fetchJson<FreeAgentConnectionStatus>("/api/integrations/freeagent/oauth/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function validateFreeAgent(): Promise<FreeAgentValidationResult> {
  return fetchJson<FreeAgentValidationResult>("/api/integrations/freeagent/validate", {
    method: "POST",
  });
}

export async function getFreeAgentBankAccounts(): Promise<FreeAgentBankAccount[]> {
  return fetchJson<FreeAgentBankAccount[]>("/api/integrations/freeagent/bank-accounts");
}

export async function manageFreeAgentBankAccount(
  payload: FreeAgentAccountManagementRequest,
): Promise<FreeAgentBankAccount> {
  return fetchJson<FreeAgentBankAccount>("/api/integrations/freeagent/bank-accounts/manage", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function importFreeAgentTransactions(
  payload: FreeAgentImportRequest,
): Promise<FreeAgentImportResult> {
  return fetchJson<FreeAgentImportResult>("/api/integrations/freeagent/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function syncAllFreeAgentAccounts(
  payload: FreeAgentSyncAllRequest,
): Promise<FreeAgentSyncAllResult> {
  return fetchJson<FreeAgentSyncAllResult>("/api/integrations/freeagent/sync-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getMonzoSheetsStatus(): Promise<GoogleSheetsStatus> {
  return fetchJson<GoogleSheetsStatus>("/api/integrations/google-sheets/monzo/status");
}

export async function saveMonzoSheetsConfig(
  payload: GoogleSheetsConfig,
): Promise<GoogleSheetsStatus> {
  return fetchJson<GoogleSheetsStatus>("/api/integrations/google-sheets/monzo/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function validateMonzoSheets(): Promise<GoogleSheetsStatus> {
  return fetchJson<GoogleSheetsStatus>("/api/integrations/google-sheets/monzo/validate", {
    method: "POST",
  });
}

export async function importMonzoSheets(): Promise<GoogleSheetsImportResult> {
  return fetchJson<GoogleSheetsImportResult>("/api/integrations/google-sheets/monzo/import", {
    method: "POST",
  });
}

export async function getPlaidStatus(): Promise<PlaidStatus> {
  return fetchJson<PlaidStatus>("/api/integrations/plaid/status");
}

export async function createPlaidLinkToken(): Promise<PlaidLinkToken> {
  return fetchJson<PlaidLinkToken>("/api/integrations/plaid/link-token", {
    method: "POST",
  });
}

export async function exchangePlaidPublicToken(
  payload: PlaidExchangeRequest,
): Promise<PlaidStatus> {
  return fetchJson<PlaidStatus>("/api/integrations/plaid/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function previewPlaid(days = 30): Promise<PlaidPreview> {
  return fetchJson<PlaidPreview>(`/api/integrations/plaid/preview${buildQuery({ days })}`);
}

export async function importPlaid(days = 30): Promise<PlaidImportResult> {
  return fetchJson<PlaidImportResult>("/api/integrations/plaid/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });
}

export async function detectTransfers(): Promise<TransferDetectionResult> {
  return fetchJson<TransferDetectionResult>("/api/transfers/detect", { method: "POST" });
}

export async function detectCommitments(): Promise<CommitmentDetectionResult> {
  return fetchJson<CommitmentDetectionResult>("/api/commitments/detect", { method: "POST" });
}

export async function getCommitments(): Promise<CommitmentsResponse> {
  return fetchJson<CommitmentsResponse>("/api/commitments");
}

export async function createCommitment(
  payload: CommitmentCreate,
): Promise<CommitmentSummary> {
  return fetchJson<CommitmentSummary>("/api/commitments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateCommitment(
  commitmentId: string,
  payload: CommitmentUpdate,
): Promise<CommitmentSummary> {
  return fetchJson<CommitmentSummary>(`/api/commitments/${commitmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteCommitment(commitmentId: string): Promise<CommitmentSummary> {
  return fetchJson<CommitmentSummary>(`/api/commitments/${commitmentId}`, {
    method: "DELETE",
  });
}

export async function markBillInstancePaid(
  instanceId: string,
  payload: BillInstancePayment,
): Promise<BillInstanceSummary> {
  return fetchJson<BillInstanceSummary>(`/api/commitments/instances/${instanceId}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getDecisions(limit = 100): Promise<DecisionQueueResponse> {
  return fetchJson<DecisionQueueResponse>(`/api/decisions?limit=${limit}`);
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>("/health");
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchJson<DashboardSummary>("/api/dashboard");
}

export async function getUpcomingCommitments(
  params: DateWindowParams = {},
): Promise<UpcomingCommitmentsResponse> {
  const query = buildQuery({
    days: params.days ?? 30,
    include_candidates: params.includeCandidates,
    start_date: params.startDate,
  });
  return fetchJson<UpcomingCommitmentsResponse>(`/api/calendar/upcoming${query}`);
}

export async function getForecast(params: DateWindowParams = {}): Promise<ForecastResponse> {
  const query = buildQuery({
    days: params.days ?? 30,
    include_candidates: params.includeCandidates,
    start_date: params.startDate,
  });
  return fetchJson<ForecastResponse>(`/api/forecast${query}`);
}

export async function getInsights(params: InsightParams = {}): Promise<InsightsResponse> {
  const query = buildQuery({
    end_date: params.endDate,
    start_date: params.startDate,
  });
  return fetchJson<InsightsResponse>(`/api/insights${query}`);
}

export async function getPlanningOverview(params: DateWindowParams = {}): Promise<PlanningOverview> {
  const query = buildQuery({
    days: params.days ?? 30,
    start_date: params.startDate,
  });
  return fetchJson<PlanningOverview>(`/api/planning/overview${query}`);
}

export async function confirmDecision(
  decisionType: string,
  decisionId: string,
): Promise<DecisionActionResult> {
  return fetchJson<DecisionActionResult>(
    `/api/decisions/${decisionType}/${decisionId}/confirm`,
    { method: "POST" },
  );
}

export async function rejectDecision(
  decisionType: string,
  decisionId: string,
): Promise<DecisionActionResult> {
  return fetchJson<DecisionActionResult>(
    `/api/decisions/${decisionType}/${decisionId}/reject`,
    { method: "POST" },
  );
}

export async function getAccounts(params: InsightParams = {}): Promise<AccountsResponse> {
  const query = buildQuery({
    end_date: params.endDate,
    start_date: params.startDate,
  });
  return fetchJson<AccountsResponse>(`/api/accounts${query}`);
}

export async function updateAccount(
  accountId: string,
  payload: AccountUpdate,
): Promise<AccountSummary> {
  return fetchJson<AccountSummary>(`/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionsResponse> {
  const query = buildQuery({
    account_id: filters.accountId,
    end_date: filters.endDate,
    include_transfer_candidates: filters.includeTransferCandidates ?? false,
    limit: filters.limit ?? 100,
    normalized_group: filters.normalizedGroup,
    offset: filters.offset,
    reviewed: filters.reviewed,
    search: filters.search,
    start_date: filters.startDate,
    status: filters.status,
    transaction_type: filters.transactionType,
  });
  return fetchJson<TransactionsResponse>(`/api/transactions${query}`);
}

export async function updateTransaction(
  transactionId: string,
  payload: TransactionUpdate,
): Promise<TransactionSummary> {
  return fetchJson<TransactionSummary>(`/api/transactions/${transactionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function uploadCsv<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  return fetchJson<T>(path, { method: "POST", body: formData });
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  const requestUrl = `${API_BASE}${path}`;
  if (method === "GET") {
    const existing = inFlightGetRequests.get(requestUrl);
    if (existing) return existing as Promise<T>;
  }

  const request = fetch(requestUrl, init).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(readableApiError(errorText, response.status));
    }
    return response.json() as Promise<T>;
  });

  if (method === "GET") {
    inFlightGetRequests.set(requestUrl, request);
    request.finally(() => inFlightGetRequests.delete(requestUrl));
  }

  return request;
}

function readableApiError(errorText: string, status: number): string {
  if (!errorText) return `Request failed with ${status}`;
  try {
    const parsed = JSON.parse(errorText) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) return String(item.msg);
          return JSON.stringify(item);
        })
        .join("; ");
    }
  } catch {
    return errorText;
  }
  return errorText;
}

function buildQuery(params: Record<string, boolean | number | string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
