import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  type AccountsResponse,
  type CommitmentDetectionResult,
  type CommitmentsResponse,
  type DashboardSummary,
  type DecisionQueueResponse,
  type ForecastResponse,
  type ImportCommitResult,
  type ImportPreview,
  type InsightsResponse,
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
  getInsights,
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
type PeriodPreset = "this-month" | "last-30" | "next-15" | "next-30" | "custom";
type TransactionFilterState = {
  accountId: string;
  normalizedGroup: string;
  reviewed: "all" | "reviewed" | "unreviewed";
  status: string;
  transactionType: string;
};

const navItems = [
  { label: "Dashboard", route: "dashboard" },
  { label: "Accounts", route: "accounts" },
  { label: "Transactions", route: "transactions" },
  { label: "Cash Flow", route: "cash-flow" },
  { label: "Calendar", route: "calendar" },
  { label: "Recurring", route: "recurring" },
  { label: "Reports", route: "reports" },
  { label: "Decision Queue", route: "decision-queue" },
] as const;

type RouteId = (typeof navItems)[number]["route"];

const pageTitles: Record<RouteId, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "Household workspace", title: "Good afternoon, Kiran." },
  accounts: { eyebrow: "Accounts", title: "Review balances and account roles." },
  transactions: { eyebrow: "Transactions", title: "Understand where the money moved." },
  "cash-flow": { eyebrow: "Cash flow", title: "See what is coming next." },
  calendar: { eyebrow: "Calendar", title: "Plan bills by date." },
  recurring: { eyebrow: "Recurring", title: "Confirm bills, subscriptions, and debt payments." },
  reports: { eyebrow: "Reports", title: "Spot spending patterns." },
  "decision-queue": { eyebrow: "Decision queue", title: "Resolve only the decisions that matter." },
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

  const busy = loadState === "loading";
  const pageTitle = pageTitles[route];
  const dateWindow = useMemo(
    () => getDateWindow(periodPreset, customStartDate, customEndDate),
    [customEndDate, customStartDate, periodPreset],
  );
  const transactionQuery = useMemo(
    () => buildTransactionFilters(dateWindow, transactionFilters, searchQuery),
    [dateWindow, searchQuery, transactionFilters],
  );

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
      setRoute(currentRoute());
    }

    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/dashboard");
    }

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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
    ]);
    setAccounts(accountsResult);
    setTransactions(transactionsResult);
    setCommitments(commitmentsResult);
    setDecisions(decisionsResult);
    setDashboard(dashboardResult);
    setUpcoming(upcomingResult);
    setForecast(forecastResult);
    setInsights(insightsResult);
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
            />
            <span className="local-badge">Local data</span>
          </div>
        </header>

        {error ? <p className="error-banner">{error}</p> : null}

        <AppPage
          accounts={accounts}
          busy={busy}
          commitmentResult={commitmentResult}
          commitments={commitments}
          commitResult={commitResult}
          dashboard={dashboard}
          decisions={decisions}
          forecast={forecast}
          insights={insights}
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
          transactions={transactions}
          onTransactionUpdate={runTransactionUpdate}
          periodLabel={dateWindow.label}
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

function PeriodControls({
  customEndDate,
  customStartDate,
  includeCandidates,
  onCustomEndDateChange,
  onCustomStartDateChange,
  onIncludeCandidatesChange,
  onPresetChange,
  preset,
}: {
  customEndDate: string;
  customStartDate: string;
  includeCandidates: boolean;
  onCustomEndDateChange: (value: string) => void;
  onCustomStartDateChange: (value: string) => void;
  onIncludeCandidatesChange: (value: boolean) => void;
  onPresetChange: (value: PeriodPreset) => void;
  preset: PeriodPreset;
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
      <label className="candidate-toggle">
        <input
          checked={includeCandidates}
          onChange={(event) => onIncludeCandidatesChange(event.target.checked)}
          type="checkbox"
        />
        Include candidates
      </label>
    </div>
  );
}

function AppPage({
  accounts,
  busy,
  commitmentResult,
  commitments,
  commitResult,
  dashboard,
  decisions,
  forecast,
  insights,
  onAccountBalanceUpdate,
  onBillPaid,
  onCommit,
  onCommitmentUpdate,
  onDecisionAction,
  onDetectCommitments,
  onDetectTransfers,
  onPreview,
  preview,
  query,
  route,
  periodLabel,
  setTransactionFilters,
  transactions,
  onTransactionUpdate,
  transactionFilters,
  transferResult,
  upcoming,
}: {
  accounts: AccountsResponse | null;
  busy: boolean;
  commitmentResult: CommitmentDetectionResult | null;
  commitments: CommitmentsResponse | null;
  commitResult: ImportCommitResult | null;
  dashboard: DashboardSummary | null;
  decisions: DecisionQueueResponse | null;
  forecast: ForecastResponse | null;
  insights: InsightsResponse | null;
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
      <section className="page-grid page-grid-single" aria-label="Accounts page">
        <AccountsCard
          accounts={accounts}
          busy={busy}
          limit={12}
          onAccountBalanceUpdate={onAccountBalanceUpdate}
          query={query}
        />
        <BudgetCard dashboard={dashboard} />
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
          preview={preview}
          transactions={transactions}
          transferResult={transferResult}
          upcoming={upcoming}
        />
        <UpcomingCard limit={12} onBillPaid={onBillPaid} query={query} upcoming={upcoming} />
      </section>
    );
  }

  if (route === "calendar") {
    return (
      <section className="page-grid page-grid-single" aria-label="Calendar page">
        <UpcomingCard
          limit={30}
          onBillPaid={onBillPaid}
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
        <UpcomingCard limit={12} onBillPaid={onBillPaid} query={query} upcoming={upcoming} />
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
      <section className="page-grid" aria-label="Reports page">
        <InsightsCard insights={insights} periodLabel={periodLabel} />
        <CashflowCard
          commitmentResult={commitmentResult}
          commitments={commitments}
          dashboard={dashboard}
          decisions={decisions}
          forecast={forecast}
          preview={preview}
          transactions={transactions}
          transferResult={transferResult}
          upcoming={upcoming}
        />
      </section>
    );
  }

  return (
    <section className="dashboard-grid" aria-label="Personal Finance Studio dashboard">
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
      <SpendingCard preview={preview} />
      <BudgetCard dashboard={dashboard} />
      <InsightsCard insights={insights} periodLabel={periodLabel} />
      <UpcomingCard onBillPaid={onBillPaid} periodLabel={periodLabel} query={query} upcoming={upcoming} />
      <DecisionQueueCard
        busy={busy}
        decisions={decisions}
        limit={5}
        onDecisionAction={onDecisionAction}
        query={query}
      />
      <CashflowCard
        commitmentResult={commitmentResult}
        commitments={commitments}
        dashboard={dashboard}
        decisions={decisions}
        forecast={forecast}
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

function SpendingCard({ preview }: { preview: ImportPreview | null }) {
  return (
    <article className="card">
      <CardHeader title="Spending" subtitle="Imported inflow vs. outflow" />
      <div className="chart-shell" aria-label="Spending trend placeholder">
        <div className="chart-grid" />
        <svg viewBox="0 0 360 160" role="img" aria-label="Preview spending line">
          <path d="M20 120 C80 118 100 92 150 98 S230 135 340 72" className="line muted-line" />
          <path d="M20 126 C90 124 118 122 176 111 S260 85 340 88" className="line active-line" />
        </svg>
      </div>
      <div className="split-metrics">
        <Metric label="Inflow" value={preview ? money(preview.inflow_total) : "-"} />
        <Metric label="Outflow" value={preview ? money(preview.outflow_total) : "-"} />
      </div>
    </article>
  );
}

function BudgetCard({ dashboard }: { dashboard: DashboardSummary | null }) {
  const hasCashOnHand = dashboard?.cash_on_hand !== null && dashboard?.cash_on_hand !== undefined;
  return (
    <article className="card tall-card">
      <CardHeader title="Available Money" subtitle={dashboard?.confidence ?? "Setup needed"} />
      <div className="money-focus">
        <span>Cash on hand</span>
        <strong className={hasCashOnHand ? "metric-value" : undefined}>
          {hasCashOnHand ? money(dashboard.cash_on_hand as string) : "Needs balances"}
        </strong>
        <p>{dashboard?.message ?? "Import data and enter current account balances."}</p>
      </div>
      <div className="split-metrics">
        <Metric
          label="After bills"
          value={dashboard?.available_after_commitments ? money(dashboard.available_after_commitments) : "-"}
        />
        <Metric
          label="Flexible left"
          value={dashboard?.flexible_spend_remaining ? money(dashboard.flexible_spend_remaining) : "-"}
        />
      </div>
      <div className="split-metrics">
        <Metric
          label="Known balances"
          value={`${dashboard?.cash_balance_account_count ?? 0} accounts`}
        />
        <Metric label="Missing" value={`${dashboard?.missing_balance_account_count ?? 0} accounts`} />
      </div>
    </article>
  );
}

function UpcomingCard({
  limit = 6,
  onBillPaid,
  periodLabel,
  query,
  upcoming,
}: {
  limit?: number;
  onBillPaid?: (instanceId: string, amount: string) => Promise<void>;
  periodLabel?: string;
  query: string;
  upcoming: UpcomingCommitmentsResponse | null;
}) {
  const rows = filterByQuery(upcoming?.items ?? [], query, (item) =>
    `${item.commitment_name} ${item.commitment_type} ${item.commitment_status}`,
  ).slice(0, limit);

  return (
    <article className="card">
      <CardHeader
        title="Upcoming"
        subtitle={
          upcoming
            ? `${periodLabel ?? `${upcoming.start_date} to ${upcoming.end_date}`} · ${upcoming.total_count} items · ${money(upcoming.expected_total)}`
            : "Next 30 days"
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

function DecisionQueueCard({
  busy,
  decisions,
  limit = 5,
  query,
  onDecisionAction,
}: {
  busy: boolean;
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
      {Object.keys(decisionCounts).length > 0 ? (
        <div className="decision-summary" aria-label="Decision queue summary">
          {Object.entries(decisionCounts).map(([type, count]) => (
            <span className="decision-summary-pill" key={type}>
              <b>{count}</b>
              {decisionTypeLabel(type)}
            </span>
          ))}
        </div>
      ) : null}
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
  return (
    <article className="card">
      <CardHeader title="Accounts" subtitle={accounts ? `${accounts.accounts.length} detected` : "Connect data"} />
      {rows.length === 0 ? (
        <p className="empty-copy">Commit an import to see accounts.</p>
      ) : (
        <div className="account-review-list">
          {rows.map((account) => (
            <AccountReviewRow
              account={account}
              busy={busy}
              key={account.id}
              onAccountBalanceUpdate={onAccountBalanceUpdate}
            />
          ))}
        </div>
      )}
    </article>
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
      )}
    </article>
  );
}

function CashflowCard({
  dashboard,
  forecast,
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

  return (
    <article className="card forecast-card">
      <CardHeader title="Cash Flow Readiness" subtitle="What is usable for the real dashboard." />
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
      <p className="fine-print">
        Confirmed commitments affect projected balances; candidates are shown separately until reviewed.
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
      <CompactList
        empty="Insights appear after import."
        rows={(insights?.category_groups ?? []).slice(0, 5).map((group) => ({
          title: titleCase(group.group),
          meta: `${group.transaction_count} transactions · outflow ${money(group.outflow_total)}`,
          amount: money(group.net_total),
        }))}
      />
      {(insights?.top_merchants.length ?? 0) > 0 ? (
        <>
          <div className="section-divider" />
          <CardHeader title="Top Merchants" subtitle="Largest outflows in range" />
          <CompactList
            empty="No merchant spend in range."
            rows={(insights?.top_merchants ?? []).slice(0, 5).map((merchant) => ({
              title: merchant.merchant_name,
              meta: `${merchant.transaction_count} transactions`,
              amount: money(merchant.outflow_total),
            }))}
          />
        </>
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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className="metric-value">{value}</strong>
    </div>
  );
}

function completedCount(steps: Array<{ complete: boolean }>) {
  return steps.filter((step) => step.complete).length;
}

function hasDecisionType(decisions: DecisionQueueResponse | null, decisionType: string): boolean {
  return Boolean(decisions?.decisions.some((decision) => decision.decision_type === decisionType));
}

function currentRoute(): RouteId {
  const route = window.location.hash.replace(/^#\/?/, "");
  return navItems.some((item) => item.route === route) ? (route as RouteId) : "dashboard";
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
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function decisionTypeLabel(value: string) {
  if (value === "internal_transfer") return "Transfer match";
  if (value === "commitment_candidate") return "Recurring candidate";
  return titleCase(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
