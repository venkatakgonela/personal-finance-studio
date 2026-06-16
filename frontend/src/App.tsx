import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSwappingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAutoAnimate } from "@formkit/auto-animate/react";
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
  type CommitmentCreate,
  type CommitmentUpdate,
  type CommitmentsResponse,
  type DashboardSummary,
  type DecisionQueueResponse,
  type ForecastResponse,
  type FreeAgentBankAccount,
  type FreeAgentConnectionStatus,
  type FreeAgentCredentials,
  type FreeAgentImportResult,
  type HealthResponse,
  type ImportCommitResult,
  type ImportPreview,
  type InsightsResponse,
  type MerchantInsight,
  type PlanningOverview,
  type TransactionFilters,
  type TransactionSummary,
  type TransactionUpdate,
  type TransactionsResponse,
  type TransferDetectionResult,
  type UpcomingCommitmentsResponse,
  commitSnoopImport,
  createCommitment,
  exchangeFreeAgentOAuthCode,
  confirmDecision,
  detectCommitments,
  detectTransfers,
  getAccounts,
  getCommitments,
  getDashboardSummary,
  getDecisions,
  getForecast,
  getFreeAgentBankAccounts,
  getFreeAgentStatus,
  getHealth,
  getInsights,
  getPlanningOverview,
  getTransactions,
  getUpcomingCommitments,
  importFreeAgentTransactions,
  markBillInstancePaid,
  previewSnoopImport,
  rejectDecision,
  resetImportedData,
  saveFreeAgentCredentials,
  updateAccount,
  updateCommitment,
  updateTransaction,
  validateFreeAgent,
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
type CommitmentDraft = {
  amount: string;
  category: string;
  endDate: string;
  frequency: string;
  name: string;
  nextDueDate: string;
  occurrenceCount: string;
  sourceTransactionId: string;
  sourceTransactionLabel: string;
  type: string;
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
type BudgetSection = "overview" | "plan" | "envelopes" | "assumptions" | "review";
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
type PlanningAssumptions = {
  expectedIncomeAmount: number;
  expectedIncomeLabel: string;
  incomeConfidence: "stable" | "variable" | "changing";
  jobChangeExpected: boolean;
  knownUpcomingCosts: number;
  lifestyleAllowance: number;
  lookbackMonths: "1" | "3" | "6";
  oneOffIncomeExclusions: number;
  safetyBuffer: number;
};
type CustomDashboardWidget = {
  accent: "blue" | "green" | "amber";
  body: string;
  id: string;
  title: string;
  value: string;
};
type PlanningControlState = {
  budgetMode: BudgetMode;
  budgetRows: BudgetPlanRow[];
  categories: CategorySetting[];
  customDashboardWidgets: CustomDashboardWidget[];
  dashboardWidgetOrder: string[];
  hiddenDashboardWidgets: string[];
  ruleApplications: RuleApplicationSnapshot[];
  scenarios: CashflowScenario[];
  goals: LocalGoal[];
  merchants: MerchantSetting[];
  planningAssumptions: PlanningAssumptions;
  rollovers: BudgetRolloverRow[];
  rules: RuleSetting[];
  tags: TagSetting[];
};

const defaultDashboardWidgetIds = [
  "cash-position",
  "spending-plan",
  "upcoming",
  "spending",
  "planning-snapshot",
  "decision-queue",
  "review-focus",
  "cashflow",
];

const budgetSections: Array<{ id: BudgetSection; label: string; summary: string }> = [
  { id: "overview", label: "Overview", summary: "Spend boundary and confidence" },
  { id: "plan", label: "Monthly plan", summary: "Income, bills, goals, allowance" },
  { id: "envelopes", label: "Envelopes", summary: "Category budgets and rollovers" },
  { id: "assumptions", label: "Assumptions", summary: "Known changes and safety buffer" },
  { id: "review", label: "Review", summary: "Actuals and next actions" },
];

const dashboardDropAnimation = {
  duration: 320,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
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
  { label: "FreeAgent", route: "freeagent" },
  { label: "Import", route: "import" },
  { label: "Settings", route: "settings" },
] as const;

const navItems = routeItems.filter((item) => item.route !== "import" && item.route !== "settings");

type RouteId = (typeof routeItems)[number]["route"];

const pageTitles: Record<RouteId, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Household workspace", title: "Good day." },
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
  freeagent: { eyebrow: "FreeAgent", title: "Connect live bank data safely." },
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
  const [userName, setUserName] = useState(() => readUserName());
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
  const pageTitle = getPageTitle(route, userName);
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

  useEffect(() => {
    writeUserName(userName);
  }, [userName]);

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
    setError(null);
  }

  function saveUserName(nextName: string) {
    setUserName(cleanUserName(nextName));
  }

  async function runResetAppData() {
    const confirmed = window.confirm(
      "Reset imported data, local planning preferences, and your saved name? This cannot be undone.",
    );
    if (!confirmed) return;

    setError(null);
    setLoadState("loading");
    try {
      await resetImportedData();
      clearLocalWorkspacePreferences();
      setSelectedFile(null);
      setPreview(null);
      setCommitResult(null);
      setAccounts(null);
      setTransactions(null);
      setTransferResult(null);
      setCommitmentResult(null);
      setCommitments(null);
      setDecisions(null);
      setDashboard(null);
      setUpcoming(null);
      setForecast(null);
      setInsights(null);
      setPlanning(null);
      setControlState(defaultPlanningControlState);
      setUserName("");
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
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

  async function runAccountBalanceUpdate(
    accountId: string,
    balance: string,
    accountType: string,
    overdraftLimit: string,
  ) {
    setError(null);
    setLoadState("loading");
    try {
      await updateAccount(accountId, {
        account_type: accountType,
        current_balance: balance,
        overdraft_limit: overdraftLimit || "0.00",
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

  async function runCommitmentUpdate(commitmentId: string, payload: CommitmentUpdate) {
    setError(null);
    setLoadState("loading");
    try {
      await updateCommitment(commitmentId, payload);
      await refreshWorkspace();
      setLoadState("ready");
    } catch (err) {
      setError(errorMessage(err));
      setLoadState("error");
    }
  }

  async function runCommitmentCreate(payload: CommitmentCreate) {
    setError(null);
    try {
      await createCommitment(payload);
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
      <Sidebar currentRoute={route} userName={userName} />
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
          userName={userName}
          onControlStateChange={setControlState}
          onHealthCheck={checkApiHealth}
          onResetAppData={runResetAppData}
          onAccountBalanceUpdate={runAccountBalanceUpdate}
          onBillPaid={runBillPaid}
          onCommit={runCommit}
          onCommitmentCreate={runCommitmentCreate}
          onCommitmentUpdate={runCommitmentUpdate}
          onDecisionAction={runDecisionAction}
          onDetectCommitments={runCommitmentDetection}
          onDetectTransfers={runTransferDetection}
          onPreview={runPreview}
          onRefreshWorkspace={refreshWorkspace}
          onUserNameSave={saveUserName}
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

function Sidebar({ currentRoute, userName }: { currentRoute: RouteId; userName: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [entityContext, setEntityContext] = useState<"household" | "business">("household");
  const displayName = userName || "Workspace";
  const avatar = displayName.slice(0, 1).toUpperCase();
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
            <div className="entity-switcher" aria-label="Workspace context">
              <button
                aria-pressed={entityContext === "household"}
                onClick={() => setEntityContext("household")}
                type="button"
              >
                Household
              </button>
              <button
                aria-pressed={entityContext === "business"}
                onClick={() => setEntityContext("business")}
                type="button"
              >
                Business
              </button>
            </div>
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
          <span>{avatar}</span>
          <div>
            <strong>{displayName}</strong>
            <small>{entityContext === "household" ? "Household" : "Business preview"}</small>
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
            aria-label="Include bill candidates"
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
  userName,
  onControlStateChange,
  onHealthCheck,
  onResetAppData,
  onAccountBalanceUpdate,
  onBillPaid,
  onCommit,
  onCommitmentCreate,
  onCommitmentUpdate,
  onDecisionAction,
  onDetectCommitments,
  onDetectTransfers,
  onPreview,
  onRefreshWorkspace,
  onUserNameSave,
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
  userName: string;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  onHealthCheck: () => Promise<void>;
  onResetAppData: () => Promise<void>;
  onAccountBalanceUpdate: (
    accountId: string,
    balance: string,
    accountType: string,
    overdraftLimit: string,
  ) => Promise<void>;
  onBillPaid: (instanceId: string, amount: string) => Promise<void>;
  onCommit: () => Promise<void>;
  onCommitmentCreate: (payload: CommitmentCreate) => Promise<void>;
  onCommitmentUpdate: (commitmentId: string, payload: CommitmentUpdate) => Promise<void>;
  onDecisionAction: (
    action: "confirm" | "reject",
    decisionType: string,
    decisionId: string,
  ) => Promise<void>;
  onDetectCommitments: () => Promise<void>;
  onDetectTransfers: () => Promise<void>;
  onPreview: (file: File) => Promise<void>;
  onRefreshWorkspace: () => Promise<void>;
  onUserNameSave: (name: string) => void;
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
          onCommitmentCreate={onCommitmentCreate}
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
          dashboard={dashboard}
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
          onCommitmentCreate={onCommitmentCreate}
          onCommitmentUpdate={onCommitmentUpdate}
          query={query}
          transactions={transactions}
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
          onResetAppData={onResetAppData}
          onTransactionUpdate={onTransactionUpdate}
          transactions={transactions}
        />
      </section>
    );
  }

  if (route === "freeagent") {
    return (
      <section className="page-grid page-grid-single" aria-label="FreeAgent integration page">
        <FreeAgentIntegrationCard onImported={onRefreshWorkspace} />
      </section>
    );
  }

  if (route === "import") {
    return (
      <section className="import-page-grid" aria-label="Import page">
        <div className="import-onboarding-stack">
          <NameSetupCard onSave={onUserNameSave} userName={userName} />
          <ImportFreshnessCard planning={planning} />
        </div>
        <GettingStartedCard
          accounts={accounts}
          busy={busy}
          canImport={Boolean(userName)}
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
      </section>
    );
  }

  return (
    <DashboardWidgets
      busy={busy}
      commitmentResult={commitmentResult}
      commitments={commitments}
      controlState={controlState}
      dashboard={dashboard}
      decisions={decisions}
      forecast={forecast}
      includeCandidates={includeCandidates}
      insights={insights}
      onBillPaid={onBillPaid}
      onControlStateChange={onControlStateChange}
      onDecisionAction={onDecisionAction}
      periodKind={periodKind}
      periodLabel={periodLabel}
      planning={planning}
      preview={preview}
      query={query}
      transactions={transactions}
      transferResult={transferResult}
      upcoming={upcoming}
    />
  );
}

function DashboardWidgets({
  busy,
  commitmentResult,
  commitments,
  controlState,
  dashboard,
  decisions,
  forecast,
  includeCandidates,
  insights,
  onBillPaid,
  onControlStateChange,
  onDecisionAction,
  periodKind,
  periodLabel,
  planning,
  preview,
  query,
  transactions,
  transferResult,
  upcoming,
}: {
  busy: boolean;
  commitmentResult: CommitmentDetectionResult | null;
  commitments: CommitmentsResponse | null;
  controlState: PlanningControlState;
  dashboard: DashboardSummary | null;
  decisions: DecisionQueueResponse | null;
  forecast: ForecastResponse | null;
  includeCandidates: boolean;
  insights: InsightsResponse | null;
  onBillPaid: (instanceId: string, amount: string) => Promise<void>;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  onDecisionAction: (
    action: "confirm" | "reject",
    decisionType: string,
    decisionId: string,
  ) => Promise<void>;
  periodKind: DateWindowKind;
  periodLabel: string;
  planning: PlanningOverview | null;
  preview: ImportPreview | null;
  query: string;
  transactions: TransactionsResponse | null;
  transferResult: TransferDetectionResult | null;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const widgetOrder = dashboardWidgetOrder(controlState);
  const visibleWidgets = widgetOrder.filter((id) => !controlState.hiddenDashboardWidgets.includes(id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateOrder = (nextOrder: string[]) => {
    onControlStateChange((current) => ({
      ...current,
      dashboardWidgetOrder: nextOrder,
    }));
  };
  const handleDragStart = (event: DragStartEvent) => {
    setActiveWidgetId(String(event.active.id));
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWidgetId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = widgetOrder.indexOf(String(active.id));
    const newIndex = widgetOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    updateOrder(arrayMove(widgetOrder, oldIndex, newIndex));
  };

  const renderWidget = (widgetId: string) => {
    if (widgetId.startsWith("custom:")) {
      const customWidget = controlState.customDashboardWidgets.find((widget) => `custom:${widget.id}` === widgetId);
      return customWidget ? <CustomDashboardWidgetCard widget={customWidget} /> : null;
    }

    switch (widgetId) {
      case "cash-position":
        return <DashboardHeroCard dashboard={dashboard} planning={planning} />;
      case "spending-plan":
        return (
          <SpendingPlanCard
            controlState={controlState}
            dashboard={dashboard}
            insights={insights}
            planning={planning}
            upcoming={upcoming}
          />
        );
      case "upcoming":
        return (
          <UpcomingCard
            includeCandidates={includeCandidates}
            limit={3}
            onBillPaid={onBillPaid}
            periodKind={periodKind}
            periodLabel={periodLabel}
            query={query}
            upcoming={upcoming}
          />
        );
      case "spending":
        return <SpendingCard dashboard={dashboard} insights={insights} periodLabel={periodLabel} />;
      case "planning-snapshot":
        return <PlanningSnapshotCard controlState={controlState} insights={insights} planning={planning} />;
      case "decision-queue":
        return (
          <DecisionQueueCard
            busy={busy}
            compact
            decisions={decisions}
            limit={3}
            onDecisionAction={onDecisionAction}
            query={query}
          />
        );
      case "review-focus":
        return <ReviewFocusCard decisions={decisions} planning={planning} transactions={transactions} />;
      case "cashflow":
        return (
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
        );
      default:
        return null;
    }
  };

  const activeWidget = activeWidgetId ? renderWidget(activeWidgetId) : null;

  return (
    <>
      <DndContext
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragCancel={() => setActiveWidgetId(null)}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext items={visibleWidgets} strategy={rectSwappingStrategy}>
          <section className="dashboard-grid" aria-label="Personal Finance Studio dashboard">
            {visibleWidgets.map((widgetId) => {
              const widget = renderWidget(widgetId);
              if (!widget) return null;
              return (
                <SortableDashboardWidget
                  key={widgetId}
                  title={dashboardWidgetTitle(widgetId, controlState)}
                  widgetId={widgetId}
                  wide={widgetId === "cash-position"}
                >
                  {widget}
                </SortableDashboardWidget>
              );
            })}
          </section>
        </SortableContext>
        <DragOverlay adjustScale={false} dropAnimation={dashboardDropAnimation}>
          {activeWidget && activeWidgetId ? (
            <DashboardWidgetOverlay title={dashboardWidgetTitle(activeWidgetId, controlState)}>
              {activeWidget}
            </DashboardWidgetOverlay>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function SortableDashboardWidget({
  children,
  title,
  widgetId,
  wide,
}: {
  children: ReactNode;
  title: string;
  widgetId: string;
  wide: boolean;
}) {
  const {
    attributes,
    isDragging,
    isOver,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: widgetId });
  const dashboardTransform = transform
    ? {
        ...transform,
        scaleX: isDragging ? 0.985 : transform.scaleX,
        scaleY: isDragging ? 0.985 : transform.scaleY,
      }
    : null;
  const style = {
    transform: CSS.Transform.toString(dashboardTransform),
    transition,
  };

  return (
    <div
      className={[
        "dashboard-widget-shell",
        wide ? "dashboard-widget-wide" : "",
        isDragging ? "is-dragging" : "",
        isOver && !isDragging ? "is-drop-target" : "",
      ].filter(Boolean).join(" ")}
      ref={setNodeRef}
      style={style}
    >
      <button
        className="widget-toolbar"
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${title} widget to rearrange`}
        title={`Drag ${title} widget`}
      >
        <span className="drag-handle" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>
      {children}
    </div>
  );
}

function DashboardWidgetOverlay({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="dashboard-widget-overlay" aria-label={`${title} widget preview`}>
      {children}
    </div>
  );
}

function DashboardCustomizeCard({
  controlState,
  onControlStateChange,
}: {
  controlState: PlanningControlState;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
}) {
  const [customForm, setCustomForm] = useState({ body: "", title: "", value: "" });
  const widgetOrder = dashboardWidgetOrder(controlState);
  const toggleWidget = (widgetId: string) => {
    onControlStateChange((current) => {
      const hidden = current.hiddenDashboardWidgets.includes(widgetId)
        ? current.hiddenDashboardWidgets.filter((id) => id !== widgetId)
        : [...current.hiddenDashboardWidgets, widgetId];
      return { ...current, hiddenDashboardWidgets: hidden };
    });
  };
  const resetDashboard = () => {
    onControlStateChange((current) => ({
      ...current,
      dashboardWidgetOrder: [...defaultDashboardWidgetIds, ...current.customDashboardWidgets.map((widget) => `custom:${widget.id}`)],
      hiddenDashboardWidgets: [],
    }));
  };
  const addCustomWidget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = customForm.title.trim();
    if (!title) return;
    const widget: CustomDashboardWidget = {
      accent: "blue",
      body: customForm.body.trim(),
      id: makeLocalId("widget"),
      title,
      value: customForm.value.trim(),
    };
    onControlStateChange((current) => ({
      ...current,
      customDashboardWidgets: [widget, ...current.customDashboardWidgets],
      dashboardWidgetOrder: [...dashboardWidgetOrder(current), `custom:${widget.id}`],
    }));
    setCustomForm({ body: "", title: "", value: "" });
  };

  return (
    <article className="card dashboard-customize-card">
      <CollapsibleBlock meta={`${widgetOrder.length} widgets`} title="Customize dashboard">
        <div className="widget-preference-grid">
          {widgetOrder.map((widgetId) => (
            <label className="checkbox-label widget-toggle" key={widgetId}>
              <input
                aria-label={`Show ${dashboardWidgetTitle(widgetId, controlState)} widget`}
                checked={!controlState.hiddenDashboardWidgets.includes(widgetId)}
                onChange={() => toggleWidget(widgetId)}
                type="checkbox"
              />
              {dashboardWidgetTitle(widgetId, controlState)}
            </label>
          ))}
        </div>
        <form className="custom-widget-form" onSubmit={addCustomWidget}>
          <label>
            Widget title
            <input
              onChange={(event) => setCustomForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Holiday buffer, Tax note..."
              value={customForm.title}
            />
          </label>
          <label>
            Optional value
            <input
              onChange={(event) => setCustomForm((current) => ({ ...current, value: event.target.value }))}
              placeholder="£500, Due 30 Jun..."
              value={customForm.value}
            />
          </label>
          <label>
            Note
            <textarea
              onChange={(event) => setCustomForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="What should this widget remind you?"
              rows={2}
              value={customForm.body}
            />
          </label>
          <div className="custom-widget-actions">
            <button className="button-link" type="submit">Add custom widget</button>
            <button className="button-link button-link-secondary" onClick={resetDashboard} type="button">
              Reset layout
            </button>
          </div>
        </form>
      </CollapsibleBlock>
    </article>
  );
}

function CustomDashboardWidgetCard({ widget }: { widget: CustomDashboardWidget }) {
  return (
    <article className={`card custom-dashboard-widget custom-dashboard-widget-${widget.accent}`}>
      <CardHeader title={widget.title} subtitle="Custom widget" />
      {widget.value ? <strong className="custom-widget-value">{widget.value}</strong> : null}
      {widget.body ? <p>{widget.body}</p> : <p className="empty-copy">No note added yet.</p>}
    </article>
  );
}

function GettingStartedCard({
  busy,
  canImport,
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
  canImport: boolean;
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
          {busy ? "Previewing..." : "Choose file"}
          <input
            aria-label="Choose Snoop CSV"
            type="file"
            accept=".csv,text/csv"
            disabled={busy || !canImport}
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
        <button disabled={!canImport || !preview || busy} onClick={() => void onCommit()} type="button">
          {busy ? "Committing..." : "Commit"}
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
        <button disabled={!canImport || !hasImportedData || busy} onClick={onDetectTransfers} type="button">
          {busy ? "Detecting..." : "Detect"}
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
        <button disabled={!canImport || !hasImportedData || busy} onClick={onDetectCommitments} type="button">
          {busy ? "Detecting..." : "Detect"}
        </button>
      ),
    },
  ];

  return (
    <article className="card getting-started wide-card">
      <CardHeader title="Getting Started" subtitle="Finish setup from your Snoop export." />
      {!canImport ? (
        <p className="status-copy">Add your name above first so this workspace can be personalized before import.</p>
      ) : null}
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

function FreeAgentIntegrationCard({ onImported }: { onImported: () => Promise<void> }) {
  const [status, setStatus] = useState<FreeAgentConnectionStatus | null>(null);
  const [accounts, setAccounts] = useState<FreeAgentBankAccount[]>([]);
  const [importResult, setImportResult] = useState<FreeAgentImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FreeAgentCredentials>({
    environment: "production",
    client_id: "",
    client_secret: "",
    access_token: "",
    refresh_token: "",
  });
  const [oauthRedirectUri, setOauthRedirectUri] = useState("https://www.getpostman.com/oauth2/callback");
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [selectedAccountUrl, setSelectedAccountUrl] = useState("");
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(todayIso());
  const [useIncrementalCursor, setUseIncrementalCursor] = useState(false);
  const completedSteps = [
    Boolean(status?.configured),
    Boolean(status?.validated),
    Boolean(importResult),
  ].filter(Boolean).length;

  useEffect(() => {
    let cancelled = false;
    async function hydrateFreeAgent() {
      try {
        const nextStatus = await getFreeAgentStatus();
        if (cancelled) return;
        setStatus(nextStatus);
        setUseIncrementalCursor(Boolean(nextStatus.sync_cursor_updated_since));
        if (nextStatus.validated) {
          try {
            const nextAccounts = await getFreeAgentBankAccounts();
            if (cancelled) return;
            setAccounts(nextAccounts);
            setSelectedAccountUrl(nextStatus.selected_bank_account_url ?? nextAccounts[0]?.url ?? "");
          } catch {
            if (!cancelled) {
              setMessage("Saved FreeAgent connection found, but accounts could not be refreshed. Revalidate when the API is reachable.");
            }
          }
        }
      } catch (err) {
        if (!cancelled) setMessage(freeAgentErrorMessage(err));
      }
    }

    void hydrateFreeAgent();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveAndValidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveFreeAgentCredentials({
        ...form,
        base_url: form.environment === "custom" ? form.base_url : undefined,
        auth_url: form.auth_url || undefined,
        token_url: form.token_url || undefined,
        refresh_token: form.refresh_token || undefined,
      });
      const validation = await validateFreeAgent();
      setStatus(validation.status);
      setUseIncrementalCursor(Boolean(validation.status.sync_cursor_updated_since));
      setAccounts(validation.accounts);
      setSelectedAccountUrl(validation.status.selected_bank_account_url ?? validation.accounts[0]?.url ?? "");
      setMessage(`Validated ${validation.accounts.length} FreeAgent bank account(s).`);
    } catch (err) {
      setMessage(freeAgentErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function exchangeCodeAndValidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const exchangedStatus = await exchangeFreeAgentOAuthCode({
        environment: form.environment,
        base_url: form.environment === "custom" ? form.base_url : undefined,
        auth_url: form.auth_url || undefined,
        token_url: form.token_url || undefined,
        client_id: form.client_id,
        client_secret: form.client_secret,
        redirect_uri: oauthRedirectUri,
        authorization_code: authorizationCode,
      });
      setStatus(exchangedStatus);
      const validation = await validateFreeAgent();
      setStatus(validation.status);
      setUseIncrementalCursor(Boolean(validation.status.sync_cursor_updated_since));
      setAccounts(validation.accounts);
      setSelectedAccountUrl(validation.status.selected_bank_account_url ?? validation.accounts[0]?.url ?? "");
      setAuthorizationCode("");
      setMessage("OAuth code exchanged and refresh token stored securely. Automatic token refresh is enabled.");
    } catch (err) {
      setMessage(freeAgentErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function runFreeAgentImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccountUrl) return;
    setBusy(true);
    setMessage(null);
    try {
      const shouldUseCursor = Boolean(useIncrementalCursor && status?.sync_cursor_updated_since);
      const result = await importFreeAgentTransactions({
        bank_account_url: selectedAccountUrl,
        from_date: shouldUseCursor ? undefined : fromDate,
        to_date: shouldUseCursor ? undefined : toDate,
        updated_since: shouldUseCursor ? status?.sync_cursor_updated_since ?? undefined : undefined,
        view: "all",
        last_uploaded: false,
      });
      setImportResult(result);
      const nextStatus = await getFreeAgentStatus();
      setStatus(nextStatus);
      setUseIncrementalCursor(Boolean(nextStatus.sync_cursor_updated_since));
      await onImported();
      setMessage(
        `Imported ${result.imported_transaction_count}; skipped ${result.skipped_duplicate_count} duplicate(s).`,
      );
    } catch (err) {
      setMessage(freeAgentErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedAccount = accounts.find((account) => account.url === selectedAccountUrl);
  const canImport = Boolean(status?.validated && selectedAccountUrl);
  const hasIncrementalCursor = Boolean(status?.sync_cursor_updated_since);
  const importingWithCursor = Boolean(useIncrementalCursor && hasIncrementalCursor);
  const authBaseUrl = form.auth_url || defaultFreeAgentAuthUrl(form.environment, form.base_url);
  const authorizationUrl =
    form.client_id && oauthRedirectUri
      ? `${authBaseUrl}?${new URLSearchParams({
          client_id: form.client_id,
          redirect_uri: oauthRedirectUri,
          response_type: "code",
        }).toString()}`
      : "";

  return (
    <article className="card freeagent-card wide-card">
      <CardHeader
        title="FreeAgent Live Import"
        subtitle="Validate OAuth details, choose a bank account, then import only new or selected transactions."
        helpText="Secrets and tokens are encrypted before storage. Prefer a dedicated read-only development app and rotate tokens if a device is shared."
      />
      <div className="integration-status-strip freeagent-status-strip" aria-live="polite">
        <div>
          <span className={`status-pill ${status?.validated ? "status-pill-ok" : "status-pill-warn"}`}>
            {status?.validated ? "Validated" : status?.configured ? "Configured" : "Not connected"}
          </span>
          <strong>{status?.company_name ?? "FreeAgent connection"}</strong>
          <small>{status?.message ?? "Add OAuth details to start."}</small>
        </div>
        <div className="freeagent-progress-chip" aria-label={`${completedSteps} of 3 FreeAgent steps complete`}>
          <span>{completedSteps}/3</span>
          <small>Setup progress</small>
        </div>
        <p>{status?.secret_storage ?? "Secret storage will be initialized on save."}</p>
      </div>

      <div className="freeagent-stage-grid">
        <form className="freeagent-panel" onSubmit={(event) => void saveAndValidate(event)}>
          <div className="freeagent-panel-header">
            <span>Step 1</span>
            <div>
              <strong>Connect and validate</strong>
              <small>Credentials stay local and encrypted; validation only reads company and accounts.</small>
            </div>
          </div>
          <div className="form-grid freeagent-form-grid">
            <label>
              Environment
              <select
                aria-label="FreeAgent API environment"
                value={form.environment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    environment: event.target.value as FreeAgentCredentials["environment"],
                  }))
                }
              >
                <option value="production">Production API</option>
                <option value="sandbox">Sandbox API</option>
                <option value="custom">Custom/mock URL</option>
              </select>
            </label>
            {form.environment === "custom" ? (
              <label>
                Base URL
                <input
                  aria-label="FreeAgent custom base URL"
                  onChange={(event) => setForm((current) => ({ ...current, base_url: event.target.value }))}
                  placeholder="http://127.0.0.1:9000"
                  required
                  type="url"
                  value={form.base_url ?? ""}
                />
              </label>
            ) : null}
            <label>
              OAuth client ID
              <input
                aria-label="FreeAgent OAuth client ID"
                autoComplete="off"
                onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
                required
                value={form.client_id}
              />
            </label>
            <SensitiveInput
              label="OAuth client secret"
              onChange={(value) => setForm((current) => ({ ...current, client_secret: value }))}
              required
              value={form.client_secret}
            />
            <SensitiveInput
              label="Access token"
              hint="Short-lived token from OAuth Playground or FreeAgent OAuth flow. Paste the token value only; the app adds Bearer automatically."
              onChange={(value) => setForm((current) => ({ ...current, access_token: value }))}
              required
              value={form.access_token}
            />
            <SensitiveInput
              label="Refresh token"
              hint="Optional, but different from the access token. Add it if you want the app to refresh expired access tokens automatically."
              optional
              onChange={(value) => setForm((current) => ({ ...current, refresh_token: value }))}
              value={form.refresh_token ?? ""}
            />
          </div>
          <button className="button-link" disabled={busy} type="submit">
            {busy ? "Validating..." : "Save and validate"}
          </button>
        </form>

        <form className="freeagent-panel" onSubmit={(event) => void exchangeCodeAndValidate(event)}>
          <div className="freeagent-panel-header">
            <span>Step 2</span>
            <div>
              <strong>Enable auto refresh</strong>
              <small>Exchange an OAuth authorization code once; the refresh token is encrypted locally.</small>
            </div>
          </div>
          <div className="form-grid freeagent-form-grid">
            <label>
              Redirect URI
              <input
                aria-label="FreeAgent OAuth redirect URI"
                onChange={(event) => setOauthRedirectUri(event.target.value)}
                placeholder="https://www.getpostman.com/oauth2/callback"
                required
                type="url"
                value={oauthRedirectUri}
              />
            </label>
            <label>
              Authorization code
              <input
                aria-label="FreeAgent OAuth authorization code"
                autoComplete="off"
                onChange={(event) => setAuthorizationCode(event.target.value)}
                placeholder="Paste code returned by FreeAgent"
                required
                value={authorizationCode}
              />
            </label>
          </div>
          {authorizationUrl ? (
            <a className="button-link button-link-secondary" href={authorizationUrl} rel="noreferrer" target="_blank">
              Open FreeAgent authorization
            </a>
          ) : (
            <p className="fine-print">Enter client ID and redirect URI to generate the authorization link.</p>
          )}
          <button className="button-link" disabled={busy || !authorizationCode || !form.client_id || !form.client_secret} type="submit">
            {busy ? "Exchanging..." : "Exchange code and validate"}
          </button>
        </form>

        <form className="freeagent-panel" onSubmit={(event) => void runFreeAgentImport(event)}>
          <div className="freeagent-panel-header">
            <span>Step 3</span>
            <div>
              <strong>Choose import scope</strong>
              <small>Use the saved cursor for daily imports, or choose a one-off date window.</small>
            </div>
          </div>
          <div className="form-grid freeagent-form-grid">
            <label>
              Bank account
              <select
                aria-label="FreeAgent bank account"
                disabled={!accounts.length}
                onChange={(event) => setSelectedAccountUrl(event.target.value)}
                value={selectedAccountUrl}
              >
                <option value="">Choose account</option>
                {accounts.map((account) => (
                  <option key={account.url} value={account.url}>
                    {account.name} - {account.currency} {account.current_balance ?? "n/a"}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label freeagent-checkbox">
              <input
                aria-label="Use saved incremental cursor"
                checked={importingWithCursor}
                disabled={!hasIncrementalCursor}
                onChange={(event) => setUseIncrementalCursor(event.target.checked)}
                type="checkbox"
              />
              Use saved incremental cursor
            </label>
            {!importingWithCursor ? (
              <>
                <label>
                  From date
                  <input
                    aria-label="FreeAgent import from date"
                    onChange={(event) => setFromDate(event.target.value)}
                    type="date"
                    value={fromDate}
                  />
                </label>
                <label>
                  To date
                  <input
                    aria-label="FreeAgent import to date"
                    onChange={(event) => setToDate(event.target.value)}
                    type="date"
                    value={toDate}
                  />
                </label>
              </>
            ) : null}
          </div>
          <div className="freeagent-account-preview">
            <strong>{selectedAccount?.name ?? "No account selected"}</strong>
            <span>
              {selectedAccount
                ? `${selectedAccount.type} · ${selectedAccount.status} · latest ${selectedAccount.latest_activity_date ?? "unknown"}`
                : "Validate first, then choose the account to import."}
            </span>
            <small>
              {hasIncrementalCursor
                ? `Cursor: ${status?.sync_cursor_updated_since}`
                : "First import needs a date range; a cursor is saved after transactions are imported."}
            </small>
          </div>
          <button className="button-link" disabled={!canImport || busy} type="submit">
            {busy ? "Importing..." : importingWithCursor ? "Run incremental import" : "Run date-range import"}
          </button>
        </form>
      </div>

      {message ? <p className="status-copy">{message}</p> : null}
      <p className="freeagent-token-note">
        Refresh token is not the same as the access token. You can paste a short-lived access token for
        testing, but automatic refresh needs either a refresh token or a one-time authorization-code
        exchange. Date-range imports now follow all FreeAgent result pages before saving the cursor.
      </p>
      {importResult ? (
        <div className="import-result-grid">
          <Metric label="Rows fetched" value={String(importResult.row_count)} />
          <Metric label="Imported" value={String(importResult.imported_transaction_count)} />
          <Metric label="Duplicates" value={String(importResult.skipped_duplicate_count)} />
          <Metric label="Next cursor" value={importResult.next_updated_since ?? "not set"} />
        </div>
      ) : null}
    </article>
  );
}

function freeAgentErrorMessage(err: unknown) {
  const message = errorMessage(err);
  if (message === "Failed to fetch") {
    return "FreeAgent validation failed. Check that the backend is online and the selected API URL is reachable.";
  }
  return message;
}

function defaultFreeAgentAuthUrl(environment: FreeAgentCredentials["environment"], baseUrl?: string) {
  if (environment === "sandbox") return "https://api.sandbox.freeagent.com/v2/approve_app";
  if (environment === "custom" && baseUrl) return `${baseUrl.replace(/\/$/, "")}/v2/approve_app`;
  return "https://api.freeagent.com/v2/approve_app";
}

function SensitiveInput({
  hint,
  label,
  onChange,
  optional = false,
  required = false,
  value,
}: {
  hint?: string;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  required?: boolean;
  value: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <label className="sensitive-field">
      <span>
        {label}
        {optional ? <em>optional</em> : null}
      </span>
      <div className="sensitive-input-wrap">
        <input
          aria-label={label}
          autoComplete="new-password"
          onChange={(event) => onChange(event.target.value)}
          required={required}
          spellCheck={false}
          type={revealed ? "text" : "password"}
          value={value}
        />
        <button aria-label={`${revealed ? "Hide" : "Show"} ${label}`} onClick={() => setRevealed((current) => !current)} type="button">
          {revealed ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function NameSetupCard({
  onSave,
  userName,
}: {
  onSave: (name: string) => void;
  userName: string;
}) {
  const [draftName, setDraftName] = useState(userName);
  const isSaved = Boolean(userName);

  useEffect(() => {
    setDraftName(userName);
  }, [userName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = cleanUserName(draftName);
    if (!nextName) return;
    onSave(nextName);
  }

  return (
    <article className={`card name-setup-card ${isSaved ? "name-setup-card-complete" : ""}`}>
      <CardHeader
        helpText="The saved name is used for greetings and workspace copy before and after import."
        title={isSaved ? `Welcome, ${userName}` : "Personalize your workspace"}
        subtitle={
          isSaved
            ? "This name is used for greetings and the workspace menu."
            : "Before importing data, tell us what name to use across the app."
        }
      />
      <form className="control-form name-setup-form" onSubmit={handleSubmit}>
        <label>
          Your name
          <input
            aria-label="Your name"
            autoComplete="given-name"
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="e.g. Alex"
            value={draftName}
          />
        </label>
        <button className="settings-primary-action" disabled={!cleanUserName(draftName)} type="submit">
          {isSaved ? "Update name" : "Save and continue"}
        </button>
      </form>
    </article>
  );
}

function SpendingCard({
  dashboard,
  insights,
  periodLabel,
}: {
  dashboard: DashboardSummary | null;
  insights: InsightsResponse | null;
  periodLabel: string;
}) {
  const groups = reportGroups(insights, "category", "spending").slice(0, 4);
  const totalOutflow = groups.reduce((sum, group) => sum + group.value, 0);
  const topGroup = groups[0];
  const flexibleSpend = (insights?.category_groups ?? [])
    .filter((group) => group.group === "flexible")
    .reduce((sum, group) => sum + Math.abs(Number(group.outflow_total)), 0);
  const flexibleAllowance = Number(dashboard?.flexible_spend_allowance ?? 0);
  const flexibleLeft = flexibleAllowance > 0 ? flexibleAllowance - flexibleSpend : null;

  return (
    <article className="card spending-pulse-card">
      <CardHeader
        helpText="These totals come from transactions in the selected date range. They are activity totals, not current account balances."
        title="Period Activity"
        subtitle={`${periodLabel} transactions`}
      />
      <div className="spending-pulse-hero">
        <span>Tracked outflow</span>
        <strong>{totalOutflow ? money(String(totalOutflow)) : "-"}</strong>
        <small>
          {topGroup
            ? `${topGroup.label} is the largest visible category`
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
          helpText="Default flexible guardrail minus flexible spending in this selected period."
          label="Flexible left"
          value={flexibleLeft === null ? "-" : money(String(flexibleLeft))}
        />
      </div>
      <div className="card-actions">
        <a className="button-link" href="#/reports?report=spending">Open reports</a>
        <a className="button-link button-link-secondary" href="#/transactions">Review transactions</a>
      </div>
    </article>
  );
}

function DashboardHeroCard({
  dashboard,
  planning,
}: {
  dashboard: DashboardSummary | null;
  planning: PlanningOverview | null;
}) {
  const cashReady = dashboard?.confidence === "ready";
  const freshness = planning?.import_freshness.status ?? "checking";
  const cashOnHand = dashboard?.cash_on_hand === null || dashboard?.cash_on_hand === undefined
    ? null
    : Number(dashboard.cash_on_hand);
  const confirmedDue = Number(dashboard?.upcoming_confirmed_total ?? 0);
  const candidateDue = Number(dashboard?.upcoming_candidate_total ?? 0);
  const afterConfirmed = cashOnHand === null ? null : cashOnHand - confirmedDue;
  const afterCandidates = cashOnHand === null ? null : cashOnHand - confirmedDue - candidateDue;
  return (
    <article className="card dashboard-hero-card">
      <div className="dashboard-hero-copy">
        <span className="hero-kicker">
          Cash Position
          <HelpTip text="Included cash account balances today. This is a balance number, not income or spending for the selected period." />
        </span>
        <strong>{cashReady && dashboard?.cash_on_hand ? money(dashboard.cash_on_hand) : "Needs balances"}</strong>
        {!cashReady ? (
          <p>{dashboard?.message ?? "Import data and enter balances to unlock trusted available-money planning."}</p>
        ) : null}
        <div className="hero-actions">
          <a className="button-link" href="#/accounts">Review balances</a>
          <a className="button-link button-link-secondary" href="#/cash-flow">Open cash flow</a>
        </div>
      </div>
      <div className="hero-stat-grid">
        <Metric
          helpText="Current included cash minus confirmed bills in the 30-day planning queue."
          label="After confirmed bills"
          value={afterConfirmed === null ? "-" : money(String(afterConfirmed))}
        />
        <Metric
          helpText="Current included cash minus confirmed bills and candidate bills. Candidates only count after review."
          label="After candidates"
          value={afterCandidates === null ? "-" : money(String(afterCandidates))}
        />
        <Metric
          helpText="Bills already trusted enough to affect the 30-day cash-flow forecast."
          label="Confirmed bills"
          value={dashboard ? money(dashboard.upcoming_confirmed_total) : "-"}
        />
        <Metric
          helpText="Detected bill candidates waiting for review. These show risk but do not become trusted bills until confirmed."
          label="Candidate bills"
          value={dashboard ? money(dashboard.upcoming_candidate_total) : "-"}
        />
      </div>
      <div className={`hero-freshness hero-freshness-${freshness}`}>
        <span className="system-badge-dot" />
        <div>
          <strong>
            Data {titleCase(freshness)}
            <HelpTip text="Freshness is based on the latest imported transaction date and helps you judge whether reports need a new import." />
          </strong>
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
    <article className="card upcoming-bills-card">
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
      <div className="card-actions">
        <a className="button-link" href="#/calendar">Open calendar</a>
        <a className="button-link button-link-secondary" href="#/recurring">Review recurring</a>
      </div>
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
  const [expandedLimit, setExpandedLimit] = useState(limit);
  const filteredRows = filterByQuery(decisions?.decisions ?? [], query, (decision) =>
    `${decision.title} ${decision.detail} ${decision.amount} ${decision.decision_type}`,
  );
  const rowLimit = compact ? limit : expandedLimit;
  const rows = filteredRows.slice(0, rowLimit);
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
          title="Decision Impact"
          subtitle={
            decisions
              ? `${visibleCount} shown · ${decisions.total_count} accuracy checks open`
              : "Checks that improve reports and forecasts"
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
        ) : (
          <a className="button-link button-link-secondary compact-card-link" href="#/decision-queue">
            Open decision queue
          </a>
        )}
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
        <div className="empty-panel">
          <strong>{decisions?.total_count === 0 ? "Decision queue is clear" : "No matching decisions"}</strong>
          <p>
            {decisions?.total_count === 0
              ? "Confirmed transfers and recurring bills will appear here when they need review."
              : "Try clearing search or filters to see the remaining queue."}
          </p>
        </div>
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
      {!compact && filteredRows.length > visibleCount ? (
        <div className="card-actions">
          <button
            className="button-link button-link-secondary"
            onClick={() => setExpandedLimit((current) => current + limit)}
            type="button"
          >
            Show {Math.min(limit, filteredRows.length - visibleCount)} more
          </button>
        </div>
      ) : null}
    </article>
  );
}

function TransactionsCard({
  accounts,
  limit = 6,
  onCommitmentCreate,
  onTransactionUpdate,
  query,
  setTransactionFilters,
  transactions,
  transactionFilters,
}: {
  accounts: AccountsResponse | null;
  limit?: number;
  onCommitmentCreate?: (payload: CommitmentCreate) => Promise<void>;
  onTransactionUpdate?: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  query: string;
  setTransactionFilters?: (filters: TransactionFilterState) => void;
  transactions: TransactionsResponse | null;
  transactionFilters?: TransactionFilterState;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [expandedLimit, setExpandedLimit] = useState(limit);
  const [recurringDraft, setRecurringDraft] = useState<CommitmentDraft | null>(null);
  const filteredRows = filterByQuery(transactions?.transactions ?? [], query, (transaction) =>
    `${transaction.merchant_name} ${transaction.description} ${transaction.provider} ${transaction.source_category}`,
  );
  const rows = filteredRows.slice(0, expandedLimit);
  const chooseRecurringSource = (transaction: TransactionSummary) => {
    setRecurringDraft(commitmentDraftFromTransaction(transaction));
  };
  const saveRecurringFromTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCommitmentCreate || !recurringDraft) return;
    await onCommitmentCreate({
      commitment_type: recurringDraft.type,
      category: recurringDraft.category,
      end_date: recurringDraft.endDate || null,
      expected_amount: recurringDraft.amount,
      frequency: recurringDraft.frequency,
      name: recurringDraft.name,
      next_due_date: recurringDraft.nextDueDate || today,
      occurrence_count: recurringDraft.occurrenceCount
        ? Math.max(1, Number(recurringDraft.occurrenceCount) || 1)
        : null,
      source_transaction_id: recurringDraft.sourceTransactionId,
      status: "confirmed",
    });
    setRecurringDraft(null);
  };
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
      {recurringDraft ? (
        <form className="transaction-recurring-panel" onSubmit={(event) => void saveRecurringFromTransaction(event)}>
          <div className="source-transaction-callout">
            <strong>Create recurring from transaction</strong>
            <span>{recurringDraft.sourceTransactionLabel}</span>
            <button className="button-link button-link-small" onClick={() => setRecurringDraft(null)} type="button">
              Cancel
            </button>
          </div>
          <div className="transaction-recurring-grid">
            <label>
              Reference name
              <input
                aria-label="Transaction recurring reference name"
                onChange={(event) =>
                  setRecurringDraft((current) => current && { ...current, name: event.target.value })
                }
                placeholder="e.g. Council tax, HSBC loan, Netflix"
                required
                value={recurringDraft.name}
              />
            </label>
            <label>
              Category
              <input
                aria-label="Transaction recurring category"
                onChange={(event) =>
                  setRecurringDraft((current) => current && { ...current, category: event.target.value })
                }
                placeholder="Bills, Subscriptions, Debt..."
                required
                value={recurringDraft.category}
              />
            </label>
            <label>
              Type
              <select
                aria-label="Transaction recurring type"
                onChange={(event) =>
                  setRecurringDraft((current) => current && { ...current, type: event.target.value })
                }
                value={recurringDraft.type}
              >
                <option value="bill">Essential bill</option>
                <option value="subscription">Subscription</option>
                <option value="credit_card_payment">Credit card payment</option>
                <option value="loan_payment">Loan payment</option>
                <option value="bnpl">Buy Now Pay Later</option>
                <option value="non_monthly">Irregular obligation</option>
              </select>
            </label>
            <label>
              Frequency
              <select
                aria-label="Transaction recurring frequency"
                onChange={(event) =>
                  setRecurringDraft((current) => current && { ...current, frequency: event.target.value })
                }
                value={recurringDraft.frequency}
              >
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="custom">One-off/custom</option>
              </select>
            </label>
            <label>
              Amount
              <input
                aria-label="Transaction recurring amount"
                inputMode="decimal"
                onChange={(event) =>
                  setRecurringDraft((current) => current && { ...current, amount: event.target.value })
                }
                required
                value={recurringDraft.amount}
              />
            </label>
            <label>
              Next due date
              <input
                aria-label="Transaction recurring next due date"
                onChange={(event) =>
                  setRecurringDraft((current) => current && { ...current, nextDueDate: event.target.value })
                }
                required
                type="date"
                value={recurringDraft.nextDueDate}
              />
            </label>
            <label>
              Payment count
              <input
                aria-label="Transaction recurring payment count"
                inputMode="numeric"
                min="1"
                onChange={(event) =>
                  setRecurringDraft((current) => current && { ...current, occurrenceCount: event.target.value })
                }
                placeholder="Optional"
                type="number"
                value={recurringDraft.occurrenceCount}
              />
            </label>
          </div>
          <div className="manual-commitment-actions">
            <button className="button-link" type="submit">Protect this recurring item</button>
            <small>The source transaction stays linked as evidence and the next planned bill is created.</small>
          </div>
        </form>
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
            <span>Recurring</span>
          </div>
          {rows.map((transaction) => (
            <TransactionReviewRow
              key={transaction.id}
              onCreateRecurring={onCommitmentCreate ? chooseRecurringSource : undefined}
              onTransactionUpdate={onTransactionUpdate}
              transaction={transaction}
            />
          ))}
        </div>
      )}
      {rows.length < filteredRows.length ? (
        <div className="show-more-row">
          <button
            className="button-link button-link-secondary"
            onClick={() => setExpandedLimit((current) => current + limit)}
            type="button"
          >
            Show {Math.min(limit, filteredRows.length - rows.length)} more transactions
          </button>
        </div>
      ) : null}
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
  onResetAppData,
  onTransactionUpdate,
  transactions,
}: {
  controlState: PlanningControlState;
  health: ApiHealthState;
  insights: InsightsResponse | null;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  onHealthCheck: () => Promise<void>;
  onResetAppData: () => Promise<void>;
  onTransactionUpdate: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  transactions: TransactionsResponse | null;
}) {
  const [section, setSection] = useState<"categories" | "dashboard" | "data" | "merchants" | "rules" | "system" | "tags">("categories");
  return (
    <article className="card settings-workbench">
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {(["categories", "dashboard", "merchants", "rules", "tags", "data", "system"] as const).map((item) => (
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
          {section === "dashboard" ? (
            <DashboardCustomizeCard controlState={controlState} onControlStateChange={onControlStateChange} />
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
            <DataSettings controlState={controlState} onResetAppData={onResetAppData} />
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

function DataSettings({
  controlState,
  onResetAppData,
}: {
  controlState: PlanningControlState;
  onResetAppData: () => Promise<void>;
}) {
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
      <div className="danger-zone">
        <div>
          <strong>Reset and start fresh</strong>
          <p>
            Clears imported transactions, accounts, detected bills, decisions, local planning preferences,
            and your saved display name.
          </p>
        </div>
        <button className="danger-button" onClick={() => void onResetAppData()} type="button">
          Reset app data
        </button>
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
            aria-label="Goal due date"
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
  dashboard,
  insights,
  onControlStateChange,
  periodLabel,
  planning,
  upcoming,
}: {
  controlState: PlanningControlState;
  dashboard: DashboardSummary | null;
  insights: InsightsResponse | null;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  periodLabel: string;
  planning: PlanningOverview | null;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const [activeSection, setActiveSection] = useState<BudgetSection>("overview");
  const rows = budgetRows(controlState, insights);
  const totals = budgetTotals(rows, insights);
  const spendingPlan = spendingPlanTotals(controlState, insights, upcoming, planning);
  const safeSpend = safeSpendPlan(controlState, dashboard, spendingPlan);
  const boundaryValue = Math.max(0, safeSpend.value);
  const boundaryState =
    boundaryValue <= 0
      ? { label: "Pause discretionary spend", tone: "danger" }
      : safeSpend.assumptionsReady
        ? { label: "Guardrails active", tone: "ok" }
        : { label: "Needs assumptions", tone: "warn" };
  const reviewActions = [
    totals.plannedOutflow <= 0 ? "Create at least one envelope before treating this as a decision-grade budget." : null,
    safeSpend.assumptionsReady ? null : "Add assumptions for income changes, one-offs, holidays, or the buffer you never want to cross.",
    planning?.monthly_review.unreviewed_count
      ? `Review ${planning.monthly_review.unreviewed_count} transaction(s) before month-end decisions.`
      : null,
  ].filter(Boolean) as string[];
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
      <div className="budget-control-hero">
        <div>
          <span className="hero-kicker">Budget control tower</span>
          <h2>Decide what is safe, then tune the plan.</h2>
          <p>
            A calmer Kakeibo-inspired flow: protect the boundary first, then allocate money, adjust
            assumptions, and review what changed.
          </p>
        </div>
        <div className={`budget-boundary-card budget-boundary-${boundaryState.tone}`}>
          <span>{boundaryState.label}</span>
          <strong>{money(String(boundaryValue))}</strong>
          <small>Safe to spend today, capped by cash capacity and your assumptions.</small>
        </div>
      </div>

      <div className="budget-section-tabs" role="tablist" aria-label="Budget workflow">
        {budgetSections.map((section) => (
          <button
            aria-controls={`budget-section-${section.id}`}
            aria-selected={activeSection === section.id}
            className={activeSection === section.id ? "active" : ""}
            id={`budget-tab-${section.id}`}
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            role="tab"
            type="button"
          >
            <strong>{section.label}</strong>
            <span>{section.summary}</span>
          </button>
        ))}
      </div>

      <section
        aria-labelledby={`budget-tab-${activeSection}`}
        className="budget-section-panel"
        id={`budget-section-${activeSection}`}
        role="tabpanel"
      >
        {activeSection === "overview" ? (
          <>
            <div className="budget-decision-grid">
              <div className="budget-decision-card">
                <span>1. What do I have?</span>
                <strong>{money(String(dashboard?.cash_on_hand ?? 0))}</strong>
                <small>Current cash and overdraft capacity included for bill payments.</small>
              </div>
              <div className="budget-decision-card">
                <span>2. What must be protected?</span>
                <strong>{money(String(safeSpend.assumptionDeductions + spendingPlan.obligations))}</strong>
                <small>Bills, known costs, lifestyle allowance, and minimum buffer.</small>
              </div>
              <div className="budget-decision-card">
                <span>3. What can I spend?</span>
                <strong>{money(String(boundaryValue))}</strong>
                <small>Permission number, not a challenge to spend it.</small>
              </div>
              <div className="budget-decision-card">
                <span>4. What should improve?</span>
                <strong>{reviewActions.length || "Clear"}</strong>
                <small>{reviewActions[0] ?? "No urgent budget setup action from the current data."}</small>
              </div>
            </div>
            <div className="budget-summary-grid">
              <Metric label="Income actual" value={money(String(totals.incomeActual))} />
              <Metric label="Actual outflow" value={money(String(totals.actualOutflow))} />
              <Metric label="Planned outflow" value={money(String(totals.plannedOutflow))} />
              <Metric label="Plan remaining" value={money(String(totals.remaining))} />
            </div>
            <div className="card-actions">
              <button className="button-link" onClick={() => setActiveSection("plan")} type="button">
                Build monthly plan
              </button>
              <button className="button-link button-link-secondary" onClick={() => setActiveSection("assumptions")} type="button">
                Tune assumptions
              </button>
            </div>
          </>
        ) : null}

        {activeSection === "plan" ? (
          <>
            <div className="budget-mode-strip">
              <div>
                <strong>Monthly plan method</strong>
                <small>Choose the mental model that fits this month. The math below stays auditable.</small>
              </div>
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
                    {mode === "category" ? "Envelope" : titleCase(mode)}
                  </button>
                ))}
              </div>
            </div>
            <div className="spending-plan-strip">
              <Metric label="Income" value={money(String(spendingPlan.income))} />
              <Metric label="Bills/subscriptions" value={money(String(spendingPlan.obligations))} />
              <Metric label="Savings goals" value={money(String(spendingPlan.goalContributions))} />
              <Metric label="Flexible actual" value={money(String(spendingPlan.flexibleActual))} />
              <Metric label="Period surplus" value={money(String(spendingPlan.leftToSpend))} />
            </div>
            <p className="fine-print">
              Plan principle: give every pound a job, but treat the period surplus as evidence. The dashboard
              Safe to Spend value stays capped by cash capacity.
            </p>
            <div className="card-actions">
              <button className="button-link" onClick={() => setActiveSection("envelopes")} type="button">
                Edit envelopes
              </button>
              <a className="button-link button-link-secondary" href="#/cash-flow">
                Scenario plan cash flow
              </a>
            </div>
          </>
        ) : null}

        {activeSection === "envelopes" ? (
          <>
            <div className="budget-section-heading">
              <div>
                <strong>Envelope budgets</strong>
                <small>
                  Planned minus actual{controlState.budgetMode === "rollover" ? " plus rollover" : ""}. Keep the table for editing, not for first-glance decisions.
                </small>
              </div>
              <button className="button-link button-link-secondary" onClick={() => setActiveSection("plan")} type="button">
                Back to plan
              </button>
            </div>
            <div className="budget-table" role="table" aria-label="Monthly budget envelopes">
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
          </>
        ) : null}

        {activeSection === "assumptions" ? (
          <PlanningAssumptionsPanel
            controlState={controlState}
            onControlStateChange={onControlStateChange}
            safeSpend={safeSpend}
          />
        ) : null}

        {activeSection === "review" ? (
          <>
            <div className="budget-review-grid">
              <Metric label="Income actual" value={money(String(totals.incomeActual))} />
              <Metric label="Actual outflow" value={money(String(totals.actualOutflow))} />
              <Metric label="Reviewed transactions" value={String(planning?.monthly_review.reviewed_count ?? 0)} />
              <Metric label="Unreviewed transactions" value={String(planning?.monthly_review.unreviewed_count ?? 0)} />
            </div>
            <div className="budget-action-list">
              <strong>Next best actions</strong>
              {reviewActions.length > 0 ? (
                reviewActions.map((action) => <p key={action}>{action}</p>)
              ) : (
                <p>The current budget has no urgent setup warnings. Keep reviewing actuals as new transactions arrive.</p>
              )}
            </div>
            <div className="card-actions">
              <a className="button-link" href="#/transactions">
                Review actuals
              </a>
              <a className="button-link button-link-secondary" href="#/monthly-review">
                Monthly review
              </a>
            </div>
          </>
        ) : null}
      </section>
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
  onCreateRecurring,
  onTransactionUpdate,
  transaction,
}: {
  onCreateRecurring?: (transaction: TransactionsResponse["transactions"][number]) => void;
  onTransactionUpdate?: (transactionId: string, payload: TransactionUpdate) => Promise<void>;
  transaction: TransactionsResponse["transactions"][number];
}) {
  const [transactionType, setTransactionType] = useState(transaction.transaction_type);
  const canCreateRecurring = isRecurringSourceTransaction(transaction);
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
      <div className="transaction-recurring-action" role="cell">
        {onCreateRecurring && canCreateRecurring ? (
          <button
            className="button-link button-link-small"
            onClick={() => onCreateRecurring(transaction)}
            type="button"
          >
            Make recurring
          </button>
        ) : (
          <small>{canCreateRecurring ? "Open Recurring" : "Not an outflow"}</small>
        )}
      </div>
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
    overdraftLimit: string,
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
    overdraftLimit: string,
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
    overdraftLimit: string,
  ) => Promise<void>;
}) {
  const [balance, setBalance] = useState(account.current_balance ?? "");
  const [accountType, setAccountType] = useState(account.account_type);
  const [overdraftLimit, setOverdraftLimit] = useState(account.overdraft_limit ?? "");
  const balanceInvalid = !isValidMoneyInput(balance, { allowEmpty: false });
  const overdraftInvalid = !isValidMoneyInput(overdraftLimit, { allowEmpty: true });
  const supportsOverdraft = ["current", "unknown"].includes(accountType);
  const hasLiability = Number(account.liability_balance) > 0;

  return (
    <div className="account-review-row">
      <div className="account-review-main">
        <div className="account-review-copy">
          <strong>{account.display_name}</strong>
          <small>
            <span>{account.provider}</span>
            <span>Imported net {money(account.net_total)}</span>
          </small>
        </div>
        <div className="account-balance-pills" aria-label={`${account.display_name} balance treatment`}>
          <span className="account-money-pill account-money-pill-available">
            <small>Available</small>
            <strong>{account.available_balance ? money(account.available_balance) : "Needs balance"}</strong>
          </span>
          {hasLiability ? (
            <span className="account-money-pill account-money-pill-liability">
              <small>Liability</small>
              <strong>{money(account.liability_balance)}</strong>
            </span>
          ) : null}
        </div>
      </div>
      <div className="account-review-controls">
        <label className="compact-field">
          <span>Type</span>
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
        </label>
        <label className="compact-field">
          <span>Balance</span>
          <input
            aria-label={`Balance for ${account.display_name}`}
            aria-invalid={balanceInvalid}
            inputMode="decimal"
            onChange={(event) => setBalance(event.target.value)}
            placeholder="0.00"
            value={balance}
          />
        </label>
        <label className="compact-field">
          <span>Overdraft limit</span>
          <input
            aria-label={`Overdraft limit for ${account.display_name}`}
            aria-invalid={overdraftInvalid}
            disabled={!supportsOverdraft}
            inputMode="decimal"
            onChange={(event) => setOverdraftLimit(event.target.value)}
            placeholder="0.00"
            value={supportsOverdraft ? overdraftLimit : ""}
          />
        </label>
        <button
          disabled={busy || balanceInvalid || overdraftInvalid}
          onClick={() => void onAccountBalanceUpdate(account.id, balance, accountType, overdraftLimit)}
          type="button"
        >
          Save
        </button>
      </div>
      {balanceInvalid || overdraftInvalid ? (
        <div className="account-review-errors">
          {balanceInvalid ? <small className="field-error account-balance-error">Enter a valid balance.</small> : null}
          {overdraftInvalid ? (
            <small className="field-error account-balance-error">Enter a valid overdraft limit.</small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RecurringCard({
  commitments,
  limit = 6,
  onCommitmentCreate,
  onCommitmentUpdate,
  query,
  transactions,
}: {
  commitments: CommitmentsResponse | null;
  limit?: number;
  onCommitmentCreate?: (payload: CommitmentCreate) => Promise<void>;
  onCommitmentUpdate?: (commitmentId: string, payload: CommitmentUpdate) => Promise<void>;
  query: string;
  transactions: TransactionsResponse | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [manualOpen, setManualOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState<{
    category: string;
    id: string;
    name: string;
  } | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(true);
  const [manualForm, setManualForm] = useState({
    amount: "",
    category: "Bills",
    endDate: "",
    frequency: "monthly",
    name: "",
    nextDueDate: today,
    occurrenceCount: "",
    sourceTransactionId: "",
    sourceTransactionLabel: "",
    type: "bill",
  });
  const rows = filterByQuery(commitments?.commitments ?? [], query, (commitment) =>
    `${commitment.name} ${commitment.category} ${commitment.frequency} ${commitment.commitment_type}`,
  ).slice(0, limit);
  const transactionRows = filterByQuery(
    (transactions?.transactions ?? []).filter(isRecurringSourceTransaction),
    query,
    (transaction) => `${transaction.merchant_name} ${transaction.description} ${transaction.account_name}`,
  ).slice(0, 8);
  const chooseSourceTransaction = (transaction: TransactionSummary) => {
    setManualForm((current) => ({ ...current, ...commitmentDraftFromTransaction(transaction) }));
    setManualOpen(true);
  };
  const saveManualCommitment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCommitmentCreate) return;
    await onCommitmentCreate({
      commitment_type: manualForm.type,
      category: manualForm.category,
      end_date: manualForm.endDate || null,
      expected_amount: manualForm.amount,
      frequency: manualForm.frequency,
      name: manualForm.name,
      next_due_date: manualForm.nextDueDate,
      occurrence_count: manualForm.occurrenceCount ? Math.max(1, Number(manualForm.occurrenceCount) || 1) : null,
      source_transaction_id: manualForm.sourceTransactionId || null,
      status: "confirmed",
    });
    setManualForm({
      amount: "",
      category: "Bills",
      endDate: "",
      frequency: "monthly",
      name: "",
      nextDueDate: today,
      occurrenceCount: "",
      sourceTransactionId: "",
      sourceTransactionLabel: "",
      type: "bill",
    });
  };
  const startCommitmentEdit = (commitment: CommitmentsResponse["commitments"][number]) => {
    setEditingCommitment({
      category: commitment.category || "Bills",
      id: commitment.id,
      name: commitment.name,
    });
  };
  const saveCommitmentEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCommitmentUpdate || !editingCommitment) return;
    await onCommitmentUpdate(editingCommitment.id, {
      category: editingCommitment.category,
      name: editingCommitment.name,
    });
    setEditingCommitment(null);
  };
  return (
    <article className="card">
      <CardHeader
        title="Recurring"
        subtitle={commitments ? `${commitments.total_count} commitments and candidates` : "No upcoming transactions"}
      />
      <div className="commitment-inbox-intro">
        <strong>Commitment inbox</strong>
        <p>
          Detection finds patterns, but you stay in control. Add missed bills manually, and give BNPL or
          short-term plans a stop date or payment count so they do not recur forever.
        </p>
      </div>
      {onCommitmentCreate ? (
        <section className="manual-commitment-panel transaction-source-panel">
          <button
            aria-expanded={transactionOpen}
            className="manual-commitment-toggle"
            onClick={() => setTransactionOpen((current) => !current)}
            type="button"
          >
            <span className={`group-chevron ${transactionOpen ? "open" : ""}`} aria-hidden="true" />
            <span>
              <strong>Add from transaction evidence</strong>
              <small>Pick a real outflow, then adjust frequency, amount, and end rules before protecting it.</small>
            </span>
          </button>
          {transactionOpen ? (
            transactionRows.length > 0 ? (
              <div className="transaction-source-list">
                {transactionRows.map((transaction) => (
                  <div className="transaction-source-row" key={transaction.id}>
                    <div>
                      <strong>{transaction.merchant_name || transaction.description}</strong>
                      <small>
                        {transaction.date} · {transaction.account_name} · {titleCase(transaction.normalized_group)}
                      </small>
                    </div>
                    <span className="amount">{money(transaction.amount)}</span>
                    <button className="button-link button-link-small" onClick={() => chooseSourceTransaction(transaction)} type="button">
                      Use transaction
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-copy">No eligible outflow transactions in the selected period. Change the date range or search.</p>
            )
          ) : null}
        </section>
      ) : null}
      {onCommitmentCreate ? (
        <section className="manual-commitment-panel">
          <button
            aria-expanded={manualOpen}
            className="manual-commitment-toggle"
            onClick={() => setManualOpen((current) => !current)}
            type="button"
          >
            <span className={`group-chevron ${manualOpen ? "open" : ""}`} aria-hidden="true" />
            <span>
              <strong>Add a bill or subscription</strong>
              <small>Manual fallback for missed bills, BNPL plans, and short-term commitments.</small>
            </span>
          </button>
          {manualOpen ? (
            <form className="manual-commitment-form" onSubmit={(event) => void saveManualCommitment(event)}>
              {manualForm.sourceTransactionLabel ? (
                <div className="source-transaction-callout">
                  <strong>Based on transaction</strong>
                  <span>{manualForm.sourceTransactionLabel}</span>
                  <button
                    className="button-link button-link-small"
                    onClick={() =>
                      setManualForm((current) => ({
                        ...current,
                        sourceTransactionId: "",
                        sourceTransactionLabel: "",
                      }))
                    }
                    type="button"
                  >
                    Clear source
                  </button>
                </div>
              ) : null}
              <label>
                Reference name
                <input
                  aria-label="Commitment name"
                  onChange={(event) => setManualForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Netflix, Klarna, Council tax..."
                  required
                  value={manualForm.name}
                />
              </label>
              <label>
                Category
                <input
                  aria-label="Commitment category"
                  onChange={(event) => setManualForm((current) => ({ ...current, category: event.target.value }))}
                  placeholder="Bills, Subscriptions, Debt..."
                  required
                  value={manualForm.category}
                />
              </label>
              <label>
                Type
                <select
                  aria-label="Commitment type"
                  onChange={(event) => setManualForm((current) => ({ ...current, type: event.target.value }))}
                  value={manualForm.type}
                >
                  <option value="bill">Essential bill</option>
                  <option value="subscription">Subscription</option>
                  <option value="credit_card_payment">Credit card payment</option>
                  <option value="loan_payment">Loan payment</option>
                  <option value="bnpl">Buy Now Pay Later</option>
                  <option value="non_monthly">Irregular obligation</option>
                </select>
              </label>
              <label>
                Frequency
                <select
                  aria-label="Commitment frequency"
                  onChange={(event) => setManualForm((current) => ({ ...current, frequency: event.target.value }))}
                  value={manualForm.frequency}
                >
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="custom">One-off/custom</option>
                </select>
              </label>
              <label>
                Amount
                <input
                  aria-label="Commitment amount"
                  inputMode="decimal"
                  onChange={(event) => setManualForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="29.99"
                  required
                  value={manualForm.amount}
                />
              </label>
              <label>
                Next due date
                <input
                  aria-label="Commitment next due date"
                  onChange={(event) => setManualForm((current) => ({ ...current, nextDueDate: event.target.value }))}
                  required
                  type="date"
                  value={manualForm.nextDueDate}
                />
              </label>
              <label>
                Payment count
                <input
                  aria-label="Commitment payment count"
                  inputMode="numeric"
                  min="1"
                  onChange={(event) => setManualForm((current) => ({ ...current, occurrenceCount: event.target.value }))}
                  placeholder="Optional, e.g. 3 for BNPL"
                  type="number"
                  value={manualForm.occurrenceCount}
                />
              </label>
              <label>
                End date
                <input
                  aria-label="Commitment end date"
                  onChange={(event) => setManualForm((current) => ({ ...current, endDate: event.target.value }))}
                  type="date"
                  value={manualForm.endDate}
                />
              </label>
              <div className="manual-commitment-actions">
                <button className="button-link" type="submit">
                  Protect this commitment
                </button>
                <small>Manual entries are confirmed immediately and feed Calendar, Cash Flow, Budget, and Dashboard.</small>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
      {rows.length === 0 ? (
        <p className="empty-copy">Detect bills to populate recurring candidates.</p>
      ) : (
        <CollapsibleBlock meta={`${rows.length} shown`} title="Recurring candidates">
          <div className="compact-list">
            {rows.map((commitment) => (
              <div className="compact-row" key={commitment.id}>
                {editingCommitment?.id === commitment.id ? (
                  <form className="commitment-inline-edit" onSubmit={(event) => void saveCommitmentEdit(event)}>
                    <label>
                      Reference name
                      <input
                        aria-label={`Reference name for ${commitment.name}`}
                        onChange={(event) =>
                          setEditingCommitment((current) =>
                            current ? { ...current, name: event.target.value } : current,
                          )
                        }
                        required
                        value={editingCommitment.name}
                      />
                    </label>
                    <label>
                      Category
                      <input
                        aria-label={`Category for ${commitment.name}`}
                        onChange={(event) =>
                          setEditingCommitment((current) =>
                            current ? { ...current, category: event.target.value } : current,
                          )
                        }
                        required
                        value={editingCommitment.category}
                      />
                    </label>
                    <button className="button-link button-link-small" type="submit">Save details</button>
                    <button
                      className="button-link button-link-small button-link-secondary"
                      onClick={() => setEditingCommitment(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div>
                    <strong>{commitment.name}</strong>
                    <small>
                      {commitment.category} · {commitment.frequency} · next {commitment.next_due_date ?? "unknown"} · {commitment.status}
                      {commitment.occurrence_count ? ` · ${commitment.occurrence_count} payment plan` : ""}
                      {commitment.end_date ? ` · ends ${commitment.end_date}` : ""}
                    </small>
                  </div>
                )}
                <span className="amount">{money(commitment.expected_amount)}</span>
                {onCommitmentUpdate ? (
                  <div className="row-actions">
                    {editingCommitment?.id !== commitment.id ? (
                      <button onClick={() => startCommitmentEdit(commitment)} type="button">
                        Edit details
                      </button>
                    ) : null}
                    {commitment.status === "candidate" ? (
                      <>
                    <button
                      onClick={() => void onCommitmentUpdate(commitment.id, { status: "confirmed" })}
                      type="button"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => void onCommitmentUpdate(commitment.id, { status: "rejected" })}
                      type="button"
                    >
                      Ignore
                    </button>
                      </>
                    ) : null}
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

function isRecurringSourceTransaction(transaction: TransactionSummary) {
  if (Number(transaction.amount) >= 0) return false;
  if (transaction.is_transfer_candidate) return false;
  if (["income", "internal_transfer_candidate", "ignored"].includes(transaction.transaction_type)) return false;
  return transaction.status === "posted";
}

function guessCommitmentTypeFromTransaction(transaction: TransactionSummary) {
  const text = `${transaction.merchant_name} ${transaction.description} ${transaction.source_category}`.toLowerCase();
  if (transaction.transaction_type === "debt_payment") return "loan_payment";
  if (["klarna", "clearpay", "paypal pay in", "bnpl"].some((token) => text.includes(token))) return "bnpl";
  if (["amex", "american exp", "barclaycard", "aqua", "vanquis", "credit card"].some((token) => text.includes(token))) {
    return "credit_card_payment";
  }
  if (["netflix", "spotify", "prime", "youtube", "apple", "subscription"].some((token) => text.includes(token))) {
    return "subscription";
  }
  if (["loan", "updraft", "finance"].some((token) => text.includes(token))) return "loan_payment";
  return "bill";
}

function commitmentDraftFromTransaction(transaction: TransactionSummary): CommitmentDraft {
  return {
    amount: transactionAmountForInput(transaction.amount),
    category: transaction.source_category || titleCase(transaction.normalized_group) || "Bills",
    endDate: "",
    frequency: "monthly",
    name: friendlyCommitmentName(transaction.merchant_name || transaction.description),
    nextDueDate: addMonthsIso(transaction.date, 1),
    occurrenceCount: "",
    sourceTransactionId: transaction.id,
    sourceTransactionLabel: `${transaction.date} · ${transaction.account_name} · ${money(transaction.amount)}`,
    type: guessCommitmentTypeFromTransaction(transaction),
  };
}

function friendlyCommitmentName(label: string) {
  const cleaned = label
    .replace(/[/*_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Transaction-backed commitment";
  return cleaned === cleaned.toUpperCase() ? titleCase(cleaned.toLowerCase()) : cleaned;
}

function transactionAmountForInput(amount: string) {
  const normalized = Math.abs(Number(amount));
  if (!Number.isFinite(normalized)) return "";
  return normalized.toFixed(2).replace(/\.00$/, "");
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
      <CardHeader title="Planning Risk" subtitle={`Forecast confidence for dated bills · ${candidateMode}`} />
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
          ? "Confirmed bills affect projected balances. Candidate bills are visible risk items until reviewed."
          : "Only confirmed bills affect projected balances. Turn on candidates to see unconfirmed risk."}
        {preview || transactions || transferResult || commitmentResult || commitments ? "" : " Import data to begin."}
      </p>
      <div className="card-actions">
        <a className="button-link" href="#/cash-flow">Open cash flow</a>
        <a className="button-link button-link-secondary" href="#/calendar">Open calendar</a>
      </div>
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
  const incomeAdjustmentInvalid = !isValidMoneyInput(scenarioForm.incomeAdjustment, { allowEmpty: true });
  const outflowAdjustmentInvalid = !isValidMoneyInput(scenarioForm.outflowAdjustment, { allowEmpty: true });
  const totals = reportTotals(insights);
  const pressure = Number(dashboard?.flexible_spend_actual ?? 0) + Number(upcoming?.expected_total ?? 0);
  const cash = Number(dashboard?.cash_on_hand ?? 0);
  const pressureRatio = cash > 0 ? Math.min(100, (pressure / cash) * 100) : 0;
  const nextItems = (upcoming?.items ?? []).slice(0, 5);
  const baselineEnding = Number(forecast?.projected_ending_balance ?? dashboard?.available_after_commitments ?? 0);
  const bestScenario = controlState.scenarios[0];
  const addScenario = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (incomeAdjustmentInvalid || outflowAdjustmentInvalid) return;
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
              aria-invalid={incomeAdjustmentInvalid}
              inputMode="decimal"
              onChange={(event) => setScenarioForm({ ...scenarioForm, incomeAdjustment: event.target.value })}
              placeholder="250"
              value={scenarioForm.incomeAdjustment}
            />
            {incomeAdjustmentInvalid ? <small className="field-error">Enter a valid number.</small> : null}
          </label>
          <label>
            Outflow change
            <input
              aria-invalid={outflowAdjustmentInvalid}
              inputMode="decimal"
              onChange={(event) => setScenarioForm({ ...scenarioForm, outflowAdjustment: event.target.value })}
              placeholder="-150"
              value={scenarioForm.outflowAdjustment}
            />
            {outflowAdjustmentInvalid ? <small className="field-error">Enter a valid number.</small> : null}
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
            <button disabled={incomeAdjustmentInvalid || outflowAdjustmentInvalid} type="submit">Add scenario</button>
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
  insights,
  planning,
}: {
  controlState: PlanningControlState;
  insights: InsightsResponse | null;
  planning: PlanningOverview | null;
}) {
  const rows = budgetRows(controlState, insights);
  const totals = budgetTotals(rows, insights);
  const customGoal = controlState.goals[0];
  const derivedGoal = planning?.goals[0];
  const hasBudgetPlan = rows.some((row) => row.plannedAmount > 0 || Math.abs(row.actualAmount) > 0);
  const hasGoals = controlState.goals.length > 0 || (planning?.goals.length ?? 0) > 0;
  const monthlySetAside =
    controlState.goals.reduce((sum, goal) => sum + goal.monthlyContribution, 0) +
    (planning?.goals ?? []).reduce((sum, goal) => sum + Number(goal.monthly_contribution), 0);
  const goalCount = controlState.goals.length + (planning?.goals.length ?? 0);
  const budgetUsedPercent = totals.plannedOutflow > 0
    ? Math.round((totals.actualOutflow / totals.plannedOutflow) * 100)
    : 0;
  const goalProgressValue = customGoal
    ? goalProgress(customGoal.currentAmount, customGoal.targetAmount)
    : Number(derivedGoal?.progress_percent ?? 0);
  return (
    <article className="card planning-snapshot-card">
      <CardHeader title="Budget & Goals" subtitle="Planned spending and savings progress." />
      {hasBudgetPlan || hasGoals ? (
        <div className="planning-snapshot-grid">
          <div className="snapshot-row snapshot-row-budget-used">
            <div>
              <span>Budget used</span>
              <small>
                {totals.plannedOutflow > 0
                  ? `${money(String(totals.actualOutflow))} of ${money(String(totals.plannedOutflow))}`
                  : "Create a budget to track usage"}
              </small>
            </div>
            <strong className={budgetUsedPercent > 100 ? "negative-text" : ""}>{budgetUsedPercent}%</strong>
          </div>
          <div className="snapshot-row">
            <div>
              <span>Remaining</span>
              <small>{totals.remaining >= 0 ? "Still available in budget" : "Over planned budget"}</small>
            </div>
            <strong className={totals.remaining >= 0 ? "positive-text" : "negative-text"}>{money(String(totals.remaining))}</strong>
          </div>
          <div className="snapshot-row">
            <div>
              <span>Primary goal</span>
              <small>{customGoal?.name ?? derivedGoal?.name ?? "Create a savings target"}</small>
            </div>
            <strong>{goalProgressValue.toFixed(0)}%</strong>
          </div>
          <div className="snapshot-row">
            <div>
              <span>Monthly set-aside</span>
              <small>{goalCount} active {goalCount === 1 ? "goal" : "goals"}</small>
            </div>
            <strong>{monthlySetAside ? money(String(monthlySetAside)) : "-"}</strong>
          </div>
        </div>
      ) : (
        <p className="empty-copy">
          Import transactions, create a budget, or add a goal to unlock this planning snapshot.
        </p>
      )}
      <div className="card-actions">
        <a className="button-link" href="#/budget">Open budget</a>
        <a className="button-link button-link-secondary" href="#/goals">Manage goals</a>
      </div>
    </article>
  );
}

function PlanningAssumptionsPanel({
  controlState,
  onControlStateChange,
  safeSpend,
}: {
  controlState: PlanningControlState;
  onControlStateChange: (state: PlanningControlState | ((current: PlanningControlState) => PlanningControlState)) => void;
  safeSpend: ReturnType<typeof safeSpendPlan>;
}) {
  const updateAssumption = (key: keyof PlanningAssumptions, value: PlanningAssumptions[keyof PlanningAssumptions]) => {
    onControlStateChange((current) => ({
      ...current,
      planningAssumptions: {
        ...defaultPlanningControlState.planningAssumptions,
        ...current.planningAssumptions,
        [key]: value,
      },
    }));
  };

  return (
    <div className="assumption-panel">
      <div className="assumption-panel-copy">
        <strong>Safe-spend assumptions</strong>
        <small>
          Use this Budget workbench to temper dashboard facts for job changes, holidays, one-off income, and minimum overdraft headroom.
        </small>
      </div>
      <div className="budget-summary-grid">
        <Metric label="Safe to spend" value={money(String(safeSpend.value))} />
        <Metric label="Cash capacity" value={money(String(safeSpend.cashCapacity))} />
        <Metric label="Adjusted surplus" value={money(String(safeSpend.assumptionAdjustedSurplus))} />
        <Metric label="Assumption deductions" value={money(String(safeSpend.assumptionDeductions))} />
      </div>
      <div className="assumption-grid">
        <label>
          Expected income still to arrive
          <input
            inputMode="decimal"
            onChange={(event) => updateAssumption("expectedIncomeAmount", numberFromInput(event.target.value))}
            placeholder="0.00"
            value={moneyInputValue(controlState.planningAssumptions.expectedIncomeAmount)}
          />
        </label>
        <label>
          Income label
          <input
            onChange={(event) => updateAssumption("expectedIncomeLabel", event.target.value)}
            placeholder="Salary, bonus, reimbursement..."
            value={controlState.planningAssumptions.expectedIncomeLabel}
          />
        </label>
        <label>
          Exclude one-off income
          <input
            inputMode="decimal"
            onChange={(event) => updateAssumption("oneOffIncomeExclusions", numberFromInput(event.target.value))}
            placeholder="0.00"
            value={moneyInputValue(controlState.planningAssumptions.oneOffIncomeExclusions)}
          />
        </label>
        <label>
          Lifestyle allowance left
          <input
            inputMode="decimal"
            onChange={(event) => updateAssumption("lifestyleAllowance", numberFromInput(event.target.value))}
            placeholder="Groceries, travel, family..."
            value={moneyInputValue(controlState.planningAssumptions.lifestyleAllowance)}
          />
        </label>
        <label>
          Known upcoming costs
          <input
            inputMode="decimal"
            onChange={(event) => updateAssumption("knownUpcomingCosts", numberFromInput(event.target.value))}
            placeholder="Holiday, school, repairs..."
            value={moneyInputValue(controlState.planningAssumptions.knownUpcomingCosts)}
          />
        </label>
        <label>
          Safety buffer / overdraft headroom
          <input
            inputMode="decimal"
            onChange={(event) => updateAssumption("safetyBuffer", numberFromInput(event.target.value))}
            placeholder="Minimum never-cross balance"
            value={moneyInputValue(controlState.planningAssumptions.safetyBuffer)}
          />
        </label>
        <label>
          Income confidence
          <select
            onChange={(event) =>
              updateAssumption("incomeConfidence", event.target.value as PlanningAssumptions["incomeConfidence"])
            }
            value={controlState.planningAssumptions.incomeConfidence}
          >
            <option value="stable">Stable</option>
            <option value="variable">Variable</option>
            <option value="changing">Changing job/income</option>
          </select>
        </label>
        <label>
          Lookback baseline
          <select
            onChange={(event) =>
              updateAssumption("lookbackMonths", event.target.value as PlanningAssumptions["lookbackMonths"])
            }
            value={controlState.planningAssumptions.lookbackMonths}
          >
            <option value="1">1 month evidence</option>
            <option value="3">3 month evidence</option>
            <option value="6">6 month evidence</option>
          </select>
        </label>
        <label className="checkbox-label assumption-checkbox">
          <input
            aria-label="Job or income change expected"
            checked={controlState.planningAssumptions.jobChangeExpected}
            onChange={(event) => updateAssumption("jobChangeExpected", event.target.checked)}
            type="checkbox"
          />
          Job or income change expected
        </label>
      </div>
      <p className="spending-plan-formula">
        Formula: safe spend = min(cash capacity {money(String(safeSpend.cashCapacity))}, adjusted surplus {money(String(safeSpend.assumptionAdjustedSurplus))}).
        Lookback is evidence only: {controlState.planningAssumptions.lookbackMonths} month(s).
      </p>
    </div>
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
  const planSegments = spendingPlanSegments(plan);
  const allocated = plan.obligations + plan.goalContributions + plan.flexibleActual;
  const safeSpend = safeSpendPlan(controlState, dashboard, plan);
  const leftLabel = safeSpend.value >= 0 ? "Safe to spend" : "Over committed";
  const hasPlanData = plan.income > 0 || allocated > 0;

  return (
    <article className="card spending-plan-card">
      <CardHeader
        helpText="Safe to spend is capped by available cash and adjusted by your planning assumptions. The period surplus remains visible as evidence, not as spendable cash."
        title="Spending Plan"
        subtitle="Cash-constrained plan using your assumptions."
      />
      {hasPlanData ? (
        <>
          <div className="spending-plan-hero">
            <span>
              {leftLabel}
              <HelpTip text="The lower of available cash capacity and assumption-adjusted period surplus after buffers, lifestyle allowance, known upcoming costs, and one-off income exclusions." />
            </span>
            <strong className={safeSpend.value >= 0 ? "positive-text" : "negative-text"}>{money(String(safeSpend.value))}</strong>
            {!safeSpend.assumptionsReady ? (
              <small>
                Tune assumptions in Budget before treating this as decision-grade.
              </small>
            ) : dashboard?.confidence !== "ready" ? (
              <small>
                Add balances in <a href="#/accounts">Accounts</a> to improve confidence.
              </small>
            ) : null}
          </div>
          <div
            className="spending-plan-stack"
            aria-label={`Spending allocation. Income ${money(String(plan.income))}, bills and subscriptions ${money(String(plan.obligations))}, savings goals ${money(String(plan.goalContributions))}, flexible actual ${money(String(plan.flexibleActual))}, safe to spend ${money(String(safeSpend.value))}.`}
          >
            {planSegments.length > 0 ? (
              planSegments.map((segment) => (
                <span
                  className="spending-plan-segment"
                  key={segment.label}
                  style={{ background: segment.color, width: `${segment.percent}%` }}
                  title={`${segment.label}: ${money(String(segment.value))}`}
                />
              ))
            ) : (
              <span className="spending-plan-segment spending-plan-empty" />
            )}
          </div>
          <div className="spending-plan-legend" aria-label="Spending plan legend">
            {planSegments.map((segment) => (
              <span key={segment.label}>
                <i style={{ background: segment.color }} />
                {segment.label}
              </span>
            ))}
          </div>
          <div className="budget-summary-grid">
            <Metric
              helpText="Imported income minus one-off income exclusions."
              label="Adjusted income"
              value={money(String(safeSpend.adjustedIncome))}
            />
            <Metric
              helpText="Expected bill and subscription amounts in the selected planning window."
              label="Bills/subscriptions"
              value={money(String(plan.obligations))}
            />
            <Metric
              helpText="Monthly contributions for active savings goals."
              label="Savings goals"
              value={money(String(plan.goalContributions))}
            />
            <Metric
              helpText="Flexible spending already found in the selected transaction period."
              label="Flexible actual"
              value={money(String(plan.flexibleActual))}
            />
            <Metric
              helpText="Imported period surplus before cash and assumption safety caps."
              label="Period surplus"
              value={money(String(plan.leftToSpend))}
            />
          </div>
          <p className="spending-plan-formula">
            Fact-led summary: cash capacity {money(String(safeSpend.cashCapacity))}; period surplus {money(String(plan.leftToSpend))}.
            Tune assumptions in Budget to adjust for income changes, trips, buffers, and one-off items.
          </p>
        </>
      ) : (
        <p className="empty-copy">
          Import income and bills, then tune a budget to calculate what is genuinely left to spend.
        </p>
      )}
      <div className="card-actions">
        <a className="button-link" href="#/budget">Tune assumptions</a>
        <a className="button-link button-link-secondary" href="#/cash-flow">Scenario plan</a>
      </div>
    </article>
  );
}

function ReviewFocusCard({
  decisions,
  planning,
  transactions,
}: {
  decisions: DecisionQueueResponse | null;
  planning: PlanningOverview | null;
  transactions: TransactionsResponse | null;
}) {
  const review = planning?.monthly_review;
  const unreviewed = review?.unreviewed_count ?? 0;
  const reviewed = review?.reviewed_count ?? 0;
  const reviewTotal = Math.max(1, reviewed + unreviewed);
  const reviewPercent = Math.round((reviewed / reviewTotal) * 100);
  const decisionCount = decisions?.total_count ?? 0;
  const staleCount = planning?.stale_commitments.length ?? 0;
  const transactionCount = transactions?.total_count ?? 0;
  const urgency = decisionCount + staleCount + unreviewed;

  return (
    <article className="card review-focus-card">
      <CardHeader
        title="Review Actions"
        subtitle={urgency > 0 ? `${urgency} items can improve accuracy` : "Everything important looks tidy"}
      />
      <div className="review-focus-hero">
        <div>
          <span>Review coverage</span>
          <strong>{reviewPercent}%</strong>
          <small>{reviewed} reviewed · {unreviewed} left</small>
        </div>
        <div className="review-focus-ring" aria-label={`${reviewPercent}% reviewed`}>
          <span style={{ width: `${reviewPercent}%` }} />
        </div>
      </div>
      <div className="review-focus-grid">
        <a href="#/transactions?reviewed=unreviewed">
          <span>Unreviewed transactions</span>
          <strong>{unreviewed}</strong>
        </a>
        <a href="#/decision-queue">
          <span>Open decisions</span>
          <strong>{decisionCount}</strong>
        </a>
        <a href="#/recurring">
          <span>Stale bills</span>
          <strong>{staleCount}</strong>
        </a>
        <a href="#/transactions">
          <span>Transactions in view</span>
          <strong>{transactionCount}</strong>
        </a>
      </div>
      <p className="fine-print">
        Clear these before trusting reports, budget actuals, and left-to-spend decisions.
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

const CARD_HELP_TEXT: Record<string, string> = {
  Accounts: "Detected accounts from your import. Add current balances and account types here so cash position and forecasts become trustworthy.",
  "Bill Activity": "Bills and subscriptions found in the selected past date range, including paid, planned, and candidate items.",
  "Bills in View": "Bills and subscriptions inside the selected date window.",
  "Budget": "Compares your planned budget with actual spending from the selected date range.",
  "Budget & Goals": "A compact dashboard view of budget usage and savings-goal progress.",
  "Cash Flow": "Shows how income, savings, bills, and spending move through the selected period.",
  "Cash Flow Plan": "Projects upcoming cash pressure and lets you test what-if changes before they happen.",
  Categories: "Local category groups used by budget, review, reporting, and rules workflows.",
  Data: "Local workspace controls, saved planning preferences, import entry points, and reset tools.",
  "Decision Impact": "High-priority review items that can change report accuracy, recurring bills, or forecast confidence.",
  "Decision Queue": "Review and confirm detected transfer matches, recurring candidates, and other decisions before trusting reports.",
  Exports: "Downloads CSV files from the current local view, filters, and planning settings.",
  Goals: "Savings targets and progress plans for future expenses or milestones.",
  "Getting Started": "Import setup steps that turn a raw Snoop CSV into accounts, transactions, bills, and review decisions.",
  "Import Freshness": "Shows how old the imported data is so you know when reports may need a fresh import.",
  Income: "Income report for the selected date range, grouped by the selected report control.",
  Insights: "Ranked category and merchant summaries from the current report period.",
  Merchants: "Merchant display names and aliases used across transaction review and reports.",
  "Monthly Review": "A month-end checklist for income, outflows, review coverage, decisions, and saved views.",
  "Net Worth Performance": "A visual account-balance trend based on the balances currently entered for your accounts.",
  "Period Activity": "These totals come from transactions in the selected date range. They are activity totals, not current account balances.",
  "Personalize your workspace": "The saved name is used for greetings and workspace copy before and after import.",
  "Planned Bills": "Bills and subscriptions planned for the selected future date range.",
  "Planning Risk": "Forecast risk from dated bills, candidates, and open decisions.",
  Recurring: "Detected repeating bills, subscriptions, and recurring income candidates.",
  Reports: "Visual reports for income, spending, cash flow, and exportable insight views.",
  "Review Actions": "Open review work that improves transaction quality, reports, and forecast confidence.",
  Rules: "Preview-style local rules for renaming, tagging, and recategorising transactions.",
  "Saved Filters": "Reusable report and transaction drilldowns saved for quick future access.",
  "Service Status": "Checks whether the local backend API is online and reachable from the frontend.",
  "Sinking Funds": "Named savings pots for irregular or future expenses.",
  Spending: "Spending report for the selected date range, grouped by the selected report control.",
  "Spending Plan": "This is not account cash. It is a period plan: imported income less expected bills/subscriptions, goal set-asides, and flexible spending already seen.",
  "Stale Commitments": "Recurring items whose due date has passed and may need review, rescheduling, or confirmation.",
  Subscriptions: "Recurring services and bills that may deserve cancellation, confirmation, or review.",
  Summary: "Assets and liabilities grouped from the current account list.",
  Tags: "Local labels for review, tax, reimbursement, subscription, business, or split notes.",
  "This Month’s Bills": "Bills and subscriptions in the current month, including paid, planned, and candidate items depending on the candidate toggle.",
  Transactions: "Imported transaction rows with filters, review status, categories, accounts, and editable transaction type.",
};

const METRIC_HELP_TEXT: Record<string, string> = {
  "Actual outflow": "Spending already found in the selected date range.",
  "After candidates": "Current included cash minus confirmed bills and candidate bills. Candidates only count after review.",
  "After confirmed bills": "Current included cash minus confirmed bills in the 30-day planning queue.",
  "Allocated total": "Bills/subscriptions plus savings goals plus flexible spend already tracked.",
  "Bills in window": "Bills and subscriptions dated inside the current forecast window.",
  "Bills/subscriptions": "Expected bill and subscription amounts in the selected planning window.",
  "Budget rows": "Number of custom budget rows saved locally.",
  "Busiest day": "The calendar day with the highest planned bill total in this view.",
  "Candidate bills": "Detected bill candidates waiting for review. These show risk but do not become trusted bills until confirmed.",
  "Candidate due": "Detected candidate bills in the forecast window that are not yet confirmed.",
  "Cash pressure": "How much current cash is covered by near-term spending pressure.",
  "Change": "Difference between the baseline and this scenario estimate.",
  "Confirmed bills": "Bills already trusted enough to affect the 30-day cash-flow forecast.",
  "Confirmed due": "Confirmed bills in the planning queue.",
  "Current": "Amount currently saved or entered for this goal.",
  "Custom goals": "Number of user-created goals saved locally.",
  "Days old": "Days since the newest imported transaction.",
  "Decisions open": "Open review decisions that can improve report or forecast accuracy.",
  "Ending cash": "Projected cash after forecasted confirmed events.",
  "Flexible actual": "Flexible spending already found in the selected transaction period.",
  "Flexible left": "Default flexible guardrail minus flexible spending in this selected period.",
  "Income": "Income transactions in the selected period.",
  "Income actual": "Income already found in the selected date range.",
  "Latest import": "Most recent import date recorded by the local API.",
  "Latest transaction": "Newest transaction date currently loaded.",
  "Left to spend": "What remains after this period's income funds expected bills, goal set-asides, and flexible spending already tracked.",
  "Lowest point": "Lowest projected cash balance in the forecast timeline.",
  "Monthly set aside": "Monthly contribution planned for this goal.",
  "Open decisions": "Decision-queue items still waiting for confirmation or rejection.",
  "Outflows": "Expense, bill, debt, and flexible spending out of the account set.",
  "Planned days": "Number of days in this calendar view that contain planned bills.",
  "Planned outflow": "Budgeted spending planned for the selected period.",
  "Planned total": "Total expected bills and planned commitments in this calendar view.",
  "Remaining": "Amount still needed, or budget left after actual outflow.",
  "Reviewed": "Transactions already marked reviewed in the monthly review workflow.",
  "Rules": "Number of local automation rules saved in Settings.",
  "Saved filters": "Saved views available for reports and transaction review.",
  "Savings goals": "Monthly contributions for active savings goals.",
  "Scenario ending": "Projected ending cash after applying this what-if scenario.",
  "Starting cash": "Cash balance used as the forecast starting point.",
  "Tags": "Number of local transaction tags available in Settings.",
  "Target": "Goal amount you are saving toward.",
  "Top group": "Largest visible category group in the current report period.",
  "Unreviewed": "Transactions still waiting for review.",
};

function CardHeader({
  helpText,
  title,
  subtitle,
}: {
  helpText?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="card-header">
      <div>
        <h2 aria-label={title}>
          {title}
          {helpText ?? CARD_HELP_TEXT[title] ? <HelpTip text={helpText ?? CARD_HELP_TEXT[title]} /> : null}
        </h2>
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
  const [parent] = useAutoAnimate<HTMLDivElement>({
    duration: 180,
    easing: "ease-out",
  });

  if (rows.length === 0) {
    return <p className="empty-copy">{empty}</p>;
  }

  return (
    <div className="compact-list" ref={parent}>
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
  const [parent] = useAutoAnimate<HTMLElement>({
    duration: 180,
    easing: "ease-out",
  });

  return (
    <section className="collapsible-block" ref={parent}>
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

function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip">
      <button aria-label="Show help" title={text} type="button">?</button>
      <span className="help-tip-content" role="tooltip">{text}</span>
    </span>
  );
}

function Metric({
  helpText,
  label,
  value,
}: {
  helpText?: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric">
      <span className="metric-label">
        {label}
        {helpText ?? METRIC_HELP_TEXT[label] ? <HelpTip text={helpText ?? METRIC_HELP_TEXT[label]} /> : null}
      </span>
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

function getPageTitle(route: RouteId, userName: string) {
  if (route !== "dashboard") return pageTitles[route];
  return {
    ...pageTitles.dashboard,
    title: userName ? `${timeOfDayGreeting()}, ${userName}.` : `${timeOfDayGreeting()}.`,
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
  if (periodKind === "past") return "Bill Activity";
  if (periodKind === "future") return "Planned Bills";
  if (periodLabel === "This month") return "This Month’s Bills";
  return "Bills in View";
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

const planningControlStorageKey = "personal-finance-studio.phase-2-controls";
const oldPlanningControlStorageKey = "personal-finance-studio.phase-1-75-controls";
const userNameStorageKey = "personal-finance-studio.user-name";

const defaultPlanningControlState: PlanningControlState = {
  budgetMode: "category",
  budgetRows: [
    { group: "debt", plannedAmount: 0 },
    { group: "fixed", plannedAmount: 0 },
    { group: "flexible", plannedAmount: 0 },
    { group: "non_monthly", plannedAmount: 0 },
  ],
  categories: [
    { group: "income", id: "category-paychecks", name: "Paychecks", type: "income" },
    { group: "fixed", id: "category-home", name: "Home & utilities", type: "expense" },
    { group: "flexible", id: "category-groceries", name: "Groceries", type: "expense" },
    { group: "debt", id: "category-debt", name: "Debt payments", type: "expense" },
  ],
  customDashboardWidgets: [],
  dashboardWidgetOrder: [...defaultDashboardWidgetIds],
  hiddenDashboardWidgets: [],
  goals: [],
  merchants: [],
  planningAssumptions: {
    expectedIncomeAmount: 0,
    expectedIncomeLabel: "",
    incomeConfidence: "stable",
    jobChangeExpected: false,
    knownUpcomingCosts: 0,
    lifestyleAllowance: 0,
    lookbackMonths: "3",
    oneOffIncomeExclusions: 0,
    safetyBuffer: 0,
  },
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
    return normalizePlanningControlState(JSON.parse(raw));
  } catch {
    return defaultPlanningControlState;
  }
}

function normalizePlanningControlState(value: Partial<PlanningControlState>): PlanningControlState {
  const merged = {
    ...defaultPlanningControlState,
    ...value,
    planningAssumptions: {
      ...defaultPlanningControlState.planningAssumptions,
      ...value.planningAssumptions,
    },
  };
  return {
    ...merged,
    customDashboardWidgets: merged.customDashboardWidgets ?? [],
    dashboardWidgetOrder: dashboardWidgetOrder(merged as PlanningControlState),
    hiddenDashboardWidgets: merged.hiddenDashboardWidgets ?? [],
  } as PlanningControlState;
}

function writePlanningControlState(state: PlanningControlState) {
  try {
    window.localStorage.setItem(planningControlStorageKey, JSON.stringify(state));
  } catch {
    // Local preferences are helpful but should not block the finance UI.
  }
}

function readUserName(): string {
  try {
    return cleanUserName(window.localStorage.getItem(userNameStorageKey) ?? "");
  } catch {
    return "";
  }
}

function writeUserName(name: string) {
  try {
    const cleanName = cleanUserName(name);
    if (cleanName) {
      window.localStorage.setItem(userNameStorageKey, cleanName);
    } else {
      window.localStorage.removeItem(userNameStorageKey);
    }
  } catch {
    // Local personalization should not block the finance UI.
  }
}

function cleanUserName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

function clearLocalWorkspacePreferences() {
  try {
    window.localStorage.removeItem(planningControlStorageKey);
    window.localStorage.removeItem(oldPlanningControlStorageKey);
    window.localStorage.removeItem(userNameStorageKey);
  } catch {
    // Reset still succeeds server-side if localStorage is unavailable.
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

function moneyInputValue(value: number) {
  return value ? value.toFixed(2) : "";
}

function dashboardWidgetOrder(controlState: PlanningControlState) {
  const customIds = controlState.customDashboardWidgets.map((widget) => `custom:${widget.id}`);
  const knownIds = [...defaultDashboardWidgetIds, ...customIds];
  const savedOrder = controlState.dashboardWidgetOrder.filter((id) => knownIds.includes(id));
  return [...savedOrder, ...knownIds.filter((id) => !savedOrder.includes(id))];
}

function dashboardWidgetTitle(widgetId: string, controlState: PlanningControlState) {
  if (widgetId.startsWith("custom:")) {
    return controlState.customDashboardWidgets.find((widget) => `custom:${widget.id}` === widgetId)?.title ?? "Custom widget";
  }
  const titles: Record<string, string> = {
    "cash-position": "Cash Position",
    cashflow: "Cash Flow",
    "decision-queue": "Decision Queue",
    "planning-snapshot": "Budget & Goals",
    "review-focus": "Review Focus",
    spending: "Spending Pulse",
    "spending-plan": "Spending Plan",
    upcoming: "Bills",
  };
  return titles[widgetId] ?? titleCase(widgetId);
}

function isValidMoneyInput(value: string, { allowEmpty }: { allowEmpty: boolean }) {
  const normalized = value.replace(/[£,\s]/g, "");
  if (!normalized) return allowEmpty;
  return /^-?\d+(\.\d{1,2})?$/.test(normalized);
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

function safeSpendPlan(
  controlState: PlanningControlState,
  dashboard: DashboardSummary | null,
  plan: ReturnType<typeof spendingPlanTotals>,
) {
  const assumptions = {
    ...defaultPlanningControlState.planningAssumptions,
    ...controlState.planningAssumptions,
  };
  const cashCapacity = Number(dashboard?.available_after_commitments ?? dashboard?.cash_on_hand ?? 0);
  const adjustedIncome = Math.max(0, plan.income - assumptions.oneOffIncomeExclusions);
  const assumptionDeductions =
    assumptions.knownUpcomingCosts +
    assumptions.lifestyleAllowance +
    assumptions.safetyBuffer;
  const confidenceHaircut =
    assumptions.incomeConfidence === "stable" && !assumptions.jobChangeExpected
      ? 0
      : assumptions.incomeConfidence === "variable"
        ? Math.max(assumptions.expectedIncomeAmount * 0.25, 0)
        : Math.max(assumptions.expectedIncomeAmount * 0.5, 0);
  const assumptionAdjustedSurplus =
    adjustedIncome +
    assumptions.expectedIncomeAmount -
    confidenceHaircut -
    plan.obligations -
    plan.goalContributions -
    plan.flexibleActual -
    assumptionDeductions;
  const assumptionsReady = [
    assumptions.expectedIncomeAmount,
    assumptions.knownUpcomingCosts,
    assumptions.lifestyleAllowance,
    assumptions.oneOffIncomeExclusions,
    assumptions.safetyBuffer,
  ].some((value) => value > 0) || assumptions.incomeConfidence !== "stable" || assumptions.jobChangeExpected;

  return {
    adjustedIncome,
    assumptionAdjustedSurplus,
    assumptionDeductions,
    assumptionsReady,
    cashCapacity,
    confidenceHaircut,
    value: Math.min(cashCapacity, assumptionAdjustedSurplus),
  };
}

function spendingPlanSegments(plan: ReturnType<typeof spendingPlanTotals>) {
  const allocated = plan.obligations + plan.goalContributions + plan.flexibleActual;
  const denominator = Math.max(plan.income, allocated, 1);
  const rawSegments = [
    { color: "#d43c95", label: "Bills/subscriptions", value: plan.obligations },
    { color: "#d99a2b", label: "Savings goals", value: plan.goalContributions },
    { color: "#2587a6", label: "Flexible actual", value: plan.flexibleActual },
    plan.leftToSpend >= 0
      ? { color: "#2f7d5c", label: "Period surplus", value: plan.leftToSpend }
      : { color: "#b85c5c", label: "Over planned income", value: Math.abs(plan.leftToSpend) },
  ].filter((segment) => segment.value > 0.005);

  return rawSegments.map((segment) => ({
    ...segment,
    percent: Math.max(4, (segment.value / denominator) * 100),
  }));
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
      const liability = Number(account.liability_balance ?? 0);
      const label = titleCase(account.account_type === "unknown" ? account.provider : account.account_type);
      if (value > 0 && !["credit_card", "loan", "bnpl"].includes(account.account_type)) {
        groups.assets[label] = (groups.assets[label] ?? 0) + Math.max(0, value);
      }
      if (liability > 0 || ["credit_card", "loan", "bnpl"].includes(account.account_type)) {
        groups.liabilities[label] = (groups.liabilities[label] ?? 0) + Math.max(liability, Math.abs(Math.min(value, 0)));
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

function addMonthsIso(isoDate: string, months: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const originalDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
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
