const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8025";

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

export type AccountSummary = {
  id: string;
  provider: string;
  display_name: string;
  source_account_name: string;
  account_type: string;
  current_balance: string | null;
  include_in_cash_on_hand: boolean;
  include_in_forecast: boolean;
  transaction_count: number;
  inflow_total: string;
  outflow_total: string;
  net_total: string;
};

export type AccountUpdate = {
  account_type?: string;
  current_balance?: string;
  balance_as_of?: string;
  include_in_cash_on_hand?: boolean;
  include_in_forecast?: boolean;
};

export type AccountsResponse = {
  entity_name: string;
  accounts: AccountSummary[];
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
  commitment_type: string;
  frequency: string;
  expected_amount: string;
  next_due_date: string | null;
  status: string;
  source: string;
  instance_count: number;
};

export type CommitmentUpdate = {
  name?: string;
  commitment_type?: string;
  frequency?: string;
  expected_amount?: string;
  next_due_date?: string;
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
  flexible_spend_allowance: string;
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

export type InsightsResponse = {
  start_date: string | null;
  end_date: string | null;
  category_groups: CategoryInsight[];
  top_merchants: MerchantInsight[];
  internal_transfers_excluded: boolean;
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

export async function previewSnoopImport(file: File): Promise<ImportPreview> {
  return uploadCsv<ImportPreview>("/api/imports/snoop/preview", file);
}

export async function commitSnoopImport(file: File): Promise<ImportCommitResult> {
  return uploadCsv<ImportCommitResult>("/api/imports/snoop/commit", file);
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

export async function getDecisions(): Promise<DecisionQueueResponse> {
  return fetchJson<DecisionQueueResponse>("/api/decisions");
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchJson<DashboardSummary>("/api/dashboard");
}

export async function getUpcomingCommitments(): Promise<UpcomingCommitmentsResponse> {
  return fetchJson<UpcomingCommitmentsResponse>("/api/calendar/upcoming?days=30");
}

export async function getForecast(): Promise<ForecastResponse> {
  return fetchJson<ForecastResponse>("/api/forecast?days=30");
}

export async function getInsights(): Promise<InsightsResponse> {
  return fetchJson<InsightsResponse>("/api/insights");
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

export async function getAccounts(): Promise<AccountsResponse> {
  return fetchJson<AccountsResponse>("/api/accounts");
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

export async function getTransactions(): Promise<TransactionsResponse> {
  return fetchJson<TransactionsResponse>("/api/transactions?include_transfer_candidates=false");
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
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}
