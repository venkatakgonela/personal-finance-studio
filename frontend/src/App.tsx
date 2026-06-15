import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  type MerchantInsight,
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
type ReportGroupBy = "category" | "merchant";
type ReportView = "cash-flow" | "income" | "spending";
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
type LocalGoal = {
  currentAmount: number;
  dueDate: string;
  id: string;
  monthlyContribution: number;
  name: string;
  targetAmount: number;
};
type BudgetPlanRow = {
  group: string;
  plannedAmount: number;
};
type BudgetMode = "category" | "flexible" | "rollover";
type BudgetRolloverRow = {
  group: string;
  rolloverAmount: number;
};
type CashflowScenario = {
  id: string;
  incomeAdjustment: number;
  name: string;
  notes: string;
  outflowAdjustment: number;
};
type CategorySetting = {
  group: string;
  id: string;
  name: string;
  type: "expense" | "income";
};
type TagSetting = {
  color: string;
  id: string;
  name: string;
};
type RuleSetting = {
  action: string;
  condition: string;
  id: string;
  name: string;
  tag: string;
};
type RuleApplicationSnapshot = {
  appliedAt: string;
  id: string;
  previous: Array<{
    id: string;
    reviewed: boolean;
    sourceCategory: string;
    transactionType: string;
  }>;
  ruleId: string;
  ruleName: string;
};
type MerchantSetting = {
  categoryGroup: string;
  displayName: string;
  id: string;
  ignored: boolean;
  sourceName: string;
};
type PlanningControlState = {
  budgetMode: BudgetMode;
  budgetRows: BudgetPlanRow[];
  categories: CategorySetting[];
  ruleApplications: RuleApplicationSnapshot[];
  scenarios: CashflowScenario[];
  goals: LocalGoal[];
  merchants: MerchantSetting[];
  rollovers: BudgetRolloverRow[];
  rules: RuleSetting[];
  tags: TagSetting[];
};

const routeItems = [
  { label: "Dashboard", route: "dashboard" },
  { label: "Accounts", route: "accounts" },
  { label: "Transactions", route: "transactions" },
  { label: "Cash Flow", route: "cash-flow" },
  { label: "Calendar", route: "calendar" },
  { label: "Budget", route: "budget" },
  { label: "Recurring", route: "recurring" },
  { label: "Goals", route: "goals" },
  { label: "Sinking Funds", route: "sinking-funds" },
  { label: "Monthly Review", route: "monthly-review" },
  { label: "Subscriptions", route: "subscriptions" },
  { label: "Reports", route: "reports" },
  { label: "Decision Queue", route: "decision-queue" },
  { label: "Import", route: "import" },
  { label: "Settings", route: "settings" },
] as const;

const navItems = routeItems.filter((item) => item.route !== "import" && item.route !== "settings");

type RouteId = (typeof routeItems)[number]["route"];

const pageTitles: Record<RouteId, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Household workspace", title: "Good day, Kiran." },
  accounts: { eyebrow: "Accounts", title: "Review balances and account roles." },
  transactions: { eyebrow: "Transactions", title: "Understand where the money moved." },
  "cash-flow": { eyebrow: "Cash flow", title: "See what is coming next." },
  calendar: { eyebrow: "Calendar", title: "Plan bills by date." },
  budget: { eyebrow: "Budget", title: "Plan the month before it surprises you." },
  recurring: { eyebrow: "Recurring", title: "Confirm bills, subscriptions, and debt payments." },
  goals: { eyebrow: "Goals", title: "Turn spare cash into a plan." },
  "sinking-funds": { eyebrow: "Sinking funds", title: "Make non-monthly bills feel monthly." },
  "monthly-review": { eyebrow: "Monthly review", title: "Close the month with confidence." },
  subscriptions: { eyebrow: "Subscriptions", title: "Keep only what earns its place." },
  reports: { eyebrow: "Reports", title: "Spot spending patterns." },
  "decision-queue": { eyebrow: "Decision queue", title: "Resolve only the decisions that matter." },
  import: { eyebrow: "Import center", title: "Bring fresh data into the plan." },
  settings: { eyebrow: "Settings", title: "Shape the local money system." },
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
  const [searchQuery, setSearchQuery] = useState(() => initialSearchQuery());
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(() => initialPeriodPreset());
  const [customStartDate, setCustomStartDate] = useState(() => initialCustomStartDate());
  const [customEndDate, setCustomEndDate] = useState(() => initialCustomEndDate());
  const [includeCandidates, setIncludeCandidates] = useState(() => initialIncludeCandidates());
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilterState>(() => initialTransactionFilters());
  const [reportView, setReportView] = useState<ReportView>(() => initialReportView());
  const [reportGroupBy, setReportGroupBy] = useState<ReportGroupBy>(() => initialReportGroupBy());
  const [controlState, setControlState] = useState<PlanningControlState>(() => readPlanningControlState());
  const [route, setRoute] = useState<RouteId>(currentRoute());
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<ApiHealthState>({
    checkedAt: null,
    details: null,
    message: `Checking ${API_BASE}`,
    status: "checking",
  });
  const lastSyncedHash = useRef("");

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

  useEffect(() => {
    writePlanningControlState(controlState);
  }, [controlState]);

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
    const nextHash = buildHashState({
      customEndDate,
      customStartDate,
      includeCandidates,
      periodPreset,
      reportGroupBy,
      reportView,
      route,
      searchQuery,
      transactionFilters,
    });
    if (window.location.hash === nextHash || lastSyncedHash.current === nextHash) return;
    lastSyncedHash.current = nextHash;
    window.history.replaceState(null, "", nextHash);
  }, [
    customEndDate,
    customStartDate,
    includeCandidates,
    periodPreset,
    reportGroupBy,
    reportView,
    route,
    searchQuery,
    transactionFilters,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateExistingWorkspace() {
      const [
        accountsResult,
        commitmentsResult,
        decisionsResult,
        dashboardResult,
        upcomingResult,
        forecastResult,
        insightsResult,
        planningResult,
      ] = await Promise.allSettled([
        getAccounts(),
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
  }, [dateWindow, includeCandidates]);

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
      applyRouteQuery(nextRoute, params);
    }

    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/dashboard");
    }

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function applyRouteQuery(nextRoute: RouteId, params: URLSearchParams) {
    const range = params.get("range");
    const reviewed = params.get("reviewed");
    const include = params.get("includeCandidates");
    const customStart = params.get("start");
    const customEnd = params.get("end");
    const nextReportView = params.get("report");
    const nextReportGroupBy = params.get("groupBy");
    if (range && periodOptions.some((option) => option.value === range)) {
      setPeriodPreset(range as PeriodPreset);
    }
    if (customStart && isIsoDate(customStart)) setCustomStartDate(customStart);
    if (customEnd && isIsoDate(customEnd)) setCustomEndDate(customEnd);
    if (include !== null) setIncludeCandidates(include !== "false");
    if (isReportView(nextReportView)) {
      setReportView(nextReportView);
      if (!isReportGroupBy(nextReportGroupBy)) {
        setReportGroupBy(nextReportView === "income" ? "merchant" : "category");
      }
    }
    if (isReportGroupBy(nextReportGroupBy)) setReportGroupBy(nextReportGroupBy);
    const querySearch = params.get("search");
    if (querySearch !== null) setSearchQuery(querySearch);
    if (nextRoute === "transactions") {
      setTransactionFilters({
        accountId: params.get("account") ?? "",
        normalizedGroup: params.get("group") ?? "",
        reviewed: isReviewFilter(reviewed) ? reviewed : "all",
        status: params.get("status") ?? "",
        transactionType: params.get("type") ?? "",
      });
    }
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
          controlState={controlState}
          dashboard={dashboard}
          decisions={decisions}
          forecast={forecast}
          insights={insights}
          planning={planning}
          onControlStateChange={setControlState}
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
          reportGroupBy={reportGroupBy}
          reportView={reportView}
          setTransactionFilters={setTransactionFilters}
          setReportGroupBy={setReportGroupBy}
          setReportView={setReportView}
          transactionFilters={transactionFilters}
          transferResult={transferResult}
          upcoming={upcoming}
        />
      </main>
    </div>
  );
}

function Sidebar({ currentRoute }: { currentRoute: RouteId }) {
  const [menuOpen, setMenuOpen] = useState(false);
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
      <div className="profile-menu">
        {menuOpen ? (
          <div className="profile-menu-popover" role="menu">
            <a
              className={currentRoute === "import" ? "active" : ""}
              href="#/import"
              onClick={() => setMenuOpen(false)}
              role="menuitem"
            >
              Import data
            </a>
            <a
              className={currentRoute === "settings" ? "active" : ""}
              href="#/settings"
              onClick={() => setMenuOpen(false)}
              role="menuitem"
            >
              Settings
            </a>
          </div>
        ) : null}
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className={`profile-chip ${currentRoute === "import" || currentRoute === "settings" ? "active" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span>K</span>
          <div>
            <strong>Kiran</strong>
            <small>Household</small>
          </div>
          <b className="profile-chevron" aria-hidden="true" />
        </button>
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
  controlState,
  dashboard,
  decisions,
  forecast,
  includeCandidates,
  insights,
  planning,
  onControlStateChange,
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
  reportGroupBy,
  reportView,
  setReportGroupBy,
  setReportView,
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
  controlState: PlanningControlState;
  dashboard: DashboardSummary | null;
  decisions: DecisionQueueResponse | null;
  forecast: ForecastResponse | null;
  includeCandidates: boolean;
  insights: InsightsResponse | null;
  planning: PlanningOverview | null;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
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
  reportGroupBy: ReportGroupBy;
  reportView: ReportView;
  setReportGroupBy: (groupBy: ReportGroupBy) => void;
  setReportView: (view: ReportView) => void;
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
      <section className="page-grid page-grid-single" aria-label="Cash flow page">
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
        <CashflowPlanningCard
          controlState={controlState}
          dashboard={dashboard}
          forecast={forecast}
          includeCandidates={includeCandidates}
          insights={insights}
          onControlStateChange={onControlStateChange}
          periodLabel={periodLabel}
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

  if (route === "budget") {
    return (
      <section className="page-grid page-grid-single" aria-label="Budget page">
        <BudgetPageCard
          controlState={controlState}
          insights={insights}
          onControlStateChange={onControlStateChange}
          periodLabel={periodLabel}
          planning={planning}
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
      <section className="page-grid page-grid-single goals-page-grid" aria-label="Goals page">
        <GoalsCard
          controlState={controlState}
          onControlStateChange={onControlStateChange}
          planning={planning}
        />
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
        <SankeyReportCard
          controlState={controlState}
          groupBy={reportGroupBy}
          insights={insights}
          onGroupByChange={setReportGroupBy}
          onReportViewChange={setReportView}
          periodLabel={periodLabel}
          reportView={reportView}
        />
        <InsightsCard controlState={controlState} insights={insights} periodLabel={periodLabel} />
        <ExportsCard
          controlState={controlState}
          insights={insights}
          periodLabel={periodLabel}
          planning={planning}
          transactions={transactions}
        />
        <SavedFiltersCard planning={planning} />
      </section>
    );
  }

  if (route === "settings") {
    return (
      <section className="page-grid page-grid-single" aria-label="Settings page">
        <SettingsWorkbenchCard
          controlState={controlState}
          health={apiHealth}
          insights={insights}
          onControlStateChange={onControlStateChange}
          onHealthCheck={onHealthCheck}
          onTransactionUpdate={onTransactionUpdate}
          transactions={transactions}
        />
      </section>
    );
  }

  if (route === "import") {
    return (
      <section className="page-grid" aria-label="Import page">
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
        <ImportFreshnessCard planning={planning} />
      </section>
    );
  }

  const showSetupCard = !transactions?.total_count || !accounts?.accounts.length || !commitments?.total_count;

  return (
    <section className="dashboard-grid" aria-label="Personal Finance Studio dashboard">
      <DashboardHeroCard
        dashboard={dashboard}
        periodKind={periodKind}
        planning={planning}
        upcoming={upcoming}
      />
      <SpendingCard dashboard={dashboard} insights={insights} />
      <SpendingPlanCard
        controlState={controlState}
        dashboard={dashboard}
        insights={insights}
        planning={planning}
        upcoming={upcoming}
      />
      <PlanningSnapshotCard
        controlState={controlState}
        dashboard={dashboard}
        insights={insights}
        planning={planning}
      />
      <UpcomingCard
        includeCandidates={includeCandidates}
        onBillPaid={onBillPaid}
        periodKind={periodKind}
        periodLabel={periodLabel}
        query={query}
        upcoming={upcoming}
      />
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
      {showSetupCard ? (
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
      ) : null}
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
  controlState,
  groupBy,
  insights,
  onGroupByChange,
  onReportViewChange,
  periodLabel,
  reportView,
}: {
  controlState: PlanningControlState;
  groupBy: ReportGroupBy;
  insights: InsightsResponse | null;
  onGroupByChange: (groupBy: ReportGroupBy) => void;
  onReportViewChange: (view: ReportView) => void;
  periodLabel?: string;
  reportView: ReportView;
}) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const totals = reportTotals(insights);
  const groups = reportGroups(insights, groupBy, reportView, controlState);
  const activeExpandedGroupId = groups.some((group) => group.id === expandedGroupId && group.children.length > 0)
    ? expandedGroupId
    : null;
  const savings = Math.max(0, totals.net);
  const sankey = buildSankeyGeometry({
    expandedGroupId: activeExpandedGroupId,
    expenses: totals.expenses,
    groups,
    income: totals.income,
    savings,
    view: reportView,
  });
  const expandedGroup = groups.find((group) => group.id === activeExpandedGroupId);

  useEffect(() => {
    setExpandedGroupId(null);
  }, [groupBy, reportView, periodLabel]);

  const toggleSankeyNode = (node: SankeyNodeModel) => {
    if (!node.expandable || !node.groupId) return;
    const groupId = node.groupId;
    setExpandedGroupId((current) => (current === groupId ? null : groupId));
  };

  const handleSankeyNodeKeyDown = (event: KeyboardEvent<SVGGElement>, node: SankeyNodeModel) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleSankeyNode(node);
  };

  const selectReportView = (view: ReportView) => {
    onReportViewChange(view);
    onGroupByChange(view === "income" ? "merchant" : "category");
  };

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
                onClick={() => selectReportView(view)}
                role="tab"
                type="button"
              >
                {titleCase(view)}
              </button>
            ))}
          </div>
          <select
            aria-label="Report grouping"
            onChange={(event) => onGroupByChange(event.target.value as ReportGroupBy)}
            value={groupBy}
          >
            <option value="category">{reportView === "income" ? "Summary only" : "By category & group"}</option>
            <option value="merchant">{reportView === "income" ? "By income source" : "By top merchants"}</option>
          </select>
        </div>
      </div>
      <p className="sankey-drilldown-note">
        {reportView === "income"
          ? "Income flows from detected source names into total income and available funds."
          : groupBy === "category"
          ? expandedGroup
            ? `${expandedGroup.label} expanded into ${expandedGroup.children.length} merchant ${expandedGroup.children.length === 1 ? "bucket" : "buckets"}. Click it again to collapse.`
            : "Click a category bar such as Debt or Flexible to expand its merchant breakdown."
          : "Switch to category grouping to drill into a spending bucket."}
      </p>
      <div className="sankey-stage">
        <svg className="sankey-svg" viewBox="0 0 1180 610" role="img" aria-label={`${titleCase(reportView)} Sankey report`}>
          <defs>
            <linearGradient id="sankeyIncome" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#bfeaf4" stopOpacity="0.94" />
              <stop offset="48%" stopColor="#d4eee0" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f5efb9" stopOpacity="0.84" />
            </linearGradient>
            <linearGradient id="sankeyIncomeAvailable" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7bd6e4" stopOpacity="0.9" />
              <stop offset="56%" stopColor="#b8eadb" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#eef3aa" stopOpacity="0.82" />
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
            <g
              aria-label={node.expandable ? `${node.label}, ${node.transactionCount} transactions. Click to ${node.selected ? "collapse" : "expand"}.` : undefined}
              className={`sankey-node-group ${node.expandable ? "is-clickable" : ""} ${node.selected ? "is-selected" : ""}`}
              key={node.id}
              onClick={() => toggleSankeyNode(node)}
              onKeyDown={(event) => handleSankeyNodeKeyDown(event, node)}
              role={node.expandable ? "button" : undefined}
              tabIndex={node.expandable ? 0 : undefined}
            >
              {node.expandable ? (
                <rect
                  className="sankey-hitbox"
                  height={Math.max(node.height, 58)}
                  rx="8"
                  width={node.anchor === "end" ? Math.abs(node.x - node.labelX) + 168 : Math.abs(node.labelX - node.x) + 168}
                  x={node.anchor === "end" ? node.labelX - 150 : node.x - 10}
                  y={Math.min(node.y, node.labelY - 24)}
                />
              ) : null}
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

function SettingsWorkbenchCard({
  controlState,
  health,
  insights,
  onControlStateChange,
  onHealthCheck,
  onTransactionUpdate,
  transactions,
}: {
  controlState: PlanningControlState;
  health: ApiHealthState;
  insights: InsightsResponse | null;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  onHealthCheck: () => Promise<void>;
  onTransactionUpdate: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  transactions: TransactionsResponse | null;
}) {
  const [section, setSection] = useState<"categories" | "data" | "merchants" | "rules" | "system" | "tags">("categories");
  return (
    <article className="card settings-workbench">
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {(["categories", "merchants", "rules", "tags", "data", "system"] as const).map((item) => (
            <button
              className={section === item ? "active" : ""}
              key={item}
              onClick={() => setSection(item)}
              type="button"
            >
              {titleCase(item)}
            </button>
          ))}
        </nav>
        <div className="settings-panel">
          {section === "categories" ? (
            <CategorySettings controlState={controlState} onControlStateChange={onControlStateChange} />
          ) : null}
          {section === "merchants" ? (
            <MerchantSettings
              controlState={controlState}
              insights={insights}
              onControlStateChange={onControlStateChange}
            />
          ) : null}
          {section === "rules" ? (
            <RuleSettings
              controlState={controlState}
              onControlStateChange={onControlStateChange}
              onTransactionUpdate={onTransactionUpdate}
              transactions={transactions}
            />
          ) : null}
          {section === "tags" ? (
            <TagSettings controlState={controlState} onControlStateChange={onControlStateChange} />
          ) : null}
          {section === "data" ? (
            <DataSettings controlState={controlState} />
          ) : null}
          {section === "system" ? <SystemStatusCard health={health} onHealthCheck={onHealthCheck} /> : null}
        </div>
      </div>
    </article>
  );
}

function CategorySettings({
  controlState,
  onControlStateChange,
}: {
  controlState: PlanningControlState;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
}) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("flexible");
  const addCategory = () => {
    if (!name.trim()) return;
    onControlStateChange((current) => ({
      ...current,
      categories: [
        ...current.categories,
        { group, id: makeLocalId("category"), name: name.trim(), type: group === "income" ? "income" : "expense" },
      ],
    }));
    setName("");
  };
  return (
    <section>
      <CardHeader title="Categories" subtitle="Local category groups used by budget and review workflows." />
      <div className="control-form inline-control-form">
        <input aria-label="New category name" onChange={(event) => setName(event.target.value)} placeholder="Category name" value={name} />
        <select aria-label="Category group" onChange={(event) => setGroup(event.target.value)} value={group}>
          {transactionGroups.map((item) => (
            <option key={item} value={item}>{titleCase(item)}</option>
          ))}
        </select>
        <button className="settings-primary-action" onClick={addCategory} type="button">Create category</button>
      </div>
      <div className="settings-row-list">
        {controlState.categories.map((category) => (
          <div className="settings-row" key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <small>{titleCase(category.group)} · {category.type}</small>
            </div>
            <button
              className="button-link button-link-small button-danger"
              onClick={() =>
                onControlStateChange((current) => ({
                  ...current,
                  categories: current.categories.filter((item) => item.id !== category.id),
                }))
              }
              type="button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TagSettings({
  controlState,
  onControlStateChange,
}: {
  controlState: PlanningControlState;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2aaed1");
  const addTag = () => {
    if (!name.trim()) return;
    onControlStateChange((current) => ({
      ...current,
      tags: [...current.tags, { color, id: makeLocalId("tag"), name: name.trim() }],
    }));
    setName("");
  };
  return (
    <section>
      <CardHeader title="Tags" subtitle="Local labels for review, tax, subscription, reimbursement, or split notes." />
      <div className="control-form inline-control-form">
        <input aria-label="New tag name" onChange={(event) => setName(event.target.value)} placeholder="Tag name" value={name} />
        <input aria-label="Tag color" onChange={(event) => setColor(event.target.value)} type="color" value={color} />
        <button className="settings-primary-action" onClick={addTag} type="button">New tag</button>
      </div>
      <div className="settings-row-list">
        {controlState.tags.map((tag) => (
          <div className="settings-row" key={tag.id}>
            <div className="tag-label-row">
              <span style={{ background: tag.color }} />
              <strong>{tag.name}</strong>
            </div>
            <button
              className="button-link button-link-small button-danger"
              onClick={() =>
                onControlStateChange((current) => ({
                  ...current,
                  tags: current.tags.filter((item) => item.id !== tag.id),
                }))
              }
              type="button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function RuleSettings({
  controlState,
  onControlStateChange,
  onTransactionUpdate,
  transactions,
}: {
  controlState: PlanningControlState;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  onTransactionUpdate: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  transactions: TransactionsResponse | null;
}) {
  const [condition, setCondition] = useState("");
  const [action, setAction] = useState("flexible");
  const [tag, setTag] = useState(controlState.tags[0]?.name ?? "Review");
  const [previewRuleId, setPreviewRuleId] = useState(controlState.rules[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ruleStatus, setRuleStatus] = useState("");
  const addRule = () => {
    if (!condition.trim()) return;
    const newRule: RuleSetting = {
      action,
      condition: condition.trim(),
      id: makeLocalId("rule"),
      name: `If merchant contains ${condition.trim()}`,
      tag,
    };
    onControlStateChange((current) => ({
      ...current,
      rules: [...current.rules, newRule],
    }));
    setPreviewRuleId(newRule.id);
    setCondition("");
  };
  const activeRule = controlState.rules.find((rule) => rule.id === previewRuleId) ?? controlState.rules[0];
  const matches = activeRule ? ruleMatches(activeRule, transactions?.transactions ?? []) : [];
  const selectedMatches = matches.filter((transaction) => selectedIds.includes(transaction.id));
  const lastApplication = controlState.ruleApplications.at(-1);

  useEffect(() => {
    if (!activeRule) return;
    setSelectedIds(ruleMatches(activeRule, transactions?.transactions ?? []).map((transaction) => transaction.id));
  }, [activeRule, transactions]);

  const applyRule = async () => {
    if (!activeRule || selectedMatches.length === 0) return;
    setRuleStatus(`Applying ${selectedMatches.length} transaction${selectedMatches.length === 1 ? "" : "s"}...`);
    const previous = selectedMatches.map((transaction) => ({
      id: transaction.id,
      reviewed: transaction.reviewed,
      sourceCategory: transaction.source_category,
      transactionType: transaction.transaction_type,
    }));
    for (const transaction of selectedMatches) {
      await onTransactionUpdate(transaction.id, {
        notes: `Rule applied: ${activeRule.name}`,
        reviewed: true,
        source_category: titleCase(activeRule.action),
        transaction_type: transactionTypeForGroup(activeRule.action, transaction),
      });
    }
    onControlStateChange((current) => ({
      ...current,
      ruleApplications: [
        ...current.ruleApplications,
        {
          appliedAt: new Date().toISOString(),
          id: makeLocalId("rule-application"),
          previous,
          ruleId: activeRule.id,
          ruleName: activeRule.name,
        },
      ],
    }));
    setRuleStatus(`Applied ${selectedMatches.length} transaction${selectedMatches.length === 1 ? "" : "s"}.`);
  };

  const undoLastApplication = async () => {
    if (!lastApplication) return;
    setRuleStatus(`Undoing ${lastApplication.previous.length} transaction${lastApplication.previous.length === 1 ? "" : "s"}...`);
    for (const snapshot of lastApplication.previous) {
      await onTransactionUpdate(snapshot.id, {
        reviewed: snapshot.reviewed,
        source_category: snapshot.sourceCategory,
        transaction_type: snapshot.transactionType,
      });
    }
    onControlStateChange((current) => ({
      ...current,
      ruleApplications: current.ruleApplications.filter((item) => item.id !== lastApplication.id),
    }));
    setRuleStatus(`Undid ${lastApplication.ruleName}.`);
  };

  return (
    <section>
      <CardHeader title="Rules" subtitle="Preview-style local rules. Phase 2 can apply them to transactions with undo." />
      <div className="control-form inline-control-form">
        <input aria-label="Rule condition" onChange={(event) => setCondition(event.target.value)} placeholder="Merchant contains..." value={condition} />
        <select aria-label="Rule category action" onChange={(event) => setAction(event.target.value)} value={action}>
          {transactionGroups.map((item) => (
            <option key={item} value={item}>{titleCase(item)}</option>
          ))}
        </select>
        <input aria-label="Rule tag" onChange={(event) => setTag(event.target.value)} placeholder="Tag" value={tag} />
        <button className="settings-primary-action" onClick={addRule} type="button">Create rule</button>
      </div>
      <div className="rule-apply-panel">
        <div className="rule-apply-toolbar">
          <label>
            Preview rule
            <select
              aria-label="Rule preview"
              onChange={(event) => setPreviewRuleId(event.target.value)}
              value={activeRule?.id ?? ""}
            >
              {controlState.rules.map((rule) => (
                <option key={rule.id} value={rule.id}>{rule.name}</option>
              ))}
            </select>
          </label>
          <div className="row-actions">
            <button disabled={!activeRule || selectedMatches.length === 0} onClick={() => void applyRule()} type="button">
              Apply selected
            </button>
            <button
              className="button-muted"
              disabled={!lastApplication}
              onClick={() => void undoLastApplication()}
              type="button"
            >
              Undo last apply
            </button>
          </div>
        </div>
        <p className="fine-print">
          Preview is based on currently loaded transactions and selected date/search filters. Applying a rule updates
          the chosen transactions explicitly and stores one local undo snapshot.
        </p>
        {ruleStatus ? <p className="status-copy">{ruleStatus}</p> : null}
        <CollapsibleBlock defaultOpen={false} meta={`${matches.length} matches`} title="Rule impact preview">
          <div className="settings-row-list rule-preview-list">
            {matches.slice(0, 25).map((transaction) => (
              <label className="settings-row rule-preview-row" key={transaction.id}>
                <input
                  checked={selectedIds.includes(transaction.id)}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, transaction.id])]
                        : current.filter((id) => id !== transaction.id),
                    )
                  }
                  type="checkbox"
                />
                <div>
                  <strong>{transaction.merchant_name || transaction.description}</strong>
                  <small>
                    {transaction.date} · {titleCase(transaction.normalized_group)} to {activeRule ? titleCase(activeRule.action) : "-"} · {money(transaction.amount)}
                  </small>
                </div>
              </label>
            ))}
            {matches.length === 0 ? <p className="empty-copy">No matching transactions in the current loaded view.</p> : null}
          </div>
        </CollapsibleBlock>
      </div>
      <div className="settings-row-list">
        {controlState.rules.map((rule) => (
          <div className="settings-row rule-row" key={rule.id}>
            <div>
              <strong>{rule.name}</strong>
              <small>Recategorize to {titleCase(rule.action)} · add tag {rule.tag || "none"}</small>
            </div>
            <button
              className="button-link button-link-small button-danger"
              onClick={() =>
                onControlStateChange((current) => ({
                  ...current,
                  rules: current.rules.filter((item) => item.id !== rule.id),
                }))
              }
              type="button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MerchantSettings({
  controlState,
  insights,
  onControlStateChange,
}: {
  controlState: PlanningControlState;
  insights: InsightsResponse | null;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
}) {
  const merchants = merchantSettingsRows(controlState, insights);
  const updateMerchant = (sourceName: string, patch: Partial<MerchantSetting>) => {
    onControlStateChange((current) => {
      const existing = current.merchants.find((merchant) => merchant.sourceName === sourceName);
      const next: MerchantSetting = {
        categoryGroup: patch.categoryGroup ?? existing?.categoryGroup ?? "flexible",
        displayName: patch.displayName ?? existing?.displayName ?? sourceName,
        id: existing?.id ?? makeLocalId("merchant"),
        ignored: patch.ignored ?? existing?.ignored ?? false,
        sourceName,
      };
      return {
        ...current,
        merchants: existing
          ? current.merchants.map((merchant) => (merchant.sourceName === sourceName ? next : merchant))
          : [...current.merchants, next],
      };
    });
  };
  return (
    <section>
      <CardHeader title="Merchants" subtitle="Merge aliases, split display names back out, and tune report grouping." />
      <p className="fine-print">
        Set the same display name on multiple merchants to merge them in reports. Use Split to restore the original
        imported merchant label without changing raw transaction history.
      </p>
      <div className="settings-row-list">
        {merchants.map((merchant) => (
          <div className="settings-row merchant-settings-row" key={merchant.sourceName}>
            <input
              aria-label={`Display name for ${merchant.sourceName}`}
              defaultValue={merchant.displayName}
              onBlur={(event) => updateMerchant(merchant.sourceName, { displayName: event.target.value })}
            />
            <select
              aria-label={`Category for ${merchant.sourceName}`}
              onChange={(event) => updateMerchant(merchant.sourceName, { categoryGroup: event.target.value })}
              value={merchant.categoryGroup}
            >
              {transactionGroups.map((group) => (
                <option key={group} value={group}>{titleCase(group)}</option>
              ))}
            </select>
            <button
              className={`button-link button-link-small ${merchant.ignored ? "button-danger" : ""}`}
              onClick={() => updateMerchant(merchant.sourceName, { ignored: !merchant.ignored })}
              type="button"
            >
              {merchant.ignored ? "Restore" : "Ignore"}
            </button>
            <button
              className="button-link button-link-small"
              onClick={() => updateMerchant(merchant.sourceName, { displayName: merchant.sourceName })}
              type="button"
            >
              Split
            </button>
          </div>
        ))}
        {merchants.length === 0 ? <p className="empty-copy">Merchants appear after an import.</p> : null}
      </div>
    </section>
  );
}

function DataSettings({ controlState }: { controlState: PlanningControlState }) {
  return (
    <section>
      <CardHeader title="Data" subtitle="Local planning preferences and import entry points." />
      <div className="data-settings-grid">
        <Metric label="Custom goals" value={controlState.goals.length} />
        <Metric label="Budget rows" value={controlState.budgetRows.length} />
        <Metric label="Rules" value={controlState.rules.length} />
        <Metric label="Tags" value={controlState.tags.length} />
      </div>
      <div className="card-actions">
        <a className="button-link" href="#/import">Open import center</a>
        <a className="button-link button-link-secondary" href="#/budget">Open budget</a>
      </div>
    </section>
  );
}

function GoalsCard({
  controlState,
  onControlStateChange,
  planning,
}: {
  controlState: PlanningControlState;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  planning: PlanningOverview | null;
}) {
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [form, setForm] = useState({
    currentAmount: "",
    dueDate: "",
    monthlyContribution: "",
    name: "",
    targetAmount: "",
  });
  const resetForm = () => {
    setEditingGoalId(null);
    setForm({ currentAmount: "", dueDate: "", monthlyContribution: "", name: "", targetAmount: "" });
  };
  const saveGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const goal: LocalGoal = {
      currentAmount: numberFromInput(form.currentAmount),
      dueDate: form.dueDate,
      id: editingGoalId ?? makeLocalId("goal"),
      monthlyContribution: numberFromInput(form.monthlyContribution),
      name: form.name.trim() || "Untitled goal",
      targetAmount: Math.max(1, numberFromInput(form.targetAmount)),
    };
    onControlStateChange((current) => ({
      ...current,
      goals: editingGoalId
        ? current.goals.map((item) => (item.id === editingGoalId ? goal : item))
        : [goal, ...current.goals],
    }));
    resetForm();
  };
  const editGoal = (goal: LocalGoal) => {
    setEditingGoalId(goal.id);
    setForm({
      currentAmount: String(goal.currentAmount),
      dueDate: goal.dueDate,
      monthlyContribution: String(goal.monthlyContribution),
      name: goal.name,
      targetAmount: String(goal.targetAmount),
    });
  };
  const deleteGoal = (goalId: string) => {
    onControlStateChange((current) => ({
      ...current,
      goals: current.goals.filter((goal) => goal.id !== goalId),
    }));
    if (editingGoalId === goalId) resetForm();
  };

  return (
    <article className="card planning-card">
      <CardHeader
        title="Goals"
        subtitle={`${controlState.goals.length} custom · ${planning?.goals.length ?? 0} derived`}
      />
      <form className="control-form goal-form" onSubmit={saveGoal}>
        <label>
          Goal name
          <input
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Emergency fund, holiday, deposit..."
            value={form.name}
          />
        </label>
        <label>
          Target
          <input
            inputMode="decimal"
            onChange={(event) => setForm({ ...form, targetAmount: event.target.value })}
            placeholder="5000"
            value={form.targetAmount}
          />
        </label>
        <label>
          Current
          <input
            inputMode="decimal"
            onChange={(event) => setForm({ ...form, currentAmount: event.target.value })}
            placeholder="750"
            value={form.currentAmount}
          />
        </label>
        <label>
          Monthly
          <input
            inputMode="decimal"
            onChange={(event) => setForm({ ...form, monthlyContribution: event.target.value })}
            placeholder="250"
            value={form.monthlyContribution}
          />
        </label>
        <label>
          Due date
          <input
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
            type="date"
            value={form.dueDate}
          />
        </label>
        <div className="form-actions">
          <button type="submit">{editingGoalId ? "Update goal" : "Add goal"}</button>
          {editingGoalId ? (
            <button className="button-muted" onClick={resetForm} type="button">
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <CollapsibleBlock meta={`${controlState.goals.length} custom`} title="Custom goals">
        <div className="goal-list">
          {controlState.goals.map((goal) => {
            const progress = goalProgress(goal.currentAmount, goal.targetAmount);
            return (
              <div className="goal-row" key={goal.id}>
                <div className="goal-row-header">
                  <div>
                    <strong>{goal.name}</strong>
                    <small>
                      {goal.dueDate ? `Due ${goal.dueDate} · ` : ""}
                      {money(String(goal.monthlyContribution))}/mo planned
                    </small>
                  </div>
                  <span className={`status-pill status-${progress >= 100 ? "ready" : "needs_funding"}`}>
                    {progress >= 100 ? "Funded" : `${progress.toFixed(0)}%`}
                  </span>
                </div>
                <div className="progress-track" aria-label={`${goal.name} progress`}>
                  <span style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
                <div className="split-metrics">
                  <Metric label="Current" value={money(String(goal.currentAmount))} />
                  <Metric label="Target" value={money(String(goal.targetAmount))} />
                  <Metric label="Remaining" value={money(String(Math.max(0, goal.targetAmount - goal.currentAmount)))} />
                </div>
                <div className="row-actions row-actions-left">
                  <button className="button-link button-link-small" onClick={() => editGoal(goal)} type="button">
                    Edit
                  </button>
                  <button className="button-link button-link-small button-danger" onClick={() => deleteGoal(goal.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {controlState.goals.length === 0 ? <p className="empty-copy">Add your first custom goal above.</p> : null}
        </div>
      </CollapsibleBlock>
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

function BudgetPageCard({
  controlState,
  insights,
  onControlStateChange,
  periodLabel,
  planning,
  upcoming,
}: {
  controlState: PlanningControlState;
  insights: InsightsResponse | null;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  periodLabel: string;
  planning: PlanningOverview | null;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const rows = budgetRows(controlState, insights);
  const totals = budgetTotals(rows, insights);
  const spendingPlan = spendingPlanTotals(controlState, insights, upcoming, planning);
  const updateBudget = (group: string, value: string) => {
    const plannedAmount = Math.max(0, numberFromInput(value));
    onControlStateChange((current) => {
      const exists = current.budgetRows.some((row) => row.group === group);
      return {
        ...current,
        budgetRows: exists
          ? current.budgetRows.map((row) => (row.group === group ? { ...row, plannedAmount } : row))
          : [...current.budgetRows, { group, plannedAmount }],
      };
    });
  };
  const updateRollover = (group: string, value: string) => {
    const rolloverAmount = numberFromInput(value);
    onControlStateChange((current) => {
      const exists = current.rollovers.some((row) => row.group === group);
      return {
        ...current,
        rollovers: exists
          ? current.rollovers.map((row) => (row.group === group ? { ...row, rolloverAmount } : row))
          : [...current.rollovers, { group, rolloverAmount }],
      };
    });
  };

  return (
    <article className="card budget-page-card">
      <div className="budget-toolbar">
        <CardHeader title="Budget" subtitle={`${periodLabel} · plan, actual, remaining`} />
        <div className="report-controls">
          <div className="report-tabs" role="tablist" aria-label="Budget mode">
            {(["category", "flexible", "rollover"] as const).map((mode) => (
              <button
                aria-selected={controlState.budgetMode === mode}
                className={controlState.budgetMode === mode ? "active" : ""}
                key={mode}
                onClick={() => onControlStateChange((current) => ({ ...current, budgetMode: mode }))}
                role="tab"
                type="button"
              >
                {titleCase(mode)}
              </button>
            ))}
          </div>
          <a className="button-link button-link-secondary" href="#/transactions">
            Review actuals
          </a>
        </div>
      </div>
      <div className="budget-summary-grid">
        <Metric label="Income actual" value={money(String(totals.incomeActual))} />
        <Metric label="Planned outflow" value={money(String(totals.plannedOutflow))} />
        <Metric label="Actual outflow" value={money(String(totals.actualOutflow))} />
        <Metric label="Remaining" value={money(String(totals.remaining))} />
      </div>
      {controlState.budgetMode === "flexible" ? (
        <div className="spending-plan-strip">
          <Metric label="Income" value={money(String(spendingPlan.income))} />
          <Metric label="Bills/subscriptions" value={money(String(spendingPlan.obligations))} />
          <Metric label="Savings goals" value={money(String(spendingPlan.goalContributions))} />
          <Metric label="Left to spend" value={money(String(spendingPlan.leftToSpend))} />
        </div>
      ) : null}
      <p className="fine-print">
        Formula: remaining = planned outflow - actual outflow{controlState.budgetMode === "rollover" ? " + rollover" : ""}. Actuals are imported transactions for this selected period.
      </p>
      <div className="budget-table" role="table" aria-label="Monthly budget">
        <div className="budget-row budget-row-header" role="row">
          <span>Group</span>
          <span>Planned</span>
          <span>Actual</span>
          {controlState.budgetMode === "rollover" ? <span>Rollover</span> : null}
          <span>Remaining</span>
          <span>Status</span>
        </div>
        {rows.map((row) => {
          const rollover = controlState.rollovers.find((item) => item.group === row.group)?.rolloverAmount ?? 0;
          const remaining = row.plannedAmount - row.actualAmount + (controlState.budgetMode === "rollover" ? rollover : 0);
          return (
            <div className="budget-row" key={row.group} role="row">
              <div>
                <strong>{titleCase(row.group)}</strong>
                <small>{row.transactionCount} transactions</small>
              </div>
              <input
                aria-label={`Planned amount for ${titleCase(row.group)}`}
                inputMode="decimal"
                onBlur={(event) => updateBudget(row.group, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") updateBudget(row.group, event.currentTarget.value);
                }}
                placeholder="0.00"
                defaultValue={row.plannedAmount ? row.plannedAmount.toFixed(2) : ""}
              />
              <span>{money(String(row.actualAmount))}</span>
              {controlState.budgetMode === "rollover" ? (
                <input
                  aria-label={`Rollover amount for ${titleCase(row.group)}`}
                  inputMode="decimal"
                  onBlur={(event) => updateRollover(row.group, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") updateRollover(row.group, event.currentTarget.value);
                  }}
                  placeholder="0.00"
                  defaultValue={rollover ? rollover.toFixed(2) : ""}
                />
              ) : null}
              <span className={remaining >= 0 ? "positive-text" : "negative-text"}>{money(String(remaining))}</span>
              <span className={`status-pill status-${remaining >= 0 ? "ready" : "stale"}`}>
                {remaining >= 0 ? "On track" : "Over"}
              </span>
            </div>
          );
        })}
      </div>
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

function CashflowPlanningCard({
  controlState,
  dashboard,
  forecast,
  includeCandidates,
  insights,
  onControlStateChange,
  periodLabel,
  upcoming,
}: {
  controlState: PlanningControlState;
  dashboard: DashboardSummary | null;
  forecast: ForecastResponse | null;
  includeCandidates: boolean;
  insights: InsightsResponse | null;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  periodLabel: string;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const [scenarioForm, setScenarioForm] = useState({
    incomeAdjustment: "",
    name: "",
    notes: "",
    outflowAdjustment: "",
  });
  const totals = reportTotals(insights);
  const pressure = Number(dashboard?.flexible_spend_actual ?? 0) + Number(upcoming?.expected_total ?? 0);
  const cash = Number(dashboard?.cash_on_hand ?? 0);
  const pressureRatio = cash > 0 ? Math.min(100, (pressure / cash) * 100) : 0;
  const nextItems = (upcoming?.items ?? []).slice(0, 5);
  const baselineEnding = Number(forecast?.projected_ending_balance ?? dashboard?.available_after_commitments ?? 0);
  const bestScenario = controlState.scenarios[0];
  const addScenario = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onControlStateChange((current) => ({
      ...current,
      scenarios: [
        {
          id: makeLocalId("scenario"),
          incomeAdjustment: numberFromInput(scenarioForm.incomeAdjustment),
          name: scenarioForm.name.trim() || "What-if scenario",
          notes: scenarioForm.notes.trim(),
          outflowAdjustment: numberFromInput(scenarioForm.outflowAdjustment),
        },
        ...current.scenarios,
      ].slice(0, 5),
    }));
    setScenarioForm({ incomeAdjustment: "", name: "", notes: "", outflowAdjustment: "" });
  };

  return (
    <article className="card cashflow-planner-card">
      <CardHeader
        title="Cash Flow Plan"
        subtitle={`${periodLabel} · ${includeCandidates ? "candidate bills included" : "confirmed bills only"}`}
      />
      <div className="cashflow-plan-hero">
        <div>
          <span>Projected ending cash</span>
          <strong>{forecast?.projected_ending_balance ? money(forecast.projected_ending_balance) : "-"}</strong>
          <small>Lowest point {forecast?.lowest_projected_balance ? money(forecast.lowest_projected_balance) : "-"}</small>
        </div>
        <div className="cash-pressure-meter" aria-label="Cash pressure">
          <span style={{ width: `${pressureRatio}%` }} />
        </div>
      </div>
      <div className="budget-summary-grid">
        <Metric label="Income" value={money(String(totals.income))} />
        <Metric label="Outflows" value={money(String(totals.expenses))} />
        <Metric label="Bills in window" value={upcoming ? money(upcoming.expected_total) : "-"} />
        <Metric label="Cash pressure" value={`${pressureRatio.toFixed(0)}%`} />
      </div>
      <CollapsibleBlock meta={`${nextItems.length} events`} title="Next cash events">
        <CompactList
          empty="No dated cash events in this window."
          rows={nextItems.map((item) => ({
            title: item.commitment_name,
            meta: `${item.due_date} · ${titleCase(item.commitment_type)} · ${titleCase(item.commitment_status)}`,
            amount: money(item.expected_amount),
          }))}
        />
      </CollapsibleBlock>
      <CollapsibleBlock meta={`${controlState.scenarios.length} scenarios`} title="What-if scenarios">
        <form className="control-form scenario-form" onSubmit={addScenario}>
          <label>
            Scenario
            <input
              onChange={(event) => setScenarioForm({ ...scenarioForm, name: event.target.value })}
              placeholder="Lower grocery spend, extra income..."
              value={scenarioForm.name}
            />
          </label>
          <label>
            Income change
            <input
              inputMode="decimal"
              onChange={(event) => setScenarioForm({ ...scenarioForm, incomeAdjustment: event.target.value })}
              placeholder="250"
              value={scenarioForm.incomeAdjustment}
            />
          </label>
          <label>
            Outflow change
            <input
              inputMode="decimal"
              onChange={(event) => setScenarioForm({ ...scenarioForm, outflowAdjustment: event.target.value })}
              placeholder="-150"
              value={scenarioForm.outflowAdjustment}
            />
          </label>
          <label>
            Notes
            <input
              onChange={(event) => setScenarioForm({ ...scenarioForm, notes: event.target.value })}
              placeholder="Assumption"
              value={scenarioForm.notes}
            />
          </label>
          <div className="form-actions">
            <button type="submit">Add scenario</button>
          </div>
        </form>
        <div className="scenario-list">
          {controlState.scenarios.map((scenario) => {
            const ending = baselineEnding + scenario.incomeAdjustment - scenario.outflowAdjustment;
            return (
              <div className="scenario-row" key={scenario.id}>
                <div>
                  <strong>{scenario.name}</strong>
                  <small>{scenario.notes || "No notes"} · baseline {money(String(baselineEnding))}</small>
                </div>
                <Metric label="Scenario ending" value={money(String(ending))} />
                <Metric label="Change" value={money(String(ending - baselineEnding))} />
                <button
                  className="button-link button-link-small button-danger"
                  onClick={() =>
                    onControlStateChange((current) => ({
                      ...current,
                      scenarios: current.scenarios.filter((item) => item.id !== scenario.id),
                    }))
                  }
                  type="button"
                >
                  Delete
                </button>
              </div>
            );
          })}
          {controlState.scenarios.length === 0 ? <p className="empty-copy">Add a scenario to compare baseline against a what-if change.</p> : null}
        </div>
        {bestScenario ? (
          <p className="fine-print">
            Active comparison: {bestScenario.name} changes projected ending cash by{" "}
            {money(String(bestScenario.incomeAdjustment - bestScenario.outflowAdjustment))}.
          </p>
        ) : null}
      </CollapsibleBlock>
    </article>
  );
}

function PlanningSnapshotCard({
  controlState,
  dashboard,
  insights,
  planning,
}: {
  controlState: PlanningControlState;
  dashboard: DashboardSummary | null;
  insights: InsightsResponse | null;
  planning: PlanningOverview | null;
}) {
  const rows = budgetRows(controlState, insights);
  const totals = budgetTotals(rows, insights);
  const customGoal = controlState.goals[0];
  const derivedGoal = planning?.goals[0];
  const goalProgressValue = customGoal
    ? goalProgress(customGoal.currentAmount, customGoal.targetAmount)
    : Number(derivedGoal?.progress_percent ?? 0);
  return (
    <article className="card planning-snapshot-card">
      <CardHeader title="Planning Snapshot" subtitle="Budget, goals, and risk in one glance." />
      <div className="planning-snapshot-grid">
        <div className="snapshot-tile">
          <span>Budget remaining</span>
          <strong className={totals.remaining >= 0 ? "positive-text" : "negative-text"}>{money(String(totals.remaining))}</strong>
          <small>{money(String(totals.actualOutflow))} actual outflow</small>
        </div>
        <div className="snapshot-tile">
          <span>Goal progress</span>
          <strong>{goalProgressValue.toFixed(0)}%</strong>
          <small>{customGoal?.name ?? derivedGoal?.name ?? "Create a savings target"}</small>
        </div>
        <div className="snapshot-tile">
          <span>Cash after bills</span>
          <strong>{dashboard?.available_after_commitments ? money(dashboard.available_after_commitments) : "-"}</strong>
          <small>{dashboard?.decision_count ?? 0} open decisions</small>
        </div>
      </div>
      <div className="card-actions">
        <a className="button-link" href="#/budget">Open budget</a>
        <a className="button-link button-link-secondary" href="#/goals">Manage goals</a>
      </div>
    </article>
  );
}

function SpendingPlanCard({
  controlState,
  dashboard,
  insights,
  planning,
  upcoming,
}: {
  controlState: PlanningControlState;
  dashboard: DashboardSummary | null;
  insights: InsightsResponse | null;
  planning: PlanningOverview | null;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const plan = spendingPlanTotals(controlState, insights, upcoming, planning);
  return (
    <article className="card spending-plan-card">
      <CardHeader title="Spending Plan" subtitle="Income minus bills, goals, and flexible spend." />
      <div className="spending-plan-hero">
        <span>Left to spend</span>
        <strong className={plan.leftToSpend >= 0 ? "positive-text" : "negative-text"}>{money(String(plan.leftToSpend))}</strong>
        <small>{dashboard?.confidence === "ready" ? "Balance-backed planning" : "Enter balances for stronger confidence"}</small>
      </div>
      <div className="spending-plan-stack" aria-label="Spending plan waterfall">
        <span style={{ background: "#2f7d5c", width: `${planScale(plan.income, plan)}%` }} />
        <span style={{ background: "#d43c95", width: `${planScale(plan.obligations, plan)}%` }} />
        <span style={{ background: "#d99a2b", width: `${planScale(plan.goalContributions, plan)}%` }} />
        <span style={{ background: "#2587a6", width: `${planScale(Math.max(0, plan.leftToSpend), plan)}%` }} />
      </div>
      <div className="budget-summary-grid">
        <Metric label="Income" value={money(String(plan.income))} />
        <Metric label="Bills/subscriptions" value={money(String(plan.obligations))} />
        <Metric label="Savings goals" value={money(String(plan.goalContributions))} />
        <Metric label="Flexible actual" value={money(String(plan.flexibleActual))} />
      </div>
      <div className="card-actions">
        <a className="button-link" href="#/budget">Tune budget</a>
        <a className="button-link button-link-secondary" href="#/cash-flow">Scenario plan</a>
      </div>
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
  controlState,
  insights,
  periodLabel,
}: {
  controlState?: PlanningControlState;
  insights: InsightsResponse | null;
  periodLabel?: string;
}) {
  const merchants = mergedMerchants(insights?.top_merchants ?? [], controlState).slice(0, 5);
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
      {merchants.length > 0 ? (
        <CollapsibleBlock meta={`${merchants.length} merchants`} title="Top merchants">
          <CompactList
            empty="No merchant spend in range."
            rows={merchants.map((merchant) => ({
              title: merchant.label,
              meta: `${merchant.transaction_count} transactions`,
              amount: money(String(merchant.value)),
            }))}
          />
        </CollapsibleBlock>
      ) : null}
    </article>
  );
}

function ExportsCard({
  controlState,
  insights,
  periodLabel,
  planning,
  transactions,
}: {
  controlState: PlanningControlState;
  insights: InsightsResponse | null;
  periodLabel: string;
  planning: PlanningOverview | null;
  transactions: TransactionsResponse | null;
}) {
  const rows = budgetRows(controlState, insights);
  const exportTransactions = () => {
    downloadCsv(
      "transactions-export.csv",
      ["date", "merchant", "account", "group", "type", "amount", "reviewed"],
      (transactions?.transactions ?? []).map((transaction) => [
        transaction.date,
        transaction.merchant_name || transaction.description,
        `${transaction.provider} ${transaction.account_name}`,
        transaction.normalized_group,
        transaction.transaction_type,
        transaction.amount,
        String(transaction.reviewed),
      ]),
    );
  };
  const exportBudget = () => {
    downloadCsv(
      "budget-export.csv",
      ["period", "group", "planned", "actual", "remaining", "mode"],
      rows.map((row) => [
        periodLabel,
        row.group,
        row.plannedAmount.toFixed(2),
        row.actualAmount.toFixed(2),
        (row.plannedAmount - row.actualAmount).toFixed(2),
        controlState.budgetMode,
      ]),
    );
  };
  const exportMonthlyReview = () => {
    const review = planning?.monthly_review;
    downloadCsv(
      "monthly-review-export.csv",
      ["start", "end", "income", "outflows", "net", "reviewed", "unreviewed", "decisions"],
      review
        ? [[
            review.start_date,
            review.end_date,
            review.income_total,
            review.outflow_total,
            review.net_total,
            String(review.reviewed_count),
            String(review.unreviewed_count),
            String(review.decision_count),
          ]]
        : [],
    );
  };
  const exportReport = () => {
    downloadCsv(
      "report-summary-export.csv",
      ["period", "group", "transactions", "inflow", "outflow", "net"],
      (insights?.category_groups ?? []).map((group) => [
        periodLabel,
        group.group,
        String(group.transaction_count),
        group.inflow_total,
        group.outflow_total,
        group.net_total,
      ]),
    );
  };

  return (
    <article className="card export-card">
      <CardHeader title="Exports" subtitle="Download the current local view as CSV." />
      <div className="export-button-grid">
        <button onClick={exportTransactions} type="button">Transactions CSV</button>
        <button onClick={exportBudget} type="button">Budget CSV</button>
        <button onClick={exportMonthlyReview} type="button">Monthly review CSV</button>
        <button onClick={exportReport} type="button">Report CSV</button>
      </div>
      <p className="fine-print">Exports use the currently loaded period, filters, and local planning settings.</p>
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

const planningControlStorageKey = "personal-finance-studio.phase-1-75-controls";

const defaultPlanningControlState: PlanningControlState = {
  budgetMode: "category",
  budgetRows: [
    { group: "debt", plannedAmount: 0 },
    { group: "fixed", plannedAmount: 0 },
    { group: "flexible", plannedAmount: 500 },
    { group: "non_monthly", plannedAmount: 0 },
  ],
  categories: [
    { group: "income", id: "category-paychecks", name: "Paychecks", type: "income" },
    { group: "fixed", id: "category-home", name: "Home & utilities", type: "expense" },
    { group: "flexible", id: "category-groceries", name: "Groceries", type: "expense" },
    { group: "debt", id: "category-debt", name: "Debt payments", type: "expense" },
  ],
  goals: [],
  merchants: [],
  rollovers: [],
  rules: [
    {
      action: "fixed",
      condition: "subscription",
      id: "rule-subscriptions",
      name: "If merchant contains subscription",
      tag: "Subscription",
    },
  ],
  ruleApplications: [],
  scenarios: [],
  tags: [
    { color: "#365bdc", id: "tag-tax", name: "Tax" },
    { color: "#2aaed1", id: "tag-reimburse", name: "Reimburse" },
    { color: "#f5bd22", id: "tag-subscription", name: "Subscription" },
  ],
};

function readPlanningControlState(): PlanningControlState {
  try {
    const raw = window.localStorage.getItem(planningControlStorageKey);
    if (!raw) return defaultPlanningControlState;
    return { ...defaultPlanningControlState, ...JSON.parse(raw) } as PlanningControlState;
  } catch {
    return defaultPlanningControlState;
  }
}

function writePlanningControlState(state: PlanningControlState) {
  try {
    window.localStorage.setItem(planningControlStorageKey, JSON.stringify(state));
  } catch {
    // Local preferences are helpful but should not block the finance UI.
  }
}

function makeLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function numberFromInput(value: string) {
  const normalized = value.replace(/[£,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function goalProgress(currentAmount: number, targetAmount: number) {
  if (targetAmount <= 0) return 0;
  return Math.min(100, (Math.max(0, currentAmount) / targetAmount) * 100);
}

function budgetRows(controlState: PlanningControlState, insights: InsightsResponse | null) {
  const insightRows = (insights?.category_groups ?? [])
    .filter((group) => !["income", "transfer", "ignored"].includes(group.group))
    .map((group) => ({
      actualAmount: Math.abs(Number(group.outflow_total)),
      group: group.group,
      plannedAmount: controlState.budgetRows.find((row) => row.group === group.group)?.plannedAmount ?? 0,
      transactionCount: group.transaction_count,
    }));
  const extraRows = controlState.budgetRows
    .filter((row) => !insightRows.some((insight) => insight.group === row.group))
    .map((row) => ({
      actualAmount: 0,
      group: row.group,
      plannedAmount: row.plannedAmount,
      transactionCount: 0,
    }));
  return [...insightRows, ...extraRows].sort((a, b) => {
    const order = ["debt", "fixed", "flexible", "non_monthly", "needs_review"];
    return (order.indexOf(a.group) === -1 ? 99 : order.indexOf(a.group)) - (order.indexOf(b.group) === -1 ? 99 : order.indexOf(b.group));
  });
}

function budgetTotals(
  rows: Array<{ actualAmount: number; group: string; plannedAmount: number; transactionCount: number }>,
  insights: InsightsResponse | null,
) {
  const incomeActual = (insights?.category_groups ?? [])
    .filter((group) => group.group === "income")
    .reduce((sum, group) => sum + Number(group.inflow_total), 0);
  const plannedOutflow = rows.reduce((sum, row) => sum + row.plannedAmount, 0);
  const actualOutflow = rows.reduce((sum, row) => sum + row.actualAmount, 0);
  return {
    actualOutflow,
    incomeActual,
    plannedOutflow,
    remaining: plannedOutflow - actualOutflow,
  };
}

function spendingPlanTotals(
  controlState: PlanningControlState,
  insights: InsightsResponse | null,
  upcoming: UpcomingCommitmentsResponse | null,
  planning: PlanningOverview | null,
) {
  const totals = reportTotals(insights);
  const obligations = Math.abs(Number(upcoming?.expected_total ?? 0));
  const goalContributions =
    controlState.goals.reduce((sum, goal) => sum + goal.monthlyContribution, 0) +
    (planning?.goals ?? []).reduce((sum, goal) => sum + Number(goal.monthly_contribution), 0);
  const flexibleActual = (insights?.category_groups ?? [])
    .filter((group) => group.group === "flexible")
    .reduce((sum, group) => sum + Math.abs(Number(group.outflow_total)), 0);
  return {
    flexibleActual,
    goalContributions,
    income: totals.income,
    leftToSpend: totals.income - obligations - goalContributions - flexibleActual,
    obligations,
  };
}

function planScale(value: number, plan: ReturnType<typeof spendingPlanTotals>) {
  const max = Math.max(plan.income, plan.obligations, plan.goalContributions, Math.abs(plan.leftToSpend), 1);
  return Math.max(6, Math.min(100, (Math.abs(value) / max) * 100));
}

function ruleMatches(rule: RuleSetting, transactions: TransactionsResponse["transactions"]) {
  const condition = rule.condition.trim().toLowerCase();
  if (!condition) return [];
  return transactions.filter((transaction) =>
    `${transaction.merchant_name} ${transaction.description} ${transaction.source_category}`
      .toLowerCase()
      .includes(condition),
  );
}

function transactionTypeForGroup(group: string, transaction: TransactionsResponse["transactions"][number]) {
  if (group === "income") return "income";
  if (group === "debt") return "debt_payment";
  if (group === "transfer") return "internal_transfer_candidate";
  if (group === "ignored") return "ignored";
  return transaction.amount.startsWith("-") ? "spending" : "income";
}

function merchantDisplayName(sourceName: string, controlState?: PlanningControlState) {
  const setting = controlState?.merchants.find((merchant) => merchant.sourceName === sourceName);
  if (!setting || setting.ignored) return setting?.ignored ? "" : sourceName;
  return setting.displayName.trim() || sourceName;
}

function mergedMerchants(
  merchants: MerchantInsight[],
  controlState?: PlanningControlState,
): Array<{ label: string; transaction_count: number; value: number }> {
  const groups = merchants.reduce<Record<string, { label: string; transaction_count: number; value: number }>>((acc, merchant) => {
    const label = merchantDisplayName(merchant.merchant_name, controlState);
    if (!label) return acc;
    const existing = acc[label] ?? { label, transaction_count: 0, value: 0 };
    existing.transaction_count += merchant.transaction_count;
    existing.value += Math.abs(Number(merchant.outflow_total));
    acc[label] = existing;
    return acc;
  }, {});
  return Object.values(groups).sort((a, b) => b.value - a.value);
}

function mergedMerchantBreakdowns(
  insights: InsightsResponse | null,
  groupName: string,
  controlState?: PlanningControlState,
): Array<{ label: string; transaction_count: number; value: number }> {
  const groups = (insights?.merchant_breakdowns ?? [])
    .filter((merchant) => merchant.group === groupName)
    .reduce<Record<string, { label: string; transaction_count: number; value: number }>>((acc, merchant) => {
      const label = merchantDisplayName(merchant.merchant_name, controlState);
      if (!label) return acc;
      const existing = acc[label] ?? { label, transaction_count: 0, value: 0 };
      existing.transaction_count += merchant.transaction_count;
      existing.value += Math.abs(Number(merchant.outflow_total));
      acc[label] = existing;
      return acc;
    }, {});
  return Object.values(groups).sort((a, b) => b.value - a.value);
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const body = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function merchantSettingsRows(controlState: PlanningControlState, insights: InsightsResponse | null): MerchantSetting[] {
  const imported = (insights?.top_merchants ?? []).map((merchant) => merchant.merchant_name);
  const allNames = [...new Set([...imported, ...controlState.merchants.map((merchant) => merchant.sourceName)])];
  return allNames.map((sourceName) => {
    const existing = controlState.merchants.find((merchant) => merchant.sourceName === sourceName);
    return {
      categoryGroup: existing?.categoryGroup ?? "flexible",
      displayName: existing?.displayName ?? sourceName,
      id: existing?.id ?? sourceName,
      ignored: existing?.ignored ?? false,
      sourceName,
    };
  });
}

function currentRoute(): RouteId {
  return parseHashState().route;
}

function parseHashState(): { params: URLSearchParams; route: RouteId } {
  const rawHash = window.location.hash.replace(/^#\/?/, "");
  const [rawRoute, query = ""] = rawHash.split("?");
  const route = routeItems.some((item) => item.route === rawRoute) ? (rawRoute as RouteId) : "dashboard";
  return { params: new URLSearchParams(query), route };
}

function initialSearchQuery() {
  return parseHashState().params.get("search") ?? "";
}

function initialPeriodPreset(): PeriodPreset {
  const range = parseHashState().params.get("range");
  return isPeriodPreset(range) ? range : "this-month";
}

function initialCustomStartDate() {
  const start = parseHashState().params.get("start");
  return start && isIsoDate(start) ? start : todayIso();
}

function initialCustomEndDate() {
  const end = parseHashState().params.get("end");
  return end && isIsoDate(end) ? end : addDays(todayIso(), 30);
}

function initialIncludeCandidates() {
  return parseHashState().params.get("includeCandidates") !== "false";
}

function initialTransactionFilters(): TransactionFilterState {
  const params = parseHashState().params;
  const reviewed = params.get("reviewed");
  return {
    accountId: params.get("account") ?? "",
    normalizedGroup: params.get("group") ?? "",
    reviewed: isReviewFilter(reviewed) ? reviewed : "all",
    status: params.get("status") ?? "",
    transactionType: params.get("type") ?? "",
  };
}

function initialReportView(): ReportView {
  const report = parseHashState().params.get("report");
  return isReportView(report) ? report : "cash-flow";
}

function initialReportGroupBy(): ReportGroupBy {
  const params = parseHashState().params;
  const groupBy = params.get("groupBy");
  if (isReportGroupBy(groupBy)) return groupBy;
  return initialReportView() === "income" ? "merchant" : "category";
}

function buildHashState({
  customEndDate,
  customStartDate,
  includeCandidates,
  periodPreset,
  reportGroupBy,
  reportView,
  route,
  searchQuery,
  transactionFilters,
}: {
  customEndDate: string;
  customStartDate: string;
  includeCandidates: boolean;
  periodPreset: PeriodPreset;
  reportGroupBy: ReportGroupBy;
  reportView: ReportView;
  route: RouteId;
  searchQuery: string;
  transactionFilters: TransactionFilterState;
}) {
  const params = new URLSearchParams();
  params.set("range", periodPreset);
  if (periodPreset === "custom") {
    params.set("start", customStartDate);
    params.set("end", customEndDate);
  }
  if (candidateToggleApplies(route) && !includeCandidates) params.set("includeCandidates", "false");
  if (searchQuery.trim()) params.set("search", searchQuery.trim());
  if (route === "transactions") {
    if (transactionFilters.accountId) params.set("account", transactionFilters.accountId);
    if (transactionFilters.normalizedGroup) params.set("group", transactionFilters.normalizedGroup);
    if (transactionFilters.reviewed !== "all") params.set("reviewed", transactionFilters.reviewed);
    if (transactionFilters.status) params.set("status", transactionFilters.status);
    if (transactionFilters.transactionType) params.set("type", transactionFilters.transactionType);
  }
  if (route === "reports") {
    params.set("report", reportView);
    params.set("groupBy", reportGroupBy);
  }
  const query = params.toString();
  return query ? `#/${route}?${query}` : `#/${route}`;
}

function candidateToggleApplies(route: RouteId) {
  return ["dashboard", "cash-flow", "calendar", "recurring", "reports", "monthly-review"].includes(route);
}

function isPeriodPreset(value: string | null): value is PeriodPreset {
  return periodOptions.some((option) => option.value === value);
}

function isReportView(value: string | null): value is ReportView {
  return value === "cash-flow" || value === "income" || value === "spending";
}

function isReportGroupBy(value: string | null): value is ReportGroupBy {
  return value === "category" || value === "merchant";
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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
  children: ReportGroupChild[];
  color: string;
  id: string;
  label: string;
  transactionCount: number;
  value: number;
};

type ReportGroupChild = {
  color: string;
  id: string;
  label: string;
  transactionCount: number;
  value: number;
};

type SankeyNodeModel = {
  anchor: "end" | "start";
  color: string;
  emphasis?: "middle" | "normal";
  expandable: boolean;
  groupId?: string;
  height: number;
  id: string;
  label: string;
  labelX: number;
  labelY: number;
  percent: string;
  selected: boolean;
  transactionCount: number;
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
  expandable?: boolean;
  groupId?: string;
  id: string;
  label: string;
  layer: number;
  percent: string;
  selected?: boolean;
  transactionCount?: number;
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
  controlState?: PlanningControlState,
): ReportGroup[] {
  if (view === "income") {
    const income = (insights?.category_groups ?? []).find((group) => group.group === "income");
    const incomeSources = (insights?.income_sources ?? [])
      .map((source, index) => ({
        children: [],
        color: paletteColor(index),
        id: `income-${slugId(source.source_name)}`,
        label: source.source_name,
        transactionCount: source.transaction_count,
        value: Number(source.inflow_total),
      }))
      .filter((group) => group.value > 0)
      .sort((a, b) => b.value - a.value);
    if (incomeSources.length > 0 && groupBy === "merchant") return incomeSources.slice(0, 6);

    return [
      {
        children: [],
        color: "#159bbd",
        id: "income",
        label: "Paychecks",
        transactionCount: income?.transaction_count ?? 0,
        value: Number(income?.inflow_total ?? 0),
      },
    ].filter((group) => group.value > 0);
  }

  if (groupBy === "merchant") {
    const merged = mergedMerchants(insights?.top_merchants ?? [], controlState);
    const topMerchants = merged
      .map((merchant, index) => ({
        children: [],
        color: paletteColor(index),
        id: `merchant-${slugId(merchant.label)}`,
        label: merchant.label,
        transactionCount: merchant.transaction_count,
        value: merchant.value,
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
            children: [],
            color: "#9aa19a",
            id: "merchant-other",
            label: "Other merchants",
            transactionCount: 0,
            value: otherTotal,
          },
        ]
      : topMerchants;
  }

  return (insights?.category_groups ?? [])
    .filter((group) => !["income", "transfer", "ignored"].includes(group.group))
    .map((group) => {
      const children = merchantBreakdownForGroup(insights, group.group, controlState);
      return {
        children,
        color: categoryColor(group.group),
        id: group.group,
        label: titleCase(group.group),
        transactionCount: group.transaction_count,
        value: Math.abs(Number(group.outflow_total)),
      };
    })
    .filter((group) => group.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function merchantBreakdownForGroup(
  insights: InsightsResponse | null,
  groupName: string,
  controlState?: PlanningControlState,
): ReportGroupChild[] {
  const merchants = mergedMerchantBreakdowns(insights, groupName, controlState)
    .map((merchant, index) => ({
      color: paletteColor(index),
      id: `${groupName}-${slugId(merchant.label)}`,
      label: merchant.label,
      transactionCount: merchant.transaction_count,
      value: merchant.value,
    }))
    .filter((merchant) => merchant.value > 0)
    .sort((a, b) => b.value - a.value);
  const top = merchants.slice(0, 5);
  const otherValue = merchants.slice(5).reduce((sum, merchant) => sum + merchant.value, 0);
  const otherCount = merchants.slice(5).reduce((sum, merchant) => sum + merchant.transactionCount, 0);
  return otherValue > 1
    ? [
        ...top,
        {
          color: "#9aa19a",
          id: `${groupName}-other`,
          label: "Other merchants",
          transactionCount: otherCount,
          value: otherValue,
        },
      ]
    : top;
}

function buildSankeyGeometry({
  expandedGroupId,
  expenses,
  groups,
  income,
  savings,
  view,
}: {
  expandedGroupId: string | null;
  expenses: number;
  groups: ReportGroup[];
  income: number;
  savings: number;
  view: "cash-flow" | "income" | "spending";
}): { flows: SankeyFlowModel[]; nodes: SankeyNodeModel[] } {
  if (view === "income" && groups.length === 0 && income <= 0) {
    return { flows: [], nodes: [] };
  }
  const destinations =
    view === "cash-flow" && savings > 0
      ? [
          {
            children: [],
            color: "#2f7d5c",
            id: "savings",
            label: "Savings",
            transactionCount: 0,
            value: savings,
          },
          ...groups,
        ]
      : groups;
  const graph = buildD3SankeyGraph({ destinations, expandedGroupId, expenses, income, savings, view });
  const layout = createSankey<SankeyD3Node, SankeyD3Link>()
    .nodeId((node) => node.id)
    .nodeAlign((node) => node.layer)
    .nodeWidth(20)
    .nodePadding(destinationNodeCount(destinations, expandedGroupId) > 8 ? 28 : destinations.length > 5 ? 34 : 46)
    .nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .extent([[80, 76], [1040, 548]])
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
  expandedGroupId,
  expenses,
  income,
  savings,
  view,
}: {
  destinations: ReportGroup[];
  expandedGroupId: string | null;
  expenses: number;
  income: number;
  savings: number;
  view: "cash-flow" | "income" | "spending";
}): SankeyGraph<SankeyD3Node, SankeyD3Link> {
  const destinationTotal = destinations.reduce((total, group) => total + group.value, 0);

  if (view === "income") {
    const totalIncome = Math.max(income, destinationTotal, 1);
    return {
      nodes: [
        ...destinations.map((group) => ({
          color: group.color,
          displayValue: group.value,
          id: `income-source-${group.id}`,
          label: group.label,
          layer: 0,
          percent: percentage(group.value, totalIncome),
          transactionCount: group.transactionCount,
          value: group.value,
        })),
        {
          color: "#159bbd",
          displayValue: totalIncome,
          emphasis: "middle",
          id: "income-total",
          label: "Total income",
          layer: 1,
          percent: "",
          value: totalIncome,
        },
        {
          color: "#2aaed1",
          displayValue: totalIncome,
          id: "available",
          label: "Available funds",
          layer: 2,
          percent: "",
          value: totalIncome,
        },
      ],
      links: [
        ...destinations.map((group) => ({
          color: group.color,
          id: `income-source-${group.id}`,
          label: group.label,
          opacity: 0.46,
          source: `income-source-${group.id}`,
          target: "income-total",
          value: group.value,
        })),
        {
          color: "#b8eadb",
          id: "income-available",
          label: "Total income to available funds",
          opacity: 0.72,
          source: "income-total",
          target: "available",
          value: totalIncome,
        },
      ],
    };
  }

  if (view === "spending") {
    const nodes: SankeyD3Node[] = [
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
    ];
    const links: SankeyD3Link[] = [];
    for (const group of destinations) {
      const destinationId = `destination-${group.id}`;
      const isExpanded = group.id === expandedGroupId && group.children.length > 0;
      nodes.push({
        color: group.color,
        displayValue: group.value,
        expandable: group.children.length > 0,
        groupId: group.id,
        id: destinationId,
        layer: 1,
        label: group.label,
        percent: percentage(group.value, expenses),
        selected: isExpanded,
        transactionCount: group.transactionCount,
        value: group.value,
      });
      links.push({
        color: group.color,
        id: `expense-${group.id}`,
        label: group.label,
        opacity: 0.42,
        source: "outflow",
        target: destinationId,
        value: group.value,
      });
      if (isExpanded) {
        for (const child of group.children) {
          const childId = `child-${child.id}`;
          nodes.push({
            color: child.color,
            displayValue: child.value,
            id: childId,
            layer: 2,
            label: child.label,
            percent: percentage(child.value, group.value),
            transactionCount: child.transactionCount,
            value: child.value,
          });
          links.push({
            color: child.color,
            id: `expense-${group.id}-${child.id}`,
            label: child.label,
            opacity: 0.48,
            source: destinationId,
            target: childId,
            value: child.value,
          });
        }
      }
    }
    return {
      links,
      nodes,
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
      const destinationId = `destination-${group.id}`;
      const isExpanded = group.id === expandedGroupId && group.children.length > 0;
      nodes.push({
        color: group.color,
        displayValue: group.value,
        expandable: group.children.length > 0,
        groupId: group.id,
        id: destinationId,
        layer: 3,
        label: group.label,
        percent: group.label === "Savings" ? percentage(group.value, income || savings) : percentage(group.value, expenses),
        selected: isExpanded,
        transactionCount: group.transactionCount,
        value: group.value,
      });
      const isSavings = group.label === "Savings";
      links.push({
        color: group.color,
        id: `allocated-${group.id}`,
        label: group.label,
        opacity: isSavings ? 0.32 : 0.42,
        source: isSavings ? "available" : "outflow",
        target: destinationId,
        value: group.value,
      });
      if (isExpanded) {
        for (const child of group.children) {
          const childId = `child-${child.id}`;
          nodes.push({
            color: child.color,
            displayValue: child.value,
            id: childId,
            layer: 4,
            label: child.label,
            percent: percentage(child.value, group.value),
            transactionCount: child.transactionCount,
            value: child.value,
          });
          links.push({
            color: child.color,
            id: `allocated-${group.id}-${child.id}`,
            label: child.label,
            opacity: 0.48,
            source: destinationId,
            target: childId,
            value: child.value,
          });
        }
      }
    }
  }

  return { links, nodes };
}

function percentage(value: number, total: number) {
  if (total <= 0) return "";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function destinationNodeCount(destinations: ReportGroup[], expandedGroupId: string | null) {
  return destinations.reduce(
    (count, group) => count + 1 + (group.id === expandedGroupId ? group.children.length : 0),
    0,
  );
}

function d3SankeyNodeToModel(node: SankeyNode<SankeyD3Node, SankeyD3Link>): SankeyNodeModel {
  const x = node.x0 ?? 0;
  const y = node.y0 ?? 0;
  const height = Math.max(12, (node.y1 ?? y + 12) - y);
  const isDestination = (node.depth ?? 0) >= 2 || node.id.startsWith("destination-") || node.id.startsWith("child-");
  return {
    anchor: node.emphasis === "middle" ? "end" : isDestination ? "end" : "start",
    color: node.color,
    emphasis: node.emphasis,
    expandable: Boolean(node.expandable),
    groupId: node.groupId,
    height,
    id: node.id,
    label: compactLabel(node.label),
    labelX: node.emphasis === "middle" ? x - 16 : isDestination ? x - 14 : (node.x1 ?? x) + 22,
    labelY: labelYFor(y, height),
    percent: node.percent,
    selected: Boolean(node.selected),
    transactionCount: node.transactionCount ?? 0,
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

function slugId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
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

function isReviewFilter(value: string | null): value is TransactionFilterState["reviewed"] {
  return value === "all" || value === "reviewed" || value === "unreviewed";
}

function savedFilterHref(filter: { query: string; route: string }) {
  return filter.query ? `#/${filter.route}?${filter.query}` : `#/${filter.route}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
