import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  sankey as createSankey,
  sankeyLinkHorizontal,
  type SankeyGraph,
  type SankeyNode,
} from "d3-sankey";

import {
  API_BASE,
  type AccountsResponse,
  type CommitmentDetectionResult,
  type CommitmentsResponse,
  type DashboardSummary,
  type DecisionQueueResponse,
  type ForecastResponse,
  type HealthResponse,
  type ImportCommitResult,
  type ImportPreview,
  type InsightsResponse,
  type PlanningOverview,
  type TransactionFilters,
  type TransactionUpdate,
  type TransactionsResponse,
  type TransferDetectionResult,
  type UpcomingCommitmentsResponse,
  commitSnoopImport,
  confirmDecision,
  detectCommitments,
  detectTransfers,
  getAccounts,
  getCommitments,
  getDashboardSummary,
  getDecisions,
  getForecast,
  getHealth,
  getInsights,
  getPlanningOverview,
  getTransactions,
  getUpcomingCommitments,
  markBillInstancePaid,
  previewSnoopImport,
  rejectDecision,
  updateAccount,
  updateCommitment,
  updateTransaction,
} from "./api";

type LoadState = "idle" | "loading" | "ready" | "error";
type ApiHealthState = {
  checkedAt: string | null;
  details: HealthResponse | null;
  message: string;
  status: "checking" | "online" | "offline";
};
type PeriodPreset = "this-month" | "last-30" | "next-15" | "next-30" | "custom";
type DateWindowKind = "current" | "future" | "past";
type TransactionFilterState = {
  accountId: string;
  normalizedGroup: string;
  reviewed: "all" | "reviewed" | "unreviewed";
  status: string;
  transactionType: string;
};
type AccountRow = AccountsResponse["accounts"][number];
type AccountGroup = {
  accounts: AccountRow[];
  defaultOpen: boolean;
  id: string;
  label: string;
  monthChange: number;
  total: number;
};
type CalendarDayModel = {
  date: string;
  inPeriod: boolean;
  items: UpcomingCommitmentsResponse["items"];
  total: number;
};

const navItems = [
  { label: "Dashboard", route: "dashboard" },
  { label: "Accounts", route: "accounts" },
  { label: "Transactions", route: "transactions" },
  { label: "Cash Flow", route: "cash-flow" },
  { label: "Calendar", route: "calendar" },
  { label: "Recurring", route: "recurring" },
  { label: "Goals", route: "goals" },
  { label: "Sinking Funds", route: "sinking-funds" },
  { label: "Monthly Review", route: "monthly-review" },
  { label: "Subscriptions", route: "subscriptions" },
  { label: "Reports", route: "reports" },
  { label: "Decision Queue", route: "decision-queue" },
  { label: "Settings", route: "settings" },
] as const;

type RouteId = (typeof navItems)[number]["route"];

const pageTitles: Record<RouteId, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Household workspace", title: "Good day, Kiran." },
  accounts: { eyebrow: "Accounts", title: "Review balances and account roles." },
  transactions: { eyebrow: "Transactions", title: "Understand where the money moved." },
  "cash-flow": { eyebrow: "Cash flow", title: "See what is coming next." },
  calendar: { eyebrow: "Calendar", title: "Plan bills by date." },
  recurring: { eyebrow: "Recurring", title: "Confirm bills, subscriptions, and debt payments." },
  goals: { eyebrow: "Goals", title: "Turn spare cash into a plan." },
  "sinking-funds": { eyebrow: "Sinking funds", title: "Make non-monthly bills feel monthly." },
  "monthly-review": { eyebrow: "Monthly review", title: "Close the month with confidence." },
  subscriptions: { eyebrow: "Subscriptions", title: "Keep only what earns its place." },
  reports: { eyebrow: "Reports", title: "Spot spending patterns." },
  "decision-queue": { eyebrow: "Decision queue", title: "Resolve only the decisions that matter." },
  settings: { eyebrow: "System status", title: "Keep the local stack healthy." },
};

const periodOptions: Array<{ label: string; value: PeriodPreset }> = [
  { label: "This month", value: "this-month" },
  { label: "Last 30 days", value: "last-30" },
  { label: "Next 15 days", value: "next-15" },
  { label: "Next 30 days", value: "next-30" },
  { label: "Custom", value: "custom" },
];

const transactionGroups = ["fixed", "flexible", "non_monthly", "income", "debt", "transfer", "ignored", "needs_review"];

const transactionTypes = [
  "needs_review",
  "spending",
  "income",
  "debt_payment",
  "internal_transfer",
  "refund",
  "ignored",
];

export function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [accounts, setAccounts] = useState<AccountsResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionsResponse | null>(null);
  const [transferResult, setTransferResult] = useState<TransferDetectionResult | null>(null);
  const [commitmentResult, setCommitmentResult] = useState<CommitmentDetectionResult | null>(null);
  const [commitments, setCommitments] = useState<CommitmentsResponse | null>(null);
  const [decisions, setDecisions] = useState<DecisionQueueResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingCommitmentsResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [planning, setPlanning] = useState<PlanningOverview | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this-month");
  const [customStartDate, setCustomStartDate] = useState(todayIso());
  const [customEndDate, setCustomEndDate] = useState(addDays(todayIso(), 30));
  const [includeCandidates, setIncludeCandidates] = useState(true);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilterState>({
    accountId: "",
    normalizedGroup: "",
    reviewed: "all",
    status: "",
    transactionType: "",
  });
  const [route, setRoute] = useState<RouteId>(currentRoute());
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<ApiHealthState>({
    checkedAt: null,
    details: null,
    message: `Checking ${API_BASE}`,
    status: "checking",
  });

  const busy = loadState === "loading";
  const pageTitle = getPageTitle(route);
  const showCandidateToggle = candidateToggleApplies(route);
  const dateWindow = useMemo(
    () => getDateWindow(periodPreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, periodPreset],
  );
  const dateWindowKind = periodKindForPreset(periodPreset, dateWindow.startDate, dateWindow.endDate);
  const transactionQuery = useMemo(
    () => buildTransactionFilters(dateWindow, transactionFilters, searchQuery),
    [dateWindow, searchQuery, transactionFilters],
  );

  async function checkApiHealth() {
    try {
      const health = await getHealth();
      setApiHealth({
        checkedAt: new Date().toLocaleTimeString(),
        details: health,
        message: `${health.app} API is online`,
        status: "online",
      });
    } catch {
      setApiHealth({
        checkedAt: new Date().toLocaleTimeString(),
        details: null,
        message: `Backend API is offline at ${API_BASE}`,
        status: "offline",
      });
    }
  }

  useEffect(() => {
    void checkApiHealth();
    const intervalId = window.setInterval(() => void checkApiHealth(), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateExistingWorkspace() {
      const [
        accountsResult,
        transactionsResult,
        commitmentsResult,
        decisionsResult,
        dashboardResult,
        upcomingResult,
        forecastResult,
        insightsResult,
        planningResult,
      ] = await Promise.allSettled([
        getAccounts(),
        getTransactions(transactionQuery),
        getCommitments(),
        getDecisions(),
        getDashboardSummary(),
        getUpcomingCommitments({
          days: dateWindow.days,
          includeCandidates,
          startDate: dateWindow.startDate,
        }),
        getForecast({
          days: dateWindow.days,
          includeCandidates,
          startDate: dateWindow.startDate,
        }),
        getInsights({ endDate: dateWindow.endDate, startDate: dateWindow.startDate }),
        getPlanningOverview(),
      ]);

      if (cancelled) return;
      if (accountsResult.status === "fulfilled") setAccounts(accountsResult.value);
      if (transactionsResult.status === "fulfilled") setTransactions(transactionsResult.value);
      if (commitmentsResult.status === "fulfilled") setCommitments(commitmentsResult.value);
      if (decisionsResult.status === "fulfilled") setDecisions(decisionsResult.value);
      if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value);
      if (upcomingResult.status === "fulfilled") setUpcoming(upcomingResult.value);
      if (forecastResult.status === "fulfilled") setForecast(forecastResult.value);
      if (insightsResult.status === "fulfilled") setInsights(insightsResult.value);
      if (planningResult.status === "fulfilled") setPlanning(planningResult.value);
    }

    void hydrateExistingWorkspace();

    return () => {
      cancelled = true;
    };
  }, [dateWindow, includeCandidates, transactionQuery]);

  useEffect(() => {
    let cancelled = false;

    async function refreshFilteredTransactions() {
      const result = await getTransactions(transactionQuery);
      if (!cancelled) setTransactions(result);
    }

    void refreshFilteredTransactions().catch((err: unknown) => {
      if (!cancelled) setError(errorMessage(err));
    });

    return () => {
      cancelled = true;
    };
  }, [transactionQuery]);

  useEffect(() => {
    function handleHashChange() {
      const { params, route: nextRoute } = parseHashState();
      setRoute(nextRoute);
      applyRouteQuery(params);
    }

    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/dashboard");
    }

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function applyRouteQuery(params: URLSearchParams) {
    const range = params.get("range");
    const reviewed = params.get("reviewed");
    if (range && periodOptions.some((option) => option.value === range)) {
      setPeriodPreset(range as PeriodPreset);
    }
    const querySearch = params.get("search");
    if (querySearch !== null) setSearchQuery(querySearch);
    setTransactionFilters((filters) => ({
      accountId: params.get("account") ?? filters.accountId,
      normalizedGroup: params.get("group") ?? filters.normalizedGroup,
      reviewed: isReviewFilter(reviewed) ? reviewed : filters.reviewed,
      status: params.get("status") ?? filters.status,
      transactionType: params.get("type") ?? filters.transactionType,
    }));
  }

  async function runPreview(file: File) {
    setSelectedFile(file);
    setError(null);
    setLoadState("loading");
    try {
      setPreview(await previewSnoopImport(file));
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runCommit() {
    if (!selectedFile) return;
    setError(null);
    setLoadState("loading");
    try {
      const result = await commitSnoopImport(selectedFile);
      setCommitResult(result);
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runTransferDetection() {
    setError(null);
    setLoadState("loading");
    try {
      setTransferResult(await detectTransfers());
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runCommitmentDetection() {
    setError(null);
    setLoadState("loading");
    try {
      const result = await detectCommitments();
      setCommitmentResult(result);
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function refreshWorkspace() {
    const [
      accountsResult,
      transactionsResult,
      commitmentsResult,
      decisionsResult,
      dashboardResult,
      upcomingResult,
      forecastResult,
      insightsResult,
      planningResult,
    ] = await Promise.all([
      getAccounts(),
      getTransactions(transactionQuery),
      getCommitments(),
      getDecisions(),
      getDashboardSummary(),
      getUpcomingCommitments({
        days: dateWindow.days,
        includeCandidates,
        startDate: dateWindow.startDate,
      }),
      getForecast({
        days: dateWindow.days,
        includeCandidates,
        startDate: dateWindow.startDate,
      }),
      getInsights({ endDate: dateWindow.endDate, startDate: dateWindow.startDate }),
      getPlanningOverview(),
    ]);
    setAccounts(accountsResult);
    setTransactions(transactionsResult);
    setCommitments(commitmentsResult);
    setDecisions(decisionsResult);
    setDashboard(dashboardResult);
    setUpcoming(upcomingResult);
    setForecast(forecastResult);
    setInsights(insightsResult);
    setPlanning(planningResult);
  }

  async function runDecisionAction(
    action: "confirm" | "reject",
    decisionType: string,
    decisionId: string,
  ) {
    setError(null);
    setLoadState("loading");
    try {
      if (action === "confirm") {
        await confirmDecision(decisionType, decisionId);
      } else {
        await rejectDecision(decisionType, decisionId);
      }
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runAccountBalanceUpdate(accountId: string, balance: string, accountType: string) {
    setError(null);
    setLoadState("loading");
    try {
      await updateAccount(accountId, {
        account_type: accountType,
        current_balance: balance,
        balance_as_of: new Date().toISOString().slice(0, 10),
      });
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runTransactionUpdate(transactionId: string, payload: TransactionUpdate) {
    setError(null);
    setLoadState("loading");
    try {
      await updateTransaction(transactionId, payload);
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runCommitmentUpdate(commitmentId: string, status: string) {
    setError(null);
    setLoadState("loading");
    try {
      await updateCommitment(commitmentId, { status });
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runBillPaid(instanceId: string, amount: string) {
    setError(null);
    setLoadState("loading");
    try {
      await markBillInstancePaid(instanceId, {
        actual_amount: amount,
        paid_date: new Date().toISOString().slice(0, 10),
      });
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  return (
    <div className="app-frame">
      <Sidebar currentRoute={route} />
      <main className="dashboard-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">{pageTitle.eyebrow}</p>
            <h1>{pageTitle.title}</h1>
          </div>
          <div className="topbar-actions">
            <input
              aria-label="Search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search accounts, bills, transactions..."
              value={searchQuery}
            />
            <PeriodControls
              customEndDate={customEndDate}
              customStartDate={customStartDate}
              includeCandidates={includeCandidates}
              onCustomEndDateChange={setCustomEndDate}
              onCustomStartDateChange={setCustomStartDate}
              onIncludeCandidatesChange={setIncludeCandidates}
              onPresetChange={setPeriodPreset}
              preset={periodPreset}
              showCandidateToggle={showCandidateToggle}
            />
            <SystemStatusBadge health={apiHealth} />
            <span className="local-badge">Local data</span>
          </div>
        </header>

        {apiHealth.status === "offline" ? <ApiOfflineBanner onRetry={checkApiHealth} /> : null}
        {error ? <p className="error-banner">{error}</p> : null}

        <AppPage
          apiHealth={apiHealth}
          accounts={accounts}
          busy={busy}
          commitmentResult={commitmentResult}
          commitments={commitments}
          commitResult={commitResult}
          dashboard={dashboard}
          decisions={decisions}
          forecast={forecast}
          insights={insights}
          planning={planning}
          onHealthCheck={checkApiHealth}
          onAccountBalanceUpdate={runAccountBalanceUpdate}
          onBillPaid={runBillPaid}
          onCommit={runCommit}
          onCommitmentUpdate={runCommitmentUpdate}
          onDecisionAction={runDecisionAction}
          onDetectCommitments={runCommitmentDetection}
          onDetectTransfers={runTransferDetection}
          onPreview={runPreview}
          preview={preview}
          query={searchQuery}
          route={route}
          includeCandidates={includeCandidates}
          transactions={transactions}
          onTransactionUpdate={runTransactionUpdate}
          periodLabel={dateWindow.label}
          periodKind={dateWindowKind}
          setTransactionFilters={setTransactionFilters}
          transactionFilters={transactionFilters}
          transferResult={transferResult}
          upcoming={upcoming}
        />
      </main>
    </div>
  );
}

function Sidebar({ currentRoute }: { currentRoute: RouteId }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark">P</span>
        <strong>Personal Finance Studio</strong>
      </div>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => (
          <a
            className={item.route === currentRoute ? "active" : ""}
            href={`#/${item.route}`}
            key={item.route}
          >
            <span className="nav-dot" />
            {item.label}
          </a>
        ))}
      </nav>
      <div className="assistant-card">
        <span className="status-dot" />
        <strong>Local AI later</strong>
        <p>Phase 1 keeps answers deterministic before we add an assistant.</p>
      </div>
      <div className="profile-chip">
        <span>K</span>
        <div>
          <strong>Kiran</strong>
          <small>Household</small>
        </div>
      </div>
    </aside>
  );
}

function SystemStatusBadge({ health }: { health: ApiHealthState }) {
  return (
    <a
      className={`system-badge system-badge-${health.status}`}
      href="#/settings"
      title={health.message}
    >
      <span className="system-badge-dot" />
      API {health.status === "online" ? "online" : health.status === "offline" ? "offline" : "checking"}
    </a>
  );
}

function ApiOfflineBanner({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <div className="error-banner api-offline-banner" role="alert">
      <div>
        <strong>Backend API is offline.</strong>
        <span> Start the local backend on port 8025, then retry.</span>
        <code>uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8025</code>
      </div>
      <button onClick={() => void onRetry()} type="button">
        Check again
      </button>
    </div>
  );
}

function PeriodControls({
  customEndDate,
  customStartDate,
  includeCandidates,
  onCustomEndDateChange,
  onCustomStartDateChange,
  onIncludeCandidatesChange,
  onPresetChange,
  preset,
  showCandidateToggle,
}: {
  customEndDate: string;
  customStartDate: string;
  includeCandidates: boolean;
  onCustomEndDateChange: (value: string) => void;
  onCustomStartDateChange: (value: string) => void;
  onIncludeCandidatesChange: (value: boolean) => void;
  onPresetChange: (value: PeriodPreset) => void;
  preset: PeriodPreset;
  showCandidateToggle: boolean;
}) {
  return (
    <div className="period-controls" aria-label="Date range controls">
      <select
        aria-label="Date range"
        onChange={(event) => onPresetChange(event.target.value as PeriodPreset)}
        value={preset}
      >
        {periodOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {preset === "custom" ? (
        <>
          <input
            aria-label="Start date"
            onChange={(event) => onCustomStartDateChange(event.target.value)}
            type="date"
            value={customStartDate}
          />
          <input
            aria-label="End date"
            onChange={(event) => onCustomEndDateChange(event.target.value)}
            type="date"
            value={customEndDate}
          />
        </>
      ) : null}
      {showCandidateToggle ? (
        <label className="candidate-toggle">
          <input
            checked={includeCandidates}
            onChange={(event) => onIncludeCandidatesChange(event.target.checked)}
            type="checkbox"
          />
          Include bill candidates
        </label>
      ) : null}
    </div>
  );
}

function AppPage({
  apiHealth,
  accounts,
  busy,
  commitmentResult,
  commitments,
  commitResult,
  dashboard,
  decisions,
  forecast,
  includeCandidates,
  insights,
  planning,
  onHealthCheck,
  onAccountBalanceUpdate,
  onBillPaid,
  onCommit,
  onCommitmentUpdate,
  onDecisionAction,
  onDetectCommitments,
  onDetectTransfers,
  onPreview,
  periodKind,
  periodLabel,
  preview,
  query,
  route,
  setTransactionFilters,
  transactions,
  onTransactionUpdate,
  transactionFilters,
  transferResult,
  upcoming,
}: {
  apiHealth: ApiHealthState;
  accounts: AccountsResponse | null;
  busy: boolean;
  commitmentResult: CommitmentDetectionResult | null;
  commitments: CommitmentsResponse | null;
  commitResult: ImportCommitResult | null;
  dashboard: DashboardSummary | null;
  decisions: DecisionQueueResponse | null;
  forecast: ForecastResponse | null;
  includeCandidates: boolean;
  insights: InsightsResponse | null;
  planning: PlanningOverview | null;
  onHealthCheck: () => Promise<void>;
  onAccountBalanceUpdate: (
    accountId: string,
    balance: string,
    accountType: string,
  ) => Promise<void>;
  onBillPaid: (instanceId: string, amount: string) => Promise<void>;
  onCommit: () => Promise<void>;
  onCommitmentUpdate: (commitmentId: string, status: string) => Promise<void>;
  onDecisionAction: (
    action: "confirm" | "reject",
    decisionType: string,
    decisionId: string,
  ) => Promise<void>;
  onDetectCommitments: () => Promise<void>;
  onDetectTransfers: () => Promise<void>;
  onPreview: (file: File) => Promise<void>;
  periodKind: DateWindowKind;
  periodLabel: string;
  preview: ImportPreview | null;
  query: string;
  route: RouteId;
  setTransactionFilters: (filters: TransactionFilterState) => void;
  transactions: TransactionsResponse | null;
  onTransactionUpdate: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  transactionFilters: TransactionFilterState;
  transferResult: TransferDetectionResult | null;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  if (route === "accounts") {
    return (
      <section className="page-grid" aria-label="Accounts page">
        <AccountPerformanceCard accounts={accounts} dashboard={dashboard} />
        <AccountsCard
          accounts={accounts}
          busy={busy}
          limit={12}
          onAccountBalanceUpdate={onAccountBalanceUpdate}
          query={query}
        />
        <AssetSummaryCard accounts={accounts} />
      </section>
    );
  }

  if (route === "transactions") {
    return (
      <section className="page-grid page-grid-single" aria-label="Transactions page">
        <TransactionsCard
          accounts={accounts}
          limit={18}
          onTransactionUpdate={onTransactionUpdate}
          query={query}
          setTransactionFilters={setTransactionFilters}
          transactions={transactions}
          transactionFilters={transactionFilters}
        />
      </section>
    );
  }

  if (route === "cash-flow") {
    return (
      <section className="page-grid" aria-label="Cash flow page">
        <CashflowCard
          commitmentResult={commitmentResult}
          commitments={commitments}
          dashboard={dashboard}
          decisions={decisions}
          forecast={forecast}
          includeCandidates={includeCandidates}
          preview={preview}
          transactions={transactions}
          transferResult={transferResult}
          upcoming={upcoming}
        />
        <UpcomingCard
          includeCandidates={includeCandidates}
          limit={12}
          onBillPaid={onBillPaid}
          periodKind={periodKind}
          query={query}
          upcoming={upcoming}
        />
      </section>
    );
  }

  if (route === "calendar") {
    return (
      <section className="page-grid page-grid-single" aria-label="Calendar page">
        <CalendarPlannerCard
          includeCandidates={includeCandidates}
          onBillPaid={onBillPaid}
          periodKind={periodKind}
          periodLabel={periodLabel}
          query={query}
          upcoming={upcoming}
        />
      </section>
    );
  }

  if (route === "recurring") {
    return (
      <section className="page-grid" aria-label="Recurring page">
        <RecurringCard
          commitments={commitments}
          limit={15}
          onCommitmentUpdate={onCommitmentUpdate}
          query={query}
        />
        <UpcomingCard
          includeCandidates={includeCandidates}
          limit={12}
          onBillPaid={onBillPaid}
          periodKind={periodKind}
          query={query}
          upcoming={upcoming}
        />
      </section>
    );
  }

  if (route === "goals") {
    return (
      <section className="page-grid" aria-label="Goals page">
        <GoalsCard planning={planning} />
        <ImportFreshnessCard planning={planning} />
      </section>
    );
  }

  if (route === "sinking-funds") {
    return (
      <section className="page-grid" aria-label="Sinking funds page">
        <SinkingFundsCard planning={planning} />
        <StaleCommitmentsCard planning={planning} />
      </section>
    );
  }

  if (route === "monthly-review") {
    return (
      <section className="page-grid" aria-label="Monthly review page">
        <MonthlyReviewCard planning={planning} />
        <SavedFiltersCard planning={planning} />
      </section>
    );
  }

  if (route === "subscriptions") {
    return (
      <section className="page-grid" aria-label="Subscriptions page">
        <SubscriptionsCard planning={planning} />
        <StaleCommitmentsCard planning={planning} />
      </section>
    );
  }

  if (route === "decision-queue") {
    return (
      <section className="page-grid page-grid-single" aria-label="Decision queue page">
        <DecisionQueueCard
          busy={busy}
          decisions={decisions}
          limit={16}
          onDecisionAction={onDecisionAction}
          query={query}
        />
      </section>
    );
  }

  if (route === "reports") {
    return (
      <section className="page-grid page-grid-single" aria-label="Reports page">
        <ReportMetricStrip insights={insights} />
        <SankeyReportCard insights={insights} periodLabel={periodLabel} />
        <InsightsCard insights={insights} periodLabel={periodLabel} />
        <SavedFiltersCard planning={planning} />
      </section>
    );
  }

  if (route === "settings") {
    return (
      <section className="page-grid page-grid-single" aria-label="Settings page">
        <SystemStatusCard health={apiHealth} onHealthCheck={onHealthCheck} />
      </section>
    );
  }

  return (
    <section className="dashboard-grid" aria-label="Personal Finance Studio dashboard">
      <DashboardHeroCard
        dashboard={dashboard}
        periodKind={periodKind}
        planning={planning}
        upcoming={upcoming}
      />
      <BudgetCard dashboard={dashboard} />
      <UpcomingCard
        includeCandidates={includeCandidates}
        onBillPaid={onBillPaid}
        periodKind={periodKind}
        periodLabel={periodLabel}
        query={query}
        upcoming={upcoming}
      />
      <GettingStartedCard
        accounts={accounts}
        busy={busy}
        commitmentResult={commitmentResult}
        commitments={commitments}
        commitResult={commitResult}
        decisions={decisions}
        onCommit={onCommit}
        onDetectCommitments={onDetectCommitments}
        onDetectTransfers={onDetectTransfers}
        onPreview={onPreview}
        preview={preview}
        transactions={transactions}
        transferResult={transferResult}
      />
      <SpendingCard dashboard={dashboard} insights={insights} />
      <InsightsCard insights={insights} periodLabel={periodLabel} />
      <DecisionQueueCard
        busy={busy}
        compact
        decisions={decisions}
        limit={3}
        onDecisionAction={onDecisionAction}
        query={query}
      />
      <CashflowCard
        commitmentResult={commitmentResult}
        commitments={commitments}
        dashboard={dashboard}
        decisions={decisions}
        forecast={forecast}
        includeCandidates={includeCandidates}
        preview={preview}
        transactions={transactions}
        transferResult={transferResult}
        upcoming={upcoming}
      />
    </section>
  );
}

function GettingStartedCard({
  busy,
  preview,
  commitResult,
  transferResult,
  commitmentResult,
  commitments,
  decisions,
  accounts,
  transactions,
  onPreview,
  onCommit,
  onDetectTransfers,
  onDetectCommitments,
}: {
  busy: boolean;
  preview: ImportPreview | null;
  commitResult: ImportCommitResult | null;
  transferResult: TransferDetectionResult | null;
  commitmentResult: CommitmentDetectionResult | null;
  commitments: CommitmentsResponse | null;
  decisions: DecisionQueueResponse | null;
  accounts: AccountsResponse | null;
  transactions: TransactionsResponse | null;
  onPreview: (file: File) => Promise<void>;
  onCommit: () => Promise<void>;
  onDetectTransfers: () => Promise<void>;
  onDetectCommitments: () => Promise<void>;
}) {
  const hasImportedData = Boolean(commitResult) || Boolean(transactions?.total_count);
  const steps = [
    {
      complete: Boolean(preview),
      title: "Preview Snoop CSV",
      detail: preview ? `${preview.row_count} rows found` : "Check the file before saving it",
      action: (
        <label className="inline-file-action">
          Choose file
          <input
            aria-label="Choose Snoop CSV"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onPreview(file);
            }}
          />
        </label>
      ),
    },
    {
      complete: Boolean(commitResult) || Boolean(accounts?.accounts.length) || Boolean(transactions?.total_count),
      title: "Commit import",
      detail: commitResult
        ? `${commitResult.imported_transaction_count} imported`
        : transactions?.total_count
          ? `${transactions.total_count} transactions loaded`
        : "Persist transactions and accounts",
      action: (
        <button disabled={!preview || busy} onClick={() => void onCommit()} type="button">
          Commit
        </button>
      ),
    },
    {
      complete: Boolean(transferResult) || hasDecisionType(decisions, "internal_transfer"),
      title: "Detect internal transfers",
      detail: transferResult
        ? `${transferResult.candidate_count} candidates`
        : hasDecisionType(decisions, "internal_transfer")
          ? "Candidates waiting in queue"
        : "Pair account movements before reporting",
      action: (
        <button disabled={!hasImportedData || busy} onClick={onDetectTransfers} type="button">
          Detect
        </button>
      ),
    },
    {
      complete: Boolean(commitmentResult) || Boolean(commitments?.total_count),
      title: "Find recurring bills",
      detail: commitmentResult
        ? `${commitmentResult.candidate_count} candidates`
        : commitments?.total_count
          ? `${commitments.total_count} candidates`
        : "Create a useful recurring inbox",
      action: (
        <button disabled={!hasImportedData || busy} onClick={onDetectCommitments} type="button">
          Detect
        </button>
      ),
    },
  ];

  return (
    <article className="card getting-started wide-card">
      <CardHeader title="Getting Started" subtitle="Finish setup from your Snoop export." />
      <div className="progress-ring" aria-label={`${completedCount(steps)} of ${steps.length} complete`}>
        {completedCount(steps)}/{steps.length}
      </div>
      <div className="checklist">
        {steps.map((step) => (
          <div className={`check-row ${step.complete ? "complete" : ""}`} key={step.title}>
            <span className="check-box">{step.complete ? "" : ""}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </div>
            {step.action}
          </div>
        ))}
      </div>
    </article>
  );
}

function SpendingCard({
  dashboard,
  insights,
}: {
  dashboard: DashboardSummary | null;
  insights: InsightsResponse | null;
}) {
  const groups = reportGroups(insights, "category", "spending").slice(0, 4);
  const totalOutflow = groups.reduce((sum, group) => sum + group.value, 0);
  const safeTotal = totalOutflow || Number(dashboard?.flexible_spend_actual ?? 0);
  const topGroup = groups[0];

  return (
    <article className="card spending-pulse-card">
      <CardHeader title="Spending Pulse" subtitle="This month by category" />
      <div className="spending-pulse-hero">
        <span>Total outflow</span>
        <strong>{safeTotal ? money(String(safeTotal)) : "-"}</strong>
        <small>
          {dashboard?.flexible_spend_remaining
            ? `${money(dashboard.flexible_spend_remaining)} flexible left`
            : "Import transactions to unlock trends"}
        </small>
      </div>
      {groups.length > 0 ? (
        <div className="spending-bar-list" aria-label="Spending by category">
          {groups.map((group) => {
            const width = totalOutflow ? Math.max(8, (group.value / totalOutflow) * 100) : 0;
            return (
              <div className="spending-bar-row" key={group.label}>
                <div>
                  <strong>{group.label}</strong>
                  <small>{money(String(group.value))}</small>
                </div>
                <span className="spending-track">
                  <span style={{ background: group.color, width: `${width}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty-copy">No categorized spending yet.</p>
      )}
      <div className="split-metrics">
        <Metric label="Top group" value={topGroup?.label ?? "-"} />
        <Metric
          label="Flex allowance"
          value={dashboard?.flexible_spend_allowance ? money(dashboard.flexible_spend_allowance) : "-"}
        />
      </div>
    </article>
  );
}

function DashboardHeroCard({
  dashboard,
  periodKind,
  planning,
  upcoming,
}: {
  dashboard: DashboardSummary | null;
  periodKind: DateWindowKind;
  planning: PlanningOverview | null;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const cashReady = dashboard?.confidence === "ready";
  const freshness = planning?.import_freshness.status ?? "checking";
  return (
    <article className="card dashboard-hero-card">
      <div className="dashboard-hero-copy">
        <span className="hero-kicker">Today’s household position</span>
        <strong>{cashReady && dashboard?.cash_on_hand ? money(dashboard.cash_on_hand) : "Needs balances"}</strong>
        <p>
          {cashReady
            ? "Balances are ready. Use cash flow and upcoming bills to decide what is safe to spend."
            : dashboard?.message ?? "Import data and enter balances to unlock trusted available-money planning."}
        </p>
        <div className="hero-actions">
          <a className="button-link" href="#/accounts">Review balances</a>
          <a className="button-link button-link-secondary" href="#/cash-flow">Open cash flow</a>
        </div>
      </div>
      <div className="hero-stat-grid">
        <Metric
          label="After bills"
          value={dashboard?.available_after_commitments ? money(dashboard.available_after_commitments) : "-"}
        />
        <Metric
          label="Flexible left"
          value={dashboard?.flexible_spend_remaining ? money(dashboard.flexible_spend_remaining) : "-"}
        />
        <Metric
          label={billMetricLabel(periodKind)}
          value={upcoming ? money(upcoming.expected_total) : "-"}
        />
        <Metric label="Decisions" value={dashboard?.decision_count ?? "-"} />
      </div>
      <div className={`hero-freshness hero-freshness-${freshness}`}>
        <span className="system-badge-dot" />
        <div>
          <strong>{titleCase(freshness)}</strong>
          <small>{planning?.import_freshness.message ?? "Checking local data freshness."}</small>
        </div>
      </div>
    </article>
  );
}

function BudgetCard({ dashboard }: { dashboard: DashboardSummary | null }) {
  const knownBalances = dashboard?.cash_balance_account_count ?? 0;
  const missingBalances = dashboard?.missing_balance_account_count ?? 0;
  const isReady = dashboard?.confidence === "ready";
  return (
    <article className="card tall-card balance-readiness-card">
      <CardHeader title="Balance Readiness" subtitle={balanceStatusLabel(dashboard?.confidence)} />
      <div className="money-focus balance-focus">
        <span>Setup status</span>
        <strong className="metric-value">{isReady ? "Ready" : "Needs balances"}</strong>
        <p>
          {isReady
            ? "Cash balances are trusted, so available-money planning can use real account totals."
            : "Enter current balances for cash accounts before trusting available-money calculations."}
        </p>
      </div>
      <div className="split-metrics">
        <Metric
          label="Known balances"
          value={`${knownBalances} ${knownBalances === 1 ? "account" : "accounts"}`}
        />
        <Metric label="Missing" value={`${missingBalances} ${missingBalances === 1 ? "account" : "accounts"}`} />
      </div>
      <a className="button-link button-link-secondary balance-review-link" href="#/accounts">
        Review account balances
      </a>
    </article>
  );
}

function AccountPerformanceCard({
  accounts,
  dashboard,
}: {
  accounts: AccountsResponse | null;
  dashboard: DashboardSummary | null;
}) {
  const total = accountNetWorth(accounts);
  const series = performanceSeries(total || Number(dashboard?.cash_on_hand ?? 0));
  const chartPath = areaPath(series, 920, 210);
  const linePath = linePathFromSeries(series, 920, 210);
  const change = series.at(-1)! - series[0];
  const changePercent = series[0] === 0 ? 0 : (change / Math.abs(series[0])) * 100;

  return (
    <article className="card report-hero-card account-performance">
      <div className="report-card-toolbar">
        <CardHeader
          title="Net Worth Performance"
          subtitle={`${accounts?.accounts.length ?? 0} accounts · 1 month change`}
        />
        <div className="segmented-control" aria-label="Account chart controls">
          <span>Net worth performance</span>
          <span>1 month</span>
        </div>
      </div>
      <div className="net-worth-headline">
        <span>Net worth</span>
        <strong>{money(String(total))}</strong>
        <small className={change >= 0 ? "positive-text" : "negative-text"}>
          {change >= 0 ? "↗" : "↘"} {money(String(change))} ({changePercent.toFixed(1)}%)
        </small>
      </div>
      <svg className="performance-chart" viewBox="0 0 920 250" role="img" aria-label="Net worth performance chart">
        <defs>
          <linearGradient id="performanceFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2aaed1" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2aaed1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <g className="chart-lines">
          {[40, 82, 124, 166, 208].map((y) => (
            <line key={y} x1="34" x2="900" y1={y} y2={y} />
          ))}
        </g>
        <path d={chartPath} fill="url(#performanceFill)" />
        <path className="performance-line" d={linePath} />
        {series.map((value, index) => (
          <circle
            className="performance-point"
            cx={34 + (index / (series.length - 1)) * 866}
            cy={chartY(value, series, 210)}
            key={`${value}-${index}`}
            r={index === series.length - 1 ? 4 : 0}
          />
        ))}
      </svg>
    </article>
  );
}

function AssetSummaryCard({ accounts }: { accounts: AccountsResponse | null }) {
  const buckets = accountBuckets(accounts);
  const assetTotal = buckets.assets.reduce((sum, bucket) => sum + bucket.value, 0);
  const liabilityTotal = buckets.liabilities.reduce((sum, bucket) => sum + bucket.value, 0);
  const colors = ["#2aaed1", "#3aa66d", "#8d65d8", "#ff8f3d", "#d43c95"];

  return (
    <article className="card asset-summary-card">
      <CardHeader title="Summary" subtitle="Assets and liabilities" />
      <div className="stacked-bar" aria-label="Asset allocation">
        {buckets.assets.map((bucket, index) => (
          <span
            key={bucket.label}
            style={{
              background: colors[index % colors.length],
              width: `${assetTotal ? Math.max(5, (bucket.value / assetTotal) * 100) : 0}%`,
            }}
          />
        ))}
      </div>
      <CompactLegend
        rows={buckets.assets.map((bucket, index) => ({
          color: colors[index % colors.length],
          label: bucket.label,
          value: money(String(bucket.value)),
        }))}
        title={`Assets ${money(String(assetTotal))}`}
      />
      <div className="section-divider" />
      <CompactLegend
        rows={buckets.liabilities.map((bucket, index) => ({
          color: colors[(index + 3) % colors.length],
          label: bucket.label,
          value: money(String(bucket.value)),
        }))}
        title={`Liabilities ${money(String(liabilityTotal))}`}
      />
    </article>
  );
}

function ReportMetricStrip({ insights }: { insights: InsightsResponse | null }) {
  const totals = reportTotals(insights);
  const savingsRate = totals.income > 0 ? (totals.net / totals.income) * 100 : 0;
  return (
    <div className="report-metric-strip" aria-label="Report totals">
      <ReportMetric label="Total income" tone="positive" value={money(String(totals.income))} />
      <ReportMetric label="Total expenses" tone="negative" value={money(String(totals.expenses))} />
      <ReportMetric label="Total net income" value={money(String(totals.net))} />
      <ReportMetric label="Savings rate" value={`${savingsRate.toFixed(1)}%`} />
    </div>
  );
}

function ReportMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "negative" | "positive";
  value: string;
}) {
  return (
    <div className={`report-metric ${tone ? `report-metric-${tone}` : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SankeyReportCard({
  insights,
  periodLabel,
}: {
  insights: InsightsResponse | null;
  periodLabel?: string;
}) {
  const [reportView, setReportView] = useState<"cash-flow" | "income" | "spending">("cash-flow");
  const [groupBy, setGroupBy] = useState<"category" | "merchant">("category");
  const totals = reportTotals(insights);
  const groups = reportGroups(insights, groupBy, reportView);
  const savings = Math.max(0, totals.net);
  const sankey = buildSankeyGeometry({
    expenses: totals.expenses,
    groups,
    income: totals.income,
    savings,
    view: reportView,
  });

  return (
    <article className="card sankey-card">
      <div className="report-card-toolbar">
        <CardHeader title={titleCase(reportView)} subtitle={periodLabel ?? "Selected date range"} />
        <div className="report-controls" aria-label="Report chart controls">
          <div className="report-tabs" role="tablist" aria-label="Report type">
            {(["cash-flow", "spending", "income"] as const).map((view) => (
              <button
                aria-selected={reportView === view}
                className={reportView === view ? "active" : ""}
                key={view}
                onClick={() => setReportView(view)}
                role="tab"
                type="button"
              >
                {titleCase(view)}
              </button>
            ))}
          </div>
          <select
            aria-label="Report grouping"
            onChange={(event) => setGroupBy(event.target.value as "category" | "merchant")}
            value={groupBy}
          >
            <option value="category">By category & group</option>
            <option value="merchant">By top merchants</option>
          </select>
        </div>
      </div>
      <div className="sankey-stage">
        <svg className="sankey-svg" viewBox="0 0 1180 520" role="img" aria-label={`${titleCase(reportView)} Sankey report`}>
          <defs>
            <linearGradient id="sankeyIncome" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#bfeaf4" stopOpacity="0.94" />
              <stop offset="48%" stopColor="#d4eee0" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f5efb9" stopOpacity="0.84" />
            </linearGradient>
          </defs>
          {sankey.flows.map((flow) => (
            <path
              className="sankey-flow"
              d={flow.path}
              key={flow.id}
              style={{ opacity: flow.opacity, stroke: flow.color, strokeWidth: flow.width }}
            />
          ))}
          {sankey.nodes.map((node) => (
            <g key={node.id}>
              <rect
                className="sankey-node"
                fill={node.color}
                height={node.height}
                rx="0"
                width="18"
                x={node.x}
                y={node.y}
              />
              <text
                className="sankey-label"
                textAnchor={node.anchor}
                x={node.labelX}
                y={node.labelY}
              >
                {node.label}
              </text>
              <text
                className="sankey-value"
                textAnchor={node.anchor}
                x={node.labelX}
                y={node.labelY + 22}
              >
                {money(String(node.value))}{node.percent ? ` (${node.percent})` : ""}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flow-footnote">
        <span>Income</span>
        <b>{money(String(totals.income))}</b>
        <span>Expenses</span>
        <b>{money(String(totals.expenses))}</b>
        <span>Net</span>
        <b className={totals.net >= 0 ? "positive-text" : "negative-text"}>{money(String(totals.net))}</b>
      </div>
    </article>
  );
}

function UpcomingCard({
  includeCandidates,
  limit = 6,
  onBillPaid,
  periodKind = "future",
  periodLabel,
  query,
  upcoming,
}: {
  includeCandidates: boolean;
  limit?: number;
  onBillPaid?: (instanceId: string, amount: string) => Promise<void>;
  periodKind?: DateWindowKind;
  periodLabel?: string;
  query: string;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const candidateMode = includeCandidates ? "Candidate bills included" : "Confirmed bills only";
  const title = billCardTitle(periodKind, periodLabel);
  const rows = filterByQuery(upcoming?.items ?? [], query, (item) =>
    `${item.commitment_name} ${item.commitment_type} ${item.commitment_status}`,
  ).slice(0, limit);

  return (
    <article className="card">
      <CardHeader
        title={title}
        subtitle={
          upcoming
            ? `${periodLabel ?? `${upcoming.start_date} to ${upcoming.end_date}`} · ${candidateMode} · ${upcoming.total_count} items · ${money(upcoming.expected_total)}`
            : `${periodLabel ?? "Next 30 days"} · ${candidateMode}`
        }
      />
      <CompactList
        empty="No upcoming commitments found."
        rows={rows.map((item) => ({
          title: item.commitment_name,
          meta: `${item.due_date} · ${item.commitment_status} · ${item.status}`,
          amount: money(item.expected_amount),
          action:
            onBillPaid && item.status !== "paid"
              ? (
                  <button
                    onClick={() => void onBillPaid(item.id, item.expected_amount)}
                    type="button"
                  >
                    Paid
                  </button>
                )
              : undefined,
        }))}
      />
    </article>
  );
}

function CalendarPlannerCard({
  includeCandidates,
  onBillPaid,
  periodKind,
  periodLabel,
  query,
  upcoming,
}: {
  includeCandidates: boolean;
  onBillPaid: (instanceId: string, amount: string) => Promise<void>;
  periodKind: DateWindowKind;
  periodLabel: string;
  query: string;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const candidateMode = includeCandidates ? "Candidate bills included" : "Confirmed bills only";
  const title = billCardTitle(periodKind, periodLabel);
  const rows = filterByQuery(upcoming?.items ?? [], query, (item) =>
    `${item.commitment_name} ${item.commitment_type} ${item.commitment_status}`,
  );
  const calendarDays = buildCalendarDays(upcoming?.start_date, upcoming?.end_date, rows);
  const daysWithPlans = calendarDays.filter((day) => day.inPeriod && day.items.length > 0).length;
  const largestDay = calendarDays
    .filter((day) => day.inPeriod)
    .reduce<CalendarDayModel>(
      (largest, day) => (day.total > largest.total ? day : largest),
      { date: "", inPeriod: false, items: [], total: 0 },
    );

  return (
    <article className="card calendar-planner-card">
      <CardHeader
        title={title}
        subtitle={
          upcoming
            ? `${periodLabel} · ${candidateMode} · ${upcoming.total_count} items · ${money(upcoming.expected_total)}`
            : `${periodLabel} · ${candidateMode}`
        }
      />
      <div className="calendar-summary-strip" aria-label="Calendar summary">
        <Metric label="Planned total" value={upcoming ? money(upcoming.expected_total) : "-"} />
        <Metric label="Planned days" value={daysWithPlans} />
        <Metric label="Busiest day" value={largestDay.date ? `${formatShortDay(largestDay.date)} · ${money(String(largestDay.total))}` : "-"} />
      </div>
      <div className="calendar-grid-shell">
        <div className="calendar-weekdays" aria-hidden="true">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid" aria-label={`${periodLabel} bill calendar`}>
          {calendarDays.map((day) => (
            <div
              className={`calendar-day ${day.inPeriod ? "" : "calendar-day-muted"} ${day.items.length > 0 ? "has-plans" : ""}`}
              key={day.date}
            >
              <div className="calendar-day-head">
                <span>{dayNumber(day.date)}</span>
                {day.total > 0 ? <b>{money(String(day.total))}</b> : null}
              </div>
              <div className="calendar-plan-list">
                {day.items.slice(0, 3).map((item) => (
                  <span className={`calendar-plan calendar-plan-${calendarPlanTone(item)}`} key={item.id}>
                    <small>{item.commitment_name}</small>
                    <b>{money(item.expected_amount)}</b>
                  </span>
                ))}
                {day.items.length > 3 ? <em>+{day.items.length - 3} more</em> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <CollapsibleBlock
        meta={`${rows.length} ${rows.length === 1 ? "item" : "items"} · ${upcoming ? money(upcoming.expected_total) : "-"}`}
        title={billListTitle(periodKind)}
      >
        <CompactList
          empty="No bills or planned commitments found for this range."
          rows={rows.map((item) => ({
            title: item.commitment_name,
            meta: `${item.due_date} · ${titleCase(item.commitment_type)} · ${titleCase(item.commitment_status)} · ${titleCase(item.status)}`,
            amount: money(item.expected_amount),
            action:
              item.status !== "paid"
                ? (
                    <button
                      onClick={() => void onBillPaid(item.id, item.expected_amount)}
                      type="button"
                    >
                      Paid
                    </button>
                  )
                : undefined,
          }))}
        />
      </CollapsibleBlock>
    </article>
  );
}

function DecisionQueueCard({
  busy,
  compact = false,
  decisions,
  limit = 5,
  query,
  onDecisionAction,
}: {
  busy: boolean;
  compact?: boolean;
  decisions: DecisionQueueResponse | null;
  limit?: number;
  query: string;
  onDecisionAction: (
    action: "confirm" | "reject",
    decisionType: string,
    decisionId: string,
  ) => Promise<void>;
}) {
  const rows = filterByQuery(decisions?.decisions ?? [], query, (decision) =>
    `${decision.title} ${decision.detail} ${decision.amount} ${decision.decision_type}`,
  ).slice(0, limit);
  const visibleCount = rows.length;
  const decisionCounts = countBy(decisions?.decisions ?? [], (decision) => decision.decision_type);
  const summary = Object.keys(decisionCounts).length > 0 ? (
    <div className="decision-summary" aria-label="Decision queue summary">
      {Object.entries(decisionCounts).map(([type, count]) => (
        <span className="decision-summary-pill" key={type}>
          <b>{count}</b>
          {decisionTypeLabel(type)}
        </span>
      ))}
    </div>
  ) : null;

  if (compact) {
    return (
      <article className="card decision-card decision-card-compact">
        <CardHeader
          title="Decision Queue"
          subtitle={
            decisions
              ? `${visibleCount} priority checks · ${decisions.total_count} open`
              : "High-impact checks"
          }
        />
        {summary}
        <CompactList
          empty={
            decisions?.total_count === 0
              ? "Nothing needs review right now."
              : "No decisions match this search."
          }
          rows={rows.map((decision) => ({
            title: decision.title,
            meta: `${decisionTypeLabel(decision.decision_type)} · ${decision.detail}`,
            amount: money(decision.amount),
          }))}
        />
        {decisions && decisions.total_count > visibleCount ? (
          <a className="button-link button-link-secondary compact-card-link" href="#/decision-queue">
            Review all {decisions.total_count} decisions
          </a>
        ) : null}
      </article>
    );
  }

  return (
    <article className="card decision-card">
      <CardHeader
        title="Decision Queue"
        subtitle={
          decisions
            ? `${visibleCount} shown · ${decisions.total_count} open decisions`
            : "High-impact checks"
        }
      />
      {summary}
      {rows.length === 0 ? (
        <p className="empty-copy">
          {decisions?.total_count === 0
            ? "Nothing needs review right now."
            : "No decisions match this search."}
        </p>
      ) : (
        <div className="decision-list" role="table" aria-label="Decision queue review table">
          <div className="decision-table-header" role="row">
            <span>Decision</span>
            <span>Why it matters</span>
            <span>Amount</span>
            <span>Actions</span>
          </div>
          {rows.map((decision) => (
            <div className="decision-row" key={`${decision.decision_type}-${decision.id}`} role="row">
              <div className="decision-main" role="cell">
                <span className="decision-type">{decisionTypeLabel(decision.decision_type)}</span>
                <strong>{decision.title}</strong>
                <small>{decision.detail}</small>
              </div>
              <div className="decision-reason" role="cell">
                <span>{decision.reason}</span>
                <small>{titleCase(decision.status)}</small>
              </div>
              <b className="amount decision-amount" role="cell">{money(decision.amount)}</b>
              <div className="decision-actions" role="cell">
                <button
                  disabled={busy}
                  onClick={() => void onDecisionAction("confirm", decision.decision_type, decision.id)}
                  type="button"
                >
                  Confirm
                </button>
                <button
                  disabled={busy}
                  onClick={() => void onDecisionAction("reject", decision.decision_type, decision.id)}
                  type="button"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function TransactionsCard({
  accounts,
  limit = 6,
  onTransactionUpdate,
  query,
  setTransactionFilters,
  transactions,
  transactionFilters,
}: {
  accounts: AccountsResponse | null;
  limit?: number;
  onTransactionUpdate?: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  query: string;
  setTransactionFilters?: (filters: TransactionFilterState) => void;
  transactions: TransactionsResponse | null;
  transactionFilters?: TransactionFilterState;
}) {
  const rows = filterByQuery(transactions?.transactions ?? [], query, (transaction) =>
    `${transaction.merchant_name} ${transaction.description} ${transaction.provider} ${transaction.source_category}`,
  ).slice(0, limit);
  return (
    <article className="card">
      <CardHeader
        title="Transactions"
        subtitle={transactions ? `${transactions.total_count} non-transfer rows` : "Most recent"}
      />
      {transactionFilters && setTransactionFilters ? (
        <TransactionFilterBar
          accounts={accounts}
          filters={transactionFilters}
          onChange={setTransactionFilters}
        />
      ) : null}
      {rows.length === 0 ? (
        <p className="empty-copy">No transactions yet.</p>
      ) : (
        <div className="transaction-table" role="table" aria-label="Transaction ledger">
          <div className="transaction-table-header" role="row">
            <span>Merchant</span>
            <span>Date</span>
            <span>Account</span>
            <span>Group</span>
            <span>Amount</span>
            <span>Review</span>
          </div>
          {rows.map((transaction) => (
            <TransactionReviewRow
              key={transaction.id}
              onTransactionUpdate={onTransactionUpdate}
              transaction={transaction}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function SystemStatusCard({
  health,
  onHealthCheck,
}: {
  health: ApiHealthState;
  onHealthCheck: () => Promise<void>;
}) {
  return (
    <article className="card system-status-card">
      <CardHeader
        title="System Status"
        subtitle="Local services that need to be running for the app to work."
      />
      <div className="status-grid">
        <div className={`status-panel status-panel-${health.status}`}>
          <span className="system-badge-dot" />
          <div>
            <strong>Backend API</strong>
            <small>{health.message}</small>
            <code>{API_BASE}</code>
          </div>
        </div>
        <div className="status-panel status-panel-online">
          <span className="system-badge-dot" />
          <div>
            <strong>Frontend</strong>
            <small>Vite app is running in this browser.</small>
            <code>{window.location.origin}</code>
          </div>
        </div>
      </div>
      <div className="command-card">
        <strong>Start the full local stack</strong>
        <p>Use this from the project root so Postgres, FastAPI, and Vite come up together.</p>
        <code>./scripts/dev-local.sh</code>
      </div>
      <div className="command-card">
        <strong>Start backend only</strong>
        <p>If the page says API offline, this is the missing service.</p>
        <code>uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8025</code>
      </div>
      <div className="settings-actions">
        <button className="settings-check-button" onClick={() => void onHealthCheck()} type="button">
          Check API again
        </button>
      </div>
      {health.checkedAt ? <p className="fine-print">Last checked at {health.checkedAt}.</p> : null}
    </article>
  );
}

function GoalsCard({ planning }: { planning: PlanningOverview | null }) {
  return (
    <article className="card planning-card">
      <CardHeader
        title="Goals"
        subtitle={planning ? `${planning.goals.length} active planning goals` : "Planning overview"}
      />
      <CollapsibleBlock meta={`${planning?.goals.length ?? 0} goals`} title="Goal progress">
        <div className="goal-list">
          {(planning?.goals ?? []).map((goal) => (
            <div className="goal-row" key={goal.id}>
              <div className="goal-row-header">
                <div>
                  <strong>{goal.name}</strong>
                  <small>{goal.next_action}</small>
                </div>
                <span className={`status-pill status-${goal.status}`}>{titleCase(goal.status)}</span>
              </div>
              <div className="progress-track" aria-label={`${goal.name} progress`}>
                <span style={{ width: `${goal.progress_percent}%` }} />
              </div>
              <div className="split-metrics">
                <Metric label="Current" value={money(goal.current_amount)} />
                <Metric label="Target" value={money(goal.target_amount)} />
                <Metric label="Monthly set aside" value={money(goal.monthly_contribution)} />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleBlock>
      {(planning?.goals.length ?? 0) === 0 ? (
        <p className="empty-copy">Import data and enter balances to derive goals.</p>
      ) : null}
      <div className="card-actions">
        <a className="button-link" href="#/cash-flow">Open cash flow</a>
        <a className="button-link button-link-secondary" href="#/monthly-review">Monthly review</a>
      </div>
    </article>
  );
}

function SinkingFundsCard({ planning }: { planning: PlanningOverview | null }) {
  return (
    <article className="card planning-card">
      <CardHeader
        title="Sinking Funds"
        subtitle="Annual, quarterly, and custom bills converted into monthly set-asides."
      />
      <CollapsibleBlock meta={`${planning?.sinking_funds.length ?? 0} funds`} title="Detected funds">
        <CompactList
          empty="No non-monthly commitments detected yet."
          rows={(planning?.sinking_funds ?? []).map((fund) => ({
            title: fund.name,
            meta: `${titleCase(fund.frequency)} · due ${fund.due_date ?? "unknown"} · ${titleCase(fund.status)}`,
            amount: `${money(fund.monthly_set_aside)}/mo`,
            action: <a className="button-link button-link-small" href="#/recurring">Review</a>,
          }))}
        />
      </CollapsibleBlock>
    </article>
  );
}

function MonthlyReviewCard({ planning }: { planning: PlanningOverview | null }) {
  const review = planning?.monthly_review;
  return (
    <article className="card planning-card">
      <CardHeader
        title="Monthly Review"
        subtitle={review ? `${review.start_date} to ${review.end_date}` : "Closeout checklist"}
      />
      <div className="review-hero">
        <span>{review?.headline ?? "Review pending"}</span>
        <strong>{review ? money(review.net_total) : "-"}</strong>
        <p>Net position after income and outflows in the selected review period.</p>
      </div>
      <div className="readiness-grid">
        <Metric label="Income" value={review ? money(review.income_total) : "-"} />
        <Metric label="Outflows" value={review ? money(review.outflow_total) : "-"} />
        <Metric label="Open decisions" value={review?.decision_count ?? "-"} />
        <Metric label="Reviewed" value={review?.reviewed_count ?? "-"} />
        <Metric label="Unreviewed" value={review?.unreviewed_count ?? "-"} />
        <Metric label="Saved filters" value={planning?.saved_filters.length ?? "-"} />
      </div>
      <CollapsibleBlock meta={`${review?.next_actions.length ?? 1} actions`} title="Review actions">
        <div className="action-list" aria-label="Monthly review actions">
          {(review?.next_actions ?? ["Import transactions to start the review."]).map((action) => (
            <div className="action-row" key={action}>
              <span className="status-dot" />
              <strong>{action}</strong>
            </div>
          ))}
        </div>
      </CollapsibleBlock>
      <div className="card-actions">
        <a className="button-link" href="#/transactions?reviewed=unreviewed">Review transactions</a>
        <a className="button-link button-link-secondary" href="#/decision-queue">Decision queue</a>
      </div>
    </article>
  );
}

function SubscriptionsCard({ planning }: { planning: PlanningOverview | null }) {
  return (
    <article className="card planning-card">
      <CardHeader
        title="Subscriptions"
        subtitle="Cancellation, renegotiation, and confirmation prompts."
      />
      <CollapsibleBlock meta={`${planning?.subscriptions.length ?? 0} subscriptions`} title="Review queue">
        <CompactList
          empty="No subscription-style commitments detected yet."
          rows={(planning?.subscriptions ?? []).map((subscription) => ({
            title: subscription.name,
            meta: `${titleCase(subscription.frequency)} · next ${subscription.next_due_date ?? "unknown"} · ${subscription.prompt}`,
            amount: money(subscription.expected_amount),
            action: <a className="button-link button-link-small" href="#/recurring">Review</a>,
          }))}
        />
      </CollapsibleBlock>
    </article>
  );
}

function SavedFiltersCard({ planning }: { planning: PlanningOverview | null }) {
  return (
    <article className="card planning-card">
      <CardHeader title="Saved Filters" subtitle="Reusable report and transaction drilldowns." />
      <CollapsibleBlock meta={`${planning?.saved_filters.length ?? 0} filters`} title="Saved shortcuts">
        <div className="saved-filter-grid">
          {(planning?.saved_filters ?? []).map((filter) => (
            <a className="saved-filter-card" href={savedFilterHref(filter)} key={filter.id}>
              <strong>{filter.label}</strong>
              <small>{filter.description}</small>
            </a>
          ))}
        </div>
      </CollapsibleBlock>
      {(planning?.saved_filters.length ?? 0) === 0 ? (
        <p className="empty-copy">Saved planning filters appear after the API loads.</p>
      ) : null}
    </article>
  );
}

function ImportFreshnessCard({ planning }: { planning: PlanningOverview | null }) {
  const freshness = planning?.import_freshness;
  return (
    <article className="card planning-card">
      <CardHeader title="Import Freshness" subtitle="How safe the current data is for planning." />
      <div className={`freshness-panel freshness-${freshness?.status ?? "unknown"}`}>
        <span className="system-badge-dot" />
        <div>
          <strong>{freshness ? titleCase(freshness.status) : "Checking"}</strong>
          <small>{freshness?.message ?? "Waiting for planning API."}</small>
        </div>
      </div>
      <div className="split-metrics">
        <Metric label="Latest import" value={freshness?.latest_import_date ?? "-"} />
        <Metric label="Latest transaction" value={freshness?.latest_transaction_date ?? "-"} />
        <Metric label="Days old" value={freshness?.days_since_latest_transaction ?? "-"} />
      </div>
    </article>
  );
}

function StaleCommitmentsCard({ planning }: { planning: PlanningOverview | null }) {
  return (
    <article className="card planning-card">
      <CardHeader title="Stale Commitments" subtitle="Recurring items whose due date has passed." />
      <CollapsibleBlock meta={`${planning?.stale_commitments.length ?? 0} stale`} title="Needs review">
        <CompactList
          empty="No stale commitments need review."
          rows={(planning?.stale_commitments ?? []).map((commitment) => ({
            title: commitment.name,
            meta: `${commitment.next_due_date ?? "No due date"} · ${titleCase(commitment.status)} · ${commitment.reason}`,
            amount: money(commitment.expected_amount),
            action: <a className="button-link button-link-small" href="#/recurring">Fix</a>,
          }))}
        />
      </CollapsibleBlock>
    </article>
  );
}

function TransactionReviewRow({
  onTransactionUpdate,
  transaction,
}: {
  onTransactionUpdate?: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  transaction: TransactionsResponse["transactions"][number];
}) {
  const [transactionType, setTransactionType] = useState(transaction.transaction_type);
  return (
    <div className="transaction-row" role="row">
      <div className="transaction-merchant" role="cell">
        <strong>{transaction.merchant_name || transaction.description}</strong>
        <small>{transaction.description || transaction.source_category}</small>
      </div>
      <span className="transaction-date" role="cell">{transaction.date}</span>
      <span className="transaction-account" role="cell">
        <strong>{transaction.account_name}</strong>
        <small>{transaction.provider}</small>
      </span>
      <span className="transaction-group" role="cell">{titleCase(transaction.normalized_group)}</span>
      <span className="amount transaction-amount" role="cell">{money(transaction.amount)}</span>
      {onTransactionUpdate ? (
        <div className="transaction-review" role="cell">
          <select
            aria-label={`Review type for ${transaction.merchant_name || transaction.description}`}
            onChange={(event) => setTransactionType(event.target.value)}
            value={transactionType}
          >
            <option value="needs_review">Needs review</option>
            <option value="spending">Expense</option>
            <option value="income">Income</option>
            <option value="debt_payment">Debt payment</option>
            <option value="internal_transfer">Internal transfer</option>
            <option value="refund">Refund</option>
            <option value="ignored">Ignored</option>
          </select>
          <button
            onClick={() =>
              void onTransactionUpdate(transaction.id, {
                transaction_type: transactionType,
                reviewed: true,
              })
            }
            type="button"
          >
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AccountsCard({
  accounts,
  busy,
  limit = 6,
  onAccountBalanceUpdate,
  query,
}: {
  accounts: AccountsResponse | null;
  busy: boolean;
  limit?: number;
  onAccountBalanceUpdate: (
    accountId: string,
    balance: string,
    accountType: string,
  ) => Promise<void>;
  query: string;
}) {
  const rows = filterByQuery(accounts?.accounts ?? [], query, (account) =>
    `${account.display_name} ${account.provider} ${account.account_type}`,
  ).slice(0, limit);
  const groupedRows = accountGroups(rows);
  return (
    <article className="card">
      <CardHeader title="Accounts" subtitle={accounts ? `${accounts.accounts.length} detected` : "Connect data"} />
      {rows.length === 0 ? (
        <p className="empty-copy">Commit an import to see accounts.</p>
      ) : (
        <div className="account-group-list">
          {groupedRows.map((group) => (
            <AccountGroupSection
              busy={busy}
              group={group}
              key={group.id}
              onAccountBalanceUpdate={onAccountBalanceUpdate}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function AccountGroupSection({
  busy,
  group,
  onAccountBalanceUpdate,
}: {
  busy: boolean;
  group: AccountGroup;
  onAccountBalanceUpdate: (
    accountId: string,
    balance: string,
    accountType: string,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(group.defaultOpen);
  const changeClass = group.monthChange >= 0 ? "positive-text" : "negative-text";

  return (
    <section className="account-group-section">
      <button
        aria-expanded={open}
        className="account-group-header"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={`group-chevron ${open ? "open" : ""}`} aria-hidden="true" />
        <span className="account-group-title">
          <strong>{group.label}</strong>
          <small className={changeClass}>
            {group.monthChange >= 0 ? "↗" : "↘"} {money(String(Math.abs(group.monthChange)))} month change
          </small>
        </span>
        <strong className="account-group-total">{money(String(group.total))}</strong>
      </button>
      {open ? (
        <div className="account-review-list">
          {group.accounts.map((account) => (
            <AccountReviewRow
              account={account}
              busy={busy}
              key={account.id}
              onAccountBalanceUpdate={onAccountBalanceUpdate}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AccountReviewRow({
  account,
  busy,
  onAccountBalanceUpdate,
}: {
  account: AccountsResponse["accounts"][number];
  busy: boolean;
  onAccountBalanceUpdate: (
    accountId: string,
    balance: string,
    accountType: string,
  ) => Promise<void>;
}) {
  const [balance, setBalance] = useState(account.current_balance ?? "");
  const [accountType, setAccountType] = useState(account.account_type);

  return (
    <div className="account-review-row">
      <div>
        <strong>{account.display_name}</strong>
        <small>
          {account.provider} · imported net {money(account.net_total)}
        </small>
      </div>
      <select
        aria-label={`Type for ${account.display_name}`}
        onChange={(event) => setAccountType(event.target.value)}
        value={accountType}
      >
        <option value="unknown">Unknown</option>
        <option value="current">Current</option>
        <option value="savings">Savings</option>
        <option value="pot">Pot</option>
        <option value="credit_card">Credit card</option>
        <option value="loan">Loan</option>
        <option value="bnpl">BNPL</option>
      </select>
      <input
        aria-label={`Balance for ${account.display_name}`}
        inputMode="decimal"
        onChange={(event) => setBalance(event.target.value)}
        placeholder="Current balance"
        value={balance}
      />
      <button
        disabled={busy || !balance.trim()}
        onClick={() => void onAccountBalanceUpdate(account.id, balance, accountType)}
        type="button"
      >
        Save
      </button>
    </div>
  );
}

function RecurringCard({
  commitments,
  limit = 6,
  onCommitmentUpdate,
  query,
}: {
  commitments: CommitmentsResponse | null;
  limit?: number;
  onCommitmentUpdate?: (commitmentId: string, status: string) => Promise<void>;
  query: string;
}) {
  const rows = filterByQuery(commitments?.commitments ?? [], query, (commitment) =>
    `${commitment.name} ${commitment.frequency} ${commitment.commitment_type}`,
  ).slice(0, limit);
  return (
    <article className="card">
      <CardHeader
        title="Recurring"
        subtitle={commitments ? `${commitments.total_count} candidates` : "No upcoming transactions"}
      />
      {rows.length === 0 ? (
        <p className="empty-copy">Detect bills to populate recurring candidates.</p>
      ) : (
        <CollapsibleBlock meta={`${rows.length} shown`} title="Recurring candidates">
          <div className="compact-list">
            {rows.map((commitment) => (
              <div className="compact-row" key={commitment.id}>
                <div>
                  <strong>{commitment.name}</strong>
                  <small>
                    {commitment.frequency} · next {commitment.next_due_date ?? "unknown"} · {commitment.status}
                  </small>
                </div>
                <span className="amount">{money(commitment.expected_amount)}</span>
                {onCommitmentUpdate && commitment.status === "candidate" ? (
                  <div className="row-actions">
                    <button
                      onClick={() => void onCommitmentUpdate(commitment.id, "confirmed")}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => void onCommitmentUpdate(commitment.id, "rejected")}
                      type="button"
                    >
                      Ignore
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CollapsibleBlock>
      )}
    </article>
  );
}

function CashflowCard({
  dashboard,
  forecast,
  includeCandidates,
  preview,
  transactions,
  transferResult,
  commitmentResult,
  commitments,
  decisions,
  upcoming,
}: {
  dashboard: DashboardSummary | null;
  forecast: ForecastResponse | null;
  includeCandidates: boolean;
  preview: ImportPreview | null;
  transactions: TransactionsResponse | null;
  transferResult: TransferDetectionResult | null;
  commitmentResult: CommitmentDetectionResult | null;
  commitments: CommitmentsResponse | null;
  decisions: DecisionQueueResponse | null;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const forecastPoints =
    forecast?.points ??
    upcoming?.items.map((item) => ({
      date: item.due_date,
      label: item.commitment_name,
      kind: item.commitment_type,
      amount: item.expected_amount,
      projected_balance: null,
      confidence: item.commitment_status,
    })) ??
    [];
  const candidateMode = includeCandidates ? "Candidate bills included" : "Confirmed bills only";

  return (
    <article className="card forecast-card">
      <CardHeader title="Cash Flow Readiness" subtitle={`What is usable for the real dashboard · ${candidateMode}`} />
      <div className="readiness-grid">
        <Metric label="Starting cash" value={forecast?.starting_balance ? money(forecast.starting_balance) : "-"} />
        <Metric label="Ending cash" value={forecast?.projected_ending_balance ? money(forecast.projected_ending_balance) : "-"} />
        <Metric label="Lowest point" value={forecast?.lowest_projected_balance ? money(forecast.lowest_projected_balance) : "-"} />
        <Metric
          label="Confirmed due"
          value={dashboard ? money(dashboard.upcoming_confirmed_total) : "-"}
        />
        <Metric label="Decisions open" value={decisions?.total_count ?? "-"} />
        <Metric
          label="Candidate due"
          value={
            forecast
              ? money(forecast.candidate_commitments_total)
              : dashboard
                ? money(dashboard.upcoming_candidate_total)
                : "-"
          }
        />
      </div>
      <CollapsibleBlock meta={`${forecastPoints.length} points`} title="Forecast timeline">
        <div className="forecast-list">
          {forecastPoints.slice(0, 6).map((point) => (
            <div className="compact-row" key={`${point.date}-${point.label}`}>
              <div>
                <strong>{point.label}</strong>
                <small>{point.date} · {point.kind} · {point.confidence}</small>
              </div>
              <span className="amount">{money(point.amount)}</span>
            </div>
          ))}
        </div>
      </CollapsibleBlock>
      <p className="fine-print">
        {includeCandidates
          ? "Confirmed commitments affect projected balances; candidates are shown separately until reviewed."
          : "Only confirmed commitments are included; candidate bills are hidden from this planning view."}
        {preview || transactions || transferResult || commitmentResult || commitments ? "" : " Import data to begin."}
      </p>
    </article>
  );
}

function TransactionFilterBar({
  accounts,
  filters,
  onChange,
}: {
  accounts: AccountsResponse | null;
  filters: TransactionFilterState;
  onChange: (filters: TransactionFilterState) => void;
}) {
  return (
    <div className="filter-bar" aria-label="Transaction filters">
      <select
        aria-label="Account filter"
        onChange={(event) => onChange({ ...filters, accountId: event.target.value })}
        value={filters.accountId}
      >
        <option value="">All accounts</option>
        {(accounts?.accounts ?? []).map((account) => (
          <option key={account.id} value={account.id}>
            {account.display_name}
          </option>
        ))}
      </select>
      <select
        aria-label="Category group filter"
        onChange={(event) => onChange({ ...filters, normalizedGroup: event.target.value })}
        value={filters.normalizedGroup}
      >
        <option value="">All groups</option>
        {transactionGroups.map((group) => (
          <option key={group} value={group}>
            {titleCase(group)}
          </option>
        ))}
      </select>
      <select
        aria-label="Transaction type filter"
        onChange={(event) => onChange({ ...filters, transactionType: event.target.value })}
        value={filters.transactionType}
      >
        <option value="">All types</option>
        {transactionTypes.map((type) => (
          <option key={type} value={type}>
            {titleCase(type)}
          </option>
        ))}
      </select>
      <select
        aria-label="Review status filter"
        onChange={(event) =>
          onChange({ ...filters, reviewed: event.target.value as TransactionFilterState["reviewed"] })
        }
        value={filters.reviewed}
      >
        <option value="all">All review states</option>
        <option value="unreviewed">Unreviewed</option>
        <option value="reviewed">Reviewed</option>
      </select>
      <select
        aria-label="Posted status filter"
        onChange={(event) => onChange({ ...filters, status: event.target.value })}
        value={filters.status}
      >
        <option value="">All statuses</option>
        <option value="posted">Posted</option>
        <option value="pending">Pending</option>
      </select>
      <button
        onClick={() =>
          onChange({
            accountId: "",
            normalizedGroup: "",
            reviewed: "all",
            status: "",
            transactionType: "",
          })
        }
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}

function InsightsCard({
  insights,
  periodLabel,
}: {
  insights: InsightsResponse | null;
  periodLabel?: string;
}) {
  return (
    <article className="card">
      <CardHeader
        title="Insights"
        subtitle={
          insights?.start_date && insights?.end_date
            ? periodLabel ?? `${insights.start_date} to ${insights.end_date}`
            : "Category groups"
        }
      />
      <CollapsibleBlock meta={`${insights?.category_groups.length ?? 0} groups`} title="Category groups">
        <CompactList
          empty="Insights appear after import."
          rows={(insights?.category_groups ?? []).slice(0, 5).map((group) => ({
            title: titleCase(group.group),
            meta: `${group.transaction_count} transactions · outflow ${money(group.outflow_total)}`,
            amount: money(group.net_total),
          }))}
        />
      </CollapsibleBlock>
      {(insights?.top_merchants.length ?? 0) > 0 ? (
        <CollapsibleBlock meta={`${insights?.top_merchants.length ?? 0} merchants`} title="Top merchants">
          <CompactList
            empty="No merchant spend in range."
            rows={(insights?.top_merchants ?? []).slice(0, 5).map((merchant) => ({
              title: merchant.merchant_name,
              meta: `${merchant.transaction_count} transactions`,
              amount: money(merchant.outflow_total),
            }))}
          />
        </CollapsibleBlock>
      ) : null}
    </article>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="card-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function CompactList({
  rows,
  empty,
}: {
  rows: Array<{ title: string; meta: string; amount: string; action?: ReactNode }>;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="empty-copy">{empty}</p>;
  }

  return (
    <div className="compact-list">
      {rows.map((row) => (
        <div className="compact-row" key={`${row.title}-${row.meta}-${row.amount}`}>
          <div>
            <strong>{row.title}</strong>
            <small>{row.meta}</small>
          </div>
          <span className="amount">{row.amount}</span>
          {row.action ? <div className="row-actions">{row.action}</div> : null}
        </div>
      ))}
    </div>
  );
}

function CollapsibleBlock({
  children,
  defaultOpen = true,
  meta,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  meta?: string;
  title: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="collapsible-block">
      <button
        aria-expanded={open}
        className="collapsible-block-header"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={`group-chevron ${open ? "open" : ""}`} aria-hidden="true" />
        <span className="collapsible-block-title">
          <strong>{title}</strong>
          {meta ? <small>{meta}</small> : null}
        </span>
      </button>
      {open ? <div className="collapsible-block-body">{children}</div> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className="metric-value">{value}</strong>
    </div>
  );
}

function CompactLegend({
  rows,
  title,
}: {
  rows: Array<{ color: string; label: string; value: string }>;
  title: string;
}) {
  return (
    <div className="compact-legend">
      <strong>{title}</strong>
      {rows.length === 0 ? <small>No balances yet</small> : null}
      {rows.map((row) => (
        <div className="legend-row" key={row.label}>
          <span style={{ background: row.color }} />
          <small>{row.label}</small>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}

function completedCount(steps: Array<{ complete: boolean }>) {
  return steps.filter((step) => step.complete).length;
}

function hasDecisionType(decisions: DecisionQueueResponse | null, decisionType: string): boolean {
  return Boolean(decisions?.decisions.some((decision) => decision.decision_type === decisionType));
}

function getPageTitle(route: RouteId) {
  if (route !== "dashboard") return pageTitles[route];
  return {
    ...pageTitles.dashboard,
    title: `${timeOfDayGreeting()}, Kiran.`,
  };
}

function timeOfDayGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function classifyDateWindow(startDate: string, endDate: string): DateWindowKind {
  const today = todayIso();
  if (endDate < today) return "past";
  if (startDate > today) return "future";
  return "current";
}

function periodKindForPreset(preset: PeriodPreset, startDate: string, endDate: string): DateWindowKind {
  if (preset === "last-30") return "past";
  if (preset === "next-15" || preset === "next-30") return "future";
  return classifyDateWindow(startDate, endDate);
}

function billCardTitle(periodKind: DateWindowKind, periodLabel?: string) {
  if (periodKind === "past") return "Recent Bills";
  if (periodKind === "future") return "Upcoming Bills";
  if (periodLabel === "This month") return "Bills This Month";
  return "Bills";
}

function billMetricLabel(periodKind: DateWindowKind) {
  if (periodKind === "past") return "Recent bills";
  if (periodKind === "future") return "Upcoming";
  return "Bills";
}

function billListTitle(periodKind: DateWindowKind) {
  if (periodKind === "past") return "Recent bills";
  if (periodKind === "future") return "Upcoming bills";
  return "Current bills";
}

function buildCalendarDays(
  startDate: string | undefined,
  endDate: string | undefined,
  items: UpcomingCommitmentsResponse["items"],
): CalendarDayModel[] {
  const start = startDate ?? todayIso();
  const end = endDate ?? start;
  const first = startOfWeek(start);
  const last = endOfWeek(end);
  const itemsByDate = items.reduce<Record<string, UpcomingCommitmentsResponse["items"]>>((groups, item) => {
    groups[item.due_date] = [...(groups[item.due_date] ?? []), item];
    return groups;
  }, {});
  const days: CalendarDayModel[] = [];
  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) {
    const dayItems = itemsByDate[cursor] ?? [];
    days.push({
      date: cursor,
      inPeriod: cursor >= start && cursor <= end,
      items: dayItems,
      total: dayItems.reduce((sum, item) => sum + Math.abs(Number(item.expected_amount)), 0),
    });
  }
  return days;
}

function calendarPlanTone(item: UpcomingCommitmentsResponse["items"][number]) {
  if (item.commitment_type.includes("subscription")) return "subscription";
  if (item.commitment_type.includes("loan") || item.commitment_type.includes("debt")) return "debt";
  if (item.commitment_type.includes("income")) return "income";
  return "bill";
}

function formatShortDay(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(dateFromIso(isoDate));
}

function dayNumber(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric" }).format(dateFromIso(isoDate));
}

function currentRoute(): RouteId {
  return parseHashState().route;
}

function parseHashState(): { params: URLSearchParams; route: RouteId } {
  const rawHash = window.location.hash.replace(/^#\/?/, "");
  const [rawRoute, query = ""] = rawHash.split("?");
  const route = navItems.some((item) => item.route === rawRoute) ? (rawRoute as RouteId) : "dashboard";
  return { params: new URLSearchParams(query), route };
}

function candidateToggleApplies(route: RouteId) {
  return ["dashboard", "cash-flow", "calendar", "recurring", "reports", "monthly-review"].includes(route);
}

function filterByQuery<T>(rows: T[], query: string, getText: (row: T) => string): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;
  return rows.filter((row) => getText(row).toLowerCase().includes(normalizedQuery));
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function accountNetWorth(accounts: AccountsResponse | null) {
  return (accounts?.accounts ?? []).reduce((total, account) => {
    return total + Number(account.current_balance ?? account.net_total);
  }, 0);
}

function accountBuckets(accounts: AccountsResponse | null) {
  const buckets = (accounts?.accounts ?? []).reduce<{
    assets: Record<string, number>;
    liabilities: Record<string, number>;
  }>(
    (groups, account) => {
      const value = Number(account.current_balance ?? account.net_total);
      const label = titleCase(account.account_type === "unknown" ? account.provider : account.account_type);
      if (["credit_card", "loan", "bnpl"].includes(account.account_type) || value < 0) {
        groups.liabilities[label] = (groups.liabilities[label] ?? 0) + Math.abs(value);
      } else {
        groups.assets[label] = (groups.assets[label] ?? 0) + Math.max(0, value);
      }
      return groups;
    },
    { assets: {}, liabilities: {} },
  );
  return {
    assets: Object.entries(buckets.assets).map(([label, value]) => ({ label, value })),
    liabilities: Object.entries(buckets.liabilities).map(([label, value]) => ({ label, value })),
  };
}

function accountGroups(accounts: AccountRow[]): AccountGroup[] {
  const order = ["cash", "investments", "credit", "debt", "other"];
  const labels: Record<string, string> = {
    cash: "Cash",
    credit: "Credit Cards",
    debt: "Loans & Debt",
    investments: "Investments",
    other: "Other Accounts",
  };
  const grouped = accounts.reduce<Record<string, AccountRow[]>>((groups, account) => {
    const key = accountGroupKey(account);
    groups[key] = [...(groups[key] ?? []), account];
    return groups;
  }, {});

  return order
    .filter((key) => grouped[key]?.length)
    .map((key) => {
      const groupAccounts = grouped[key];
      return {
        accounts: groupAccounts,
        defaultOpen: key === "cash" || key === "credit",
        id: key,
        label: labels[key],
        monthChange: groupAccounts.reduce((sum, account) => sum + Number(account.net_total), 0),
        total: groupAccounts.reduce(
          (sum, account) => sum + Math.abs(Number(account.current_balance ?? account.net_total)),
          0,
        ),
      };
    });
}

function accountGroupKey(account: AccountRow) {
  if (["current", "savings", "pot"].includes(account.account_type)) return "cash";
  if (account.account_type === "credit_card") return "credit";
  if (["loan", "bnpl"].includes(account.account_type)) return "debt";
  if (/investment|pension|isa|401|brokerage/i.test(`${account.provider} ${account.display_name}`)) {
    return "investments";
  }
  return "other";
}

type ReportGroup = {
  color: string;
  label: string;
  value: number;
};

type SankeyNodeModel = {
  anchor: "end" | "start";
  color: string;
  emphasis?: "middle" | "normal";
  height: number;
  id: string;
  label: string;
  labelX: number;
  labelY: number;
  percent: string;
  value: number;
  x: number;
  y: number;
};

type SankeyFlowModel = {
  color: string;
  id: string;
  label: string;
  opacity: number;
  path: string;
  value: number;
  width: number;
};

type SankeyD3Node = {
  color: string;
  displayValue: number;
  emphasis?: "middle" | "normal";
  id: string;
  label: string;
  layer: number;
  percent: string;
  value: number;
};

type SankeyD3Link = {
  color: string;
  id: string;
  label: string;
  opacity: number;
  source: string;
  target: string;
  value: number;
};

function reportGroups(
  insights: InsightsResponse | null,
  groupBy: "category" | "merchant",
  view: "cash-flow" | "income" | "spending",
): ReportGroup[] {
  if (view === "income") {
    const income = (insights?.category_groups ?? []).find((group) => group.group === "income");
    return [
      {
        color: "#159bbd",
        label: "Paychecks",
        value: Number(income?.inflow_total ?? 0),
      },
    ].filter((group) => group.value > 0);
  }

  if (groupBy === "merchant") {
    const topMerchants = (insights?.top_merchants ?? [])
      .map((merchant, index) => ({
        color: paletteColor(index),
        label: merchant.merchant_name,
        value: Math.abs(Number(merchant.outflow_total)),
      }))
      .filter((group) => group.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const shownTotal = topMerchants.reduce((sum, group) => sum + group.value, 0);
    const otherTotal = reportTotals(insights).expenses - shownTotal;
    return otherTotal > 1
      ? [
          ...topMerchants,
          {
            color: "#9aa19a",
            label: "Other merchants",
            value: otherTotal,
          },
        ]
      : topMerchants;
  }

  return (insights?.category_groups ?? [])
    .filter((group) => !["income", "transfer", "ignored"].includes(group.group))
    .map((group) => ({
      color: categoryColor(group.group),
      label: titleCase(group.group),
      value: Math.abs(Number(group.outflow_total)),
    }))
    .filter((group) => group.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function buildSankeyGeometry({
  expenses,
  groups,
  income,
  savings,
  view,
}: {
  expenses: number;
  groups: ReportGroup[];
  income: number;
  savings: number;
  view: "cash-flow" | "income" | "spending";
}): { flows: SankeyFlowModel[]; nodes: SankeyNodeModel[] } {
  const destinations =
    view === "cash-flow" && savings > 0
      ? [{ color: "#2f7d5c", label: "Savings", value: savings }, ...groups]
      : groups;
  const graph = buildD3SankeyGraph({ destinations, expenses, income, savings, view });
  const layout = createSankey<SankeyD3Node, SankeyD3Link>()
    .nodeId((node) => node.id)
    .nodeAlign((node) => node.layer)
    .nodeWidth(20)
    .nodePadding(destinations.length > 5 ? 30 : 44)
    .nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .extent([[80, 80], [1010, 448]])
    .iterations(72);
  const computed = layout(graph);
  const linkPath = sankeyLinkHorizontal<SankeyD3Node, SankeyD3Link>();

  return {
    flows: computed.links.map((link) => ({
      color: link.color,
      id: link.id,
      label: link.label,
      opacity: link.opacity,
      path: linkPath(link) ?? "",
      value: link.value,
      width: Math.max(2, link.width ?? 2),
    })),
    nodes: computed.nodes.map((node) => d3SankeyNodeToModel(node)),
  };
}

function buildD3SankeyGraph({
  destinations,
  expenses,
  income,
  savings,
  view,
}: {
  destinations: ReportGroup[];
  expenses: number;
  income: number;
  savings: number;
  view: "cash-flow" | "income" | "spending";
}): SankeyGraph<SankeyD3Node, SankeyD3Link> {
  const destinationTotal = destinations.reduce((total, group) => total + group.value, 0);

  if (view === "spending") {
    return {
      nodes: [
        {
          color: "#2f7d5c",
          displayValue: expenses,
          emphasis: "middle",
          id: "outflow",
          label: "Outflows",
          layer: 0,
          percent: "",
          value: expenses,
        },
        ...destinations.map((group) => ({
          color: group.color,
          displayValue: group.value,
          id: `destination-${group.label}`,
          layer: 1,
          label: group.label,
          percent: percentage(group.value, expenses),
          value: group.value,
        })),
      ],
      links: destinations.map((group) => ({
        color: group.color,
        id: `expense-${group.label}`,
        label: group.label,
        opacity: 0.42,
        source: "outflow",
        target: `destination-${group.label}`,
        value: group.value,
      })),
    };
  }

  const requiredFunds = Math.max(destinationTotal, income, 1);
  const fundingGap = Math.max(0, destinationTotal - income);
  const nodes: SankeyD3Node[] = [
    { color: "#159bbd", displayValue: income, id: "paychecks", label: "Paychecks", layer: 0, percent: "", value: income },
    {
      color: "#2aaed1",
      displayValue: requiredFunds,
      id: "available",
      label: "Available funds",
      layer: 1,
      percent: "",
      value: requiredFunds,
    },
  ];
  const links: SankeyD3Link[] = [
    {
      color: "url(#sankeyIncome)",
      id: "paychecks-available",
      label: "Paychecks to available funds",
      opacity: 0.86,
      source: "paychecks",
      target: "available",
      value: income,
    },
  ];

  if (fundingGap > 0) {
    nodes.push({
      color: "#8fa19a",
      displayValue: fundingGap,
      id: "opening-cash",
      label: "Opening cash used",
      layer: 0,
      percent: "",
      value: fundingGap,
    });
    links.push({
      color: "#9aa19a",
      id: "opening-cash-available",
      label: "Opening cash used",
      opacity: 0.32,
      source: "opening-cash",
      target: "available",
      value: fundingGap,
    });
  }

  if (view === "cash-flow") {
    nodes.push({
      color: "#2f7d5c",
      displayValue: expenses,
      emphasis: "middle",
      id: "outflow",
      label: "Outflows",
      layer: 2,
      percent: "",
      value: Math.max(expenses, 1),
    });
    links.push({
      color: "url(#sankeyIncome)",
      id: "available-outflow",
      label: "Available funds to outflows",
      opacity: 0.68,
      source: "available",
      target: "outflow",
      value: Math.max(expenses, 1),
    });
    for (const group of destinations) {
      nodes.push({
        color: group.color,
        displayValue: group.value,
        id: `destination-${group.label}`,
        layer: 3,
        label: group.label,
        percent: group.label === "Savings" ? percentage(group.value, income || savings) : percentage(group.value, expenses),
        value: group.value,
      });
      const isSavings = group.label === "Savings";
      links.push({
        color: group.color,
        id: `allocated-${group.label}`,
        label: group.label,
        opacity: isSavings ? 0.32 : 0.42,
        source: isSavings ? "available" : "outflow",
        target: `destination-${group.label}`,
        value: group.value,
      });
    }
  }

  return { links, nodes };
}

function percentage(value: number, total: number) {
  if (total <= 0) return "";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function d3SankeyNodeToModel(node: SankeyNode<SankeyD3Node, SankeyD3Link>): SankeyNodeModel {
  const x = node.x0 ?? 0;
  const y = node.y0 ?? 0;
  const height = Math.max(12, (node.y1 ?? y + 12) - y);
  const isDestination = node.depth === 2 || node.id.startsWith("destination-");
  return {
    anchor: node.emphasis === "middle" ? "end" : isDestination ? "end" : "start",
    color: node.color,
    emphasis: node.emphasis,
    height,
    id: node.id,
    label: compactLabel(node.label),
    labelX: node.emphasis === "middle" ? x - 16 : isDestination ? x - 14 : (node.x1 ?? x) + 22,
    labelY: labelYFor(y, height),
    percent: node.percent,
    value: node.displayValue,
    x,
    y,
  };
}

function labelYFor(y: number, height: number) {
  return y + Math.max(15, Math.min(height / 2 - 8, 26));
}

function compactLabel(label: string) {
  return label.length > 24 ? `${label.slice(0, 22).trim()}…` : label;
}

function reportTotals(insights: InsightsResponse | null) {
  return (insights?.category_groups ?? []).reduce(
    (totals, group) => {
      const income = Number(group.inflow_total);
      const outflow = Math.abs(Number(group.outflow_total));
      if (group.group === "income") totals.income += income;
      if (!["income", "transfer", "ignored"].includes(group.group)) totals.expenses += outflow;
      totals.net += Number(group.net_total);
      return totals;
    },
    { expenses: 0, income: 0, net: 0 },
  );
}

function performanceSeries(total: number) {
  const safeTotal = total || 1000;
  return Array.from({ length: 18 }, (_, index) => {
    const drift = safeTotal * (0.9 + index * 0.008);
    const wiggle = Math.sin(index * 1.7) * safeTotal * 0.012;
    return Math.max(0, drift + wiggle);
  });
}

function chartY(value: number, series: number[], height: number) {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  return 24 + (1 - (value - min) / range) * height;
}

function linePathFromSeries(series: number[], width: number, height: number) {
  return series
    .map((value, index) => {
      const x = 34 + (index / (series.length - 1)) * (width - 54);
      const y = chartY(value, series, height);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(series: number[], width: number, height: number) {
  const line = linePathFromSeries(series, width, height);
  return `${line} L ${width - 20} 238 L 34 238 Z`;
}

function categoryColor(group: string) {
  const colors: Record<string, string> = {
    debt: "#d43c95",
    fixed: "#f5bd22",
    flexible: "#365bdc",
    non_monthly: "#ff8f3d",
    needs_review: "#8d65d8",
  };
  return colors[group] ?? "#2aaed1";
}

function paletteColor(index: number) {
  return ["#365bdc", "#d43c95", "#ff8f3d", "#8d65d8", "#2aaed1", "#3aa66d"][index % 6];
}

function buildTransactionFilters(
  dateWindow: ReturnType<typeof getDateWindow>,
  filters: TransactionFilterState,
  searchQuery: string,
): TransactionFilters {
  return {
    accountId: filters.accountId || undefined,
    endDate: dateWindow.endDate,
    includeTransferCandidates: false,
    limit: 100,
    normalizedGroup: filters.normalizedGroup || undefined,
    reviewed:
      filters.reviewed === "all"
        ? undefined
        : filters.reviewed === "reviewed",
    search: searchQuery.trim() || undefined,
    startDate: dateWindow.startDate,
    status: filters.status || undefined,
    transactionType: filters.transactionType || undefined,
  };
}

function getDateWindow(preset: PeriodPreset, customStartDate: string, customEndDate: string) {
  const today = todayIso();
  if (preset === "this-month") {
    const startDate = startOfMonth(today);
    const endDate = endOfMonth(today);
    return {
      days: daysBetween(startDate, endDate),
      endDate,
      label: "This month",
      startDate,
    };
  }
  if (preset === "last-30") {
    const startDate = addDays(today, -29);
    return {
      days: 30,
      endDate: today,
      label: "Last 30 days",
      startDate,
    };
  }
  if (preset === "next-15") {
    const endDate = addDays(today, 15);
    return {
      days: 15,
      endDate,
      label: "Next 15 days",
      startDate: today,
    };
  }
  if (preset === "custom") {
    const startDate = customStartDate || today;
    const endDate = customEndDate || startDate;
    return {
      days: daysBetween(startDate, endDate),
      endDate,
      label: `${startDate} to ${endDate}`,
      startDate,
    };
  }
  const endDate = addDays(today, 30);
  return {
    days: 30,
    endDate,
    label: "Next 30 days",
    startDate: today,
  };
}

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateFromIso(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(isoDate: string) {
  const date = dateFromIso(isoDate);
  date.setDate(date.getDate() - date.getDay());
  return isoFromDate(date);
}

function endOfWeek(isoDate: string) {
  const date = dateFromIso(isoDate);
  date.setDate(date.getDate() + (6 - date.getDay()));
  return isoFromDate(date);
}

function startOfMonth(isoDate: string) {
  return `${isoDate.slice(0, 8)}01`;
}

function endOfMonth(isoDate: string) {
  const year = Number(isoDate.slice(0, 4));
  const monthIndex = Number(isoDate.slice(5, 7)) - 1;
  return new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 30;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

function money(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(parsed);
}

function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function decisionTypeLabel(value: string) {
  if (value === "internal_transfer") return "Transfer match";
  if (value === "commitment_candidate") return "Recurring candidate";
  return titleCase(value);
}

function balanceStatusLabel(value?: string) {
  if (value === "ready") return "Ready for planning";
  if (value === "needs_balance_review") return "Needs balance review";
  if (!value) return "Setup needed";
  return titleCase(value);
}

function isReviewFilter(value: string | null): value is TransactionFilterState["reviewed"] {
  return value === "all" || value === "reviewed" || value === "unreviewed";
}

function savedFilterHref(filter: { query: string; route: string }) {
  return filter.query ? `#/${filter.route}?${filter.query}` : `#/${filter.route}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
