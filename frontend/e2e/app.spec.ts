import { expect, type Page, test } from "@playwright/test";

const account = {
  account_type: "current",
  current_balance: "1000.00",
  display_name: "HSBC Personal",
  id: "account-1",
  include_in_cash_on_hand: true,
  include_in_forecast: true,
  inflow_total: "3250.00",
  net_total: "2861.01",
  outflow_total: "-388.99",
  provider: "HSBC Personal",
  source_account_name: "GONELA V S K",
  transaction_count: 4,
};

const baseTransaction = {
  account_name: "HSBC Personal",
  amount: "-48.99",
  date: "2026-06-14",
  description: "MORRISONS MILTON",
  direction: "outflow",
  id: "transaction-1",
  is_transfer_candidate: false,
  merchant_name: "Morrisons",
  normalized_group: "flexible",
  provider: "HSBC Personal",
  reviewed: false,
  source_category: "Groceries",
  status: "posted",
  transaction_type: "spending",
};

const incomeTransaction = {
  ...baseTransaction,
  amount: "3250.00",
  description: "June salary",
  direction: "inflow",
  id: "transaction-2",
  merchant_name: "Salary",
  normalized_group: "income",
  source_category: "Salary",
  transaction_type: "income",
};

const decision = {
  amount: "340.00",
  decision_type: "internal_transfer",
  detail: "2026-06-10 · Kiran Barclays -> Household account",
  id: "decision-1",
  reason: "Opposite signed transactions for the same amount on 2026-06-10.",
  status: "candidate",
  title: "Confirm internal transfer",
};

const upcomingCandidate = {
  actual_amount: null,
  commitment_id: "commitment-1",
  commitment_name: "Klarna",
  commitment_status: "candidate",
  commitment_type: "loan_payment",
  due_date: "2026-06-10",
  estimated_amount: "98.31",
  expected_amount: "98.31",
  id: "bill-instance-1",
  status: "planned",
};

const planningOverview = {
  entity_name: "Household",
  goals: [
    {
      current_amount: "1000.00",
      id: "emergency-buffer",
      monthly_contribution: "166.67",
      name: "Emergency buffer",
      next_action: "Keep three months of confirmed bills available before trusting surplus.",
      progress_percent: 50,
      status: "needs_funding",
      target_amount: "2000.00",
    },
  ],
  import_freshness: {
    days_since_latest_transaction: 0,
    latest_import_date: "2026-06-14",
    latest_transaction_date: "2026-06-14",
    message: "Imports are fresh.",
    status: "fresh",
  },
  monthly_review: {
    decision_count: 1,
    end_date: "2026-06-14",
    headline: "Month is in surplus",
    income_total: "3250.00",
    net_total: "3201.01",
    next_actions: ["Review 1 unreviewed transactions."],
    outflow_total: "48.99",
    reviewed_count: 1,
    start_date: "2026-06-01",
    unreviewed_count: 1,
  },
  saved_filters: [
    {
      description: "Transactions filtered to day-to-day spending in the current month.",
      id: "this-month-flexible",
      label: "This month flexible spend",
      query: "range=this-month&group=flexible&type=spending",
      route: "transactions",
    },
  ],
  sinking_funds: [
    {
      due_date: "2026-12-01",
      frequency: "annual",
      id: "sinking-1",
      monthly_set_aside: "12.50",
      name: "Annual insurance",
      source_commitment_id: "commitment-2",
      status: "confirmed",
      target_amount: "150.00",
    },
  ],
  stale_commitments: [
    {
      expected_amount: "12.50",
      id: "commitment-3",
      name: "Old membership",
      next_due_date: "2026-05-01",
      reason: "Next due date has passed; refresh, mark paid, or reject.",
      status: "candidate",
    },
  ],
  subscriptions: [
    {
      action: "Review in recurring",
      expected_amount: "9.99",
      frequency: "monthly",
      id: "subscription-1",
      name: "Netflix",
      next_due_date: "2026-06-20",
      prompt: "Check whether this still earns its place before the next renewal.",
      status: "confirmed",
    },
  ],
};

test("real local stack loads dashboard data without fetch errors", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Kiran\./ })).toBeVisible();
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Spending Pulse" })).toBeVisible();
});

test("renders the dashboard with the polished visual system", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Kiran\./ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link")).toHaveCount(13);
  await expect(page.getByLabel("Date range", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /API online|API checking/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Kiran Household/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spending Pulse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bills This Month" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Balance Readiness" })).toHaveCount(0);
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  const dashboard = page.getByLabel("Personal Finance Studio dashboard");
  await expect(dashboard.locator(".decision-table-header")).toHaveCount(0);
  await expect(dashboard.locator(".decision-card-compact .compact-row")).toHaveCount(1);

  const visualSystem = await page.evaluate(() => {
    const h1 = getComputedStyle(document.querySelector("h1") as HTMLElement);
    const metric = getComputedStyle(document.querySelector(".metric-value") as HTMLElement);
    const card = getComputedStyle(document.querySelector(".card") as HTMLElement);
    const button = getComputedStyle(document.querySelector("button") as HTMLElement);

    return {
      buttonRadius: button.borderRadius,
      cardRadius: card.borderRadius,
      h1Font: h1.fontFamily,
      h1Weight: h1.fontWeight,
      metricFont: metric.fontFamily,
    };
  });

  expect(visualSystem.h1Font).toContain("Inter");
  expect(visualSystem.h1Weight).toBe("700");
  expect(visualSystem.metricFont).toContain("Inter");
  expect(visualSystem.cardRadius).toBe("8px");
  expect(visualSystem.buttonRadius).toBe("8px");

  await page.getByLabel("Date range", { exact: true }).selectOption("last-30");
  await expect(page.getByRole("heading", { name: "Recent Bills" })).toBeVisible();
});

test("renders phase 1.5 planning routes and saved filter URLs", async ({ page }) => {
  const transactionRequests: string[] = [];
  await mockAppApis(page, {
    onTransactionsRequest(url) {
      transactionRequests.push(url.toString());
    },
  });

  await page.goto("/#/goals");
  await expect(page.getByRole("heading", { name: "Goals" })).toBeVisible();
  await expect(page.getByText("Emergency buffer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import Freshness" })).toHaveCount(0);

  await page.goto("/#/sinking-funds");
  await expect(page.getByRole("heading", { name: "Sinking Funds" })).toBeVisible();
  await expect(page.getByText("Annual insurance")).toBeVisible();

  await page.goto("/#/monthly-review");
  await expect(page.getByRole("heading", { name: "Monthly Review" })).toBeVisible();
  await expect(page.getByText("Month is in surplus")).toBeVisible();

  await page.getByRole("link", { name: /This month flexible spend/ }).click();
  await expect(page).toHaveURL(/#\/transactions\?range=this-month&group=flexible&type=spending/);
  await expect(page.getByLabel("Category group filter")).toHaveValue("flexible");
  await expect(page.getByLabel("Transaction type filter")).toHaveValue("spending");
  expect(transactionRequests.some((url) => url.includes("normalized_group=flexible"))).toBe(true);

  await page.goto("/#/subscriptions");
  await expect(page.getByRole("heading", { name: "Subscriptions" })).toBeVisible();
  await expect(page.getByText("Netflix")).toBeVisible();
});

test("supports phase 1.75 editable planning controls", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/#/goals");

  await page.getByLabel("Goal name").fill("Holiday fund");
  await page.getByLabel("Target").fill("1200");
  await page.getByLabel("Current").fill("300");
  await page.getByLabel("Monthly").fill("150");
  await page.getByRole("button", { name: "Add goal" }).click();
  await expect(page.getByText("Holiday fund")).toBeVisible();
  await expect(page.getByText("25%")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Holiday fund")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Current").fill("600");
  await page.getByRole("button", { name: "Update goal" }).click();
  await expect(page.getByText("50%")).toBeVisible();

  await page.goto("/#/budget");
  await expect(page.getByRole("heading", { name: "Budget" })).toBeVisible();
  const flexiblePlan = page.getByLabel("Planned amount for Flexible");
  await flexiblePlan.fill("100");
  await flexiblePlan.press("Enter");
  await expect(page.getByLabel("Monthly budget").getByText("£51.01")).toBeVisible();

  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
  await page.getByLabel("New category name").fill("School meals");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("School meals")).toBeVisible();

  await page.getByRole("button", { name: "Tags" }).click();
  await page.getByLabel("New tag name").fill("School");
  await page.getByRole("button", { name: "New tag" }).click();
  await expect(page.getByText("School")).toBeVisible();

  await page.getByRole("button", { name: "Rules" }).click();
  await page.getByLabel("Rule condition").fill("morrisons");
  await page.getByRole("button", { name: "Create rule" }).click();
  await expect(page.locator(".rule-row").getByText("If merchant contains morrisons")).toBeVisible();

  await page.getByRole("button", { name: "Merchants" }).click();
  await expect(page.getByLabel("Display name for Morrisons")).toBeVisible();

  await page.getByRole("button", { name: /Kiran Household/ }).click();
  await expect(page.getByRole("button", { name: /Kiran Household/ })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("menuitem", { name: "Import data" }).click();
  await expect(page).toHaveURL(/#\/import/);
  await expect(page.getByRole("heading", { name: "Getting Started" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import Freshness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "System Status" })).toHaveCount(0);
});

test("supports phase 2 household expansion workflows", async ({ page }) => {
  let patchCount = 0;
  await mockAppApis(page, {
    onTransactionPatch() {
      patchCount += 1;
    },
  });

  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Rules" }).click();
  await page.getByLabel("Rule condition").fill("morrisons");
  await page.getByRole("button", { name: "Create rule" }).click();
  await expect(page.getByRole("button", { name: /Rule impact preview/ })).toContainText("1 matches");
  await page.getByRole("button", { name: /Rule impact preview/ }).click();
  await expect(page.getByText(/Morrisons/)).toBeVisible();
  await page.getByRole("button", { name: "Apply selected" }).click();
  await expect(page.getByText("Applied 1 transaction.")).toBeVisible();
  expect(patchCount).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Undo last apply" }).click();
  await expect(page.getByText(/Undid If merchant contains morrisons/)).toBeVisible();

  await page.getByRole("button", { name: "Merchants" }).click();
  await page.getByLabel("Display name for Morrisons").fill("Supermarket");
  await page.getByLabel("Display name for Morrisons").blur();
  await page.goto("/#/reports");
  await page.getByRole("tab", { name: "Spending" }).click();
  await page.getByLabel("Report grouping").selectOption("merchant");
  await expect(page.locator(".sankey-svg").getByText("Supermarket")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Transactions CSV" })).toBeVisible();

  await page.goto("/#/budget");
  await page.getByRole("tab", { name: "Flexible" }).click();
  await expect(page.getByText("Left to spend")).toBeVisible();
  await page.getByRole("tab", { name: "Rollover" }).click();
  await page.getByLabel("Rollover amount for Flexible").fill("25");
  await page.getByLabel("Rollover amount for Flexible").press("Enter");
  await expect(page.getByLabel("Monthly budget")).toContainText("£476.01");

  await page.goto("/#/cash-flow");
  await expect(page.getByRole("button", { name: /What-if scenarios/ })).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Scenario").fill("Trim groceries");
  await page.getByLabel("Income change").fill("100");
  await page.getByLabel("Outflow change").fill("-50");
  await page.getByRole("button", { name: "Add scenario" }).click();
  await expect(page.locator(".scenario-row").getByText("Trim groceries")).toBeVisible();
  await expect(page.getByText(/Active comparison: Trim groceries/)).toBeVisible();
});

test("renders colorful account and report graphics", async ({ page }) => {
  await mockAppApis(page);

  await page.goto("/#/accounts");
  await expect(page.getByRole("heading", { name: "Net Worth Performance" })).toBeVisible();
  await expect(page.locator(".performance-chart")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.locator(".stacked-bar")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cash/ })).toHaveAttribute("aria-expanded", "true");
  const beforeToggle = await accountLayoutMeasurement(page);
  await page.getByRole("button", { name: /Cash/ }).click();
  await expect(page.getByRole("button", { name: /Cash/ })).toHaveAttribute("aria-expanded", "false");
  const afterToggle = await accountLayoutMeasurement(page);
  expect(afterToggle.headerLeft).toBe(beforeToggle.headerLeft);
  expect(afterToggle.cardLeft).toBe(beforeToggle.cardLeft);
  expect(afterToggle.buttonTransform).toBe("none");

  await page.goto("/#/goals");
  await expect(page.getByRole("button", { name: /Goal progress/ })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: /Goal progress/ }).click();
  await expect(page.getByRole("button", { name: /Goal progress/ })).toHaveAttribute("aria-expanded", "false");

  await page.goto("/#/recurring");
  await expect(page.getByRole("button", { name: /Recurring candidates/ })).toBeVisible();

  await page.goto("/#/reports");
  await expect(page.getByRole("heading", { name: "Cash Flow" })).toBeVisible();
  await expect(page.locator(".report-metric")).toHaveCount(4);
  await expect(page.locator(".sankey-svg")).toBeVisible();
  expect(await page.locator(".sankey-node").count()).toBeGreaterThan(3);
  await page.getByRole("button", { name: /Flexible/ }).click();
  await expect(page.locator(".sankey-svg").getByText("Morrisons")).toBeVisible();
  await expect(page.getByText(/Flexible expanded into 1 merchant bucket/)).toBeVisible();
  await page.getByRole("tab", { name: "Spending" }).click();
  await expect(page.getByRole("heading", { name: "Spending", exact: true })).toBeVisible();
  await page.getByLabel("Report grouping").selectOption("merchant");
  await expect(page.locator(".sankey-svg").getByText("Morrisons")).toBeVisible();
  await page.getByRole("tab", { name: "Income" }).click();
  await expect(page.getByLabel("Report grouping")).toHaveValue("merchant");
  await expect(page.locator(".sankey-svg").getByText("Payroll")).toBeVisible();
  await expect(page.locator(".sankey-svg").getByText("Total income")).toBeVisible();
});

test("preserves filters and report selections across refresh", async ({ page }) => {
  await mockAppApis(page);

  await page.goto("/#/reports");
  await page.getByLabel("Date range", { exact: true }).selectOption("last-30");
  await page.getByLabel("Search").fill("payroll");
  await page.getByRole("tab", { name: "Income" }).click();
  await expect(page.getByLabel("Report grouping")).toHaveValue("merchant");
  await expect(page).toHaveURL(/#\/reports\?/);

  await page.reload();

  await expect(page.getByRole("heading", { name: "Income" })).toBeVisible();
  await expect(page.getByLabel("Date range", { exact: true })).toHaveValue("last-30");
  await expect(page.getByLabel("Search")).toHaveValue("payroll");
  await expect(page.getByRole("tab", { name: "Income" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Report grouping")).toHaveValue("merchant");

  await page.goto("/#/transactions?range=last-30&group=flexible&type=spending&reviewed=unreviewed&search=coffee");
  await expect(page.getByLabel("Category group filter")).toHaveValue("flexible");
  await expect(page.getByLabel("Transaction type filter")).toHaveValue("spending");
  await expect(page.getByLabel("Review status filter")).toHaveValue("unreviewed");
  await expect(page.getByLabel("Search")).toHaveValue("coffee");

  await page.reload();

  await expect(page.getByLabel("Date range", { exact: true })).toHaveValue("last-30");
  await expect(page.getByLabel("Category group filter")).toHaveValue("flexible");
  await expect(page.getByLabel("Transaction type filter")).toHaveValue("spending");
  await expect(page.getByLabel("Review status filter")).toHaveValue("unreviewed");
  await expect(page.getByLabel("Search")).toHaveValue("coffee");
});

async function accountLayoutMeasurement(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector(".topbar") as HTMLElement;
    const card = document.querySelector(".account-group-section") as HTMLElement;
    const button = document.querySelector(".account-group-header") as HTMLElement;
    return {
      buttonTransform: getComputedStyle(button).transform,
      cardLeft: Math.round(card.getBoundingClientRect().left),
      headerLeft: Math.round(header.getBoundingClientRect().left),
    };
  });
}

test("all primary routes are reachable without visible UI breakage", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/");

  const routes = [
    "dashboard",
    "accounts",
    "transactions",
    "cash-flow",
    "calendar",
    "budget",
    "recurring",
    "goals",
    "sinking-funds",
    "monthly-review",
    "subscriptions",
    "reports",
    "decision-queue",
    "import",
    "settings",
  ];

  for (const route of routes) {
    await page.goto(`/#/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("Failed to fetch")).toHaveCount(0);

    const uiHealth = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      const links = [...document.querySelectorAll("a[href]")];
      return {
        badLinks: links.filter((link) => !link.getAttribute("href") || link.getAttribute("href") === "#").length,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        unnamedButtons: buttons.filter((button) => {
          return !(button.textContent?.trim() || button.getAttribute("aria-label"));
        }).length,
      };
    });

    expect(uiHealth).toEqual({
      badLinks: 0,
      horizontalOverflow: false,
      unnamedButtons: 0,
    });
  }
});

test("keeps sidebar fixed while page content scrolls", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/#/decision-queue");
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".dashboard-shell")).toBeVisible();

  const before = await page.locator(".sidebar").evaluate((element) => {
    return Math.round(element.getBoundingClientRect().top);
  });
  await page.locator(".dashboard-shell").evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.height = "1600px";
    spacer.setAttribute("data-testid", "scroll-spacer");
    element.appendChild(spacer);
    element.scrollTop = 700;
  });
  const after = await page.locator(".sidebar").evaluate((element) => {
    return Math.round(element.getBoundingClientRect().top);
  });
  const shellScroll = await page.locator(".dashboard-shell").evaluate((element) => element.scrollTop);
  const windowScroll = await page.evaluate(() => window.scrollY);

  expect(after).toBe(before);
  expect(shellScroll).toBeGreaterThan(0);
  expect(windowScroll).toBe(0);
});

test("shows local service health on the settings page", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/#/settings");

  await page.getByRole("button", { name: "System" }).click();
  await expect(page.getByRole("heading", { name: "System Status" })).toBeVisible();
  await expect(page.getByText("Backend API")).toBeVisible();
  await expect(page.getByText("Frontend")).toBeVisible();
  await expect(page.getByText("./scripts/dev-local.sh")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check API again" })).toBeVisible();
});

test("explains when the backend API is offline", async ({ page }) => {
  await page.route("**/health", async (route) => route.abort());
  await mockAppApis(page);
  await page.goto("/");

  await expect(page.getByText("Backend API is offline.")).toBeVisible();
  await expect(page.getByRole("link", { name: "API offline" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
});

test("sends transaction filters to the API and updates the table", async ({ page }) => {
  const transactionRequests: string[] = [];
  await mockAppApis(page, {
    onTransactionsRequest(url) {
      transactionRequests.push(url.toString());
    },
  });
  await page.goto("/#/transactions");

  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  await expect(page.locator(".transaction-row")).toHaveCount(2);

  await page.getByLabel("Category group filter").selectOption("income");

  await expect(page.locator(".transaction-row")).toHaveCount(1);
  await expect(page.locator(".transaction-merchant strong")).toHaveText("Salary");
  expect(transactionRequests.some((url) => url.includes("normalized_group=income"))).toBe(true);
  expect(transactionRequests.some((url) => url.includes("start_date=") && url.includes("end_date="))).toBe(true);

  await page.getByLabel("Transaction type filter").selectOption("spending");

  await expect(page.locator(".transaction-row")).toHaveCount(0);
  await expect(page.getByText("No transactions yet.")).toBeVisible();
  expect(transactionRequests.some((url) => url.includes("transaction_type=spending"))).toBe(true);
});

test("scopes candidate toggle to planning views and updates upcoming bills", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/#/calendar");

  await expect(page.getByLabel("Include bill candidates")).toBeVisible();
  await expect(page.getByText(/Candidate bills included/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bills This Month" })).toBeVisible();
  await expect(page.locator(".calendar-grid")).toBeVisible();
  await expect(page.locator(".calendar-day.has-plans")).toContainText("Klarna");
  await expect(page.locator(".calendar-day.has-plans")).toContainText("£98.31");
  await expect(page.getByRole("button", { name: /Current bills/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Klarna")).toHaveCount(2);

  await page.getByLabel("Include bill candidates").uncheck();

  await expect(page.getByText(/Confirmed bills only/)).toBeVisible();
  await expect(page.getByText("Klarna")).toHaveCount(0);
  await expect(page.locator(".calendar-day.has-plans")).toHaveCount(0);
  await expect(page.getByText("No bills or planned commitments found for this range.")).toBeVisible();

  await page.goto("/#/decision-queue");

  await expect(page.getByRole("heading", { name: "Decision Queue" })).toBeVisible();
  await expect(page.getByLabel("Include bill candidates")).toHaveCount(0);
});

test("renders decision queue as a desktop review table", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/#/decision-queue");

  await expect(page.getByRole("heading", { name: "Decision Queue" })).toBeVisible();
  await expect(page.locator(".decision-summary-pill")).toContainText("Transfer match");
  await expect(page.locator(".decision-table-header span")).toHaveText([
    "Decision",
    "Why it matters",
    "Amount",
    "Actions",
  ]);
  await expect(page.locator(".decision-row")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();

  const desktopLayout = await page.locator(".decision-row").first().evaluate((row) => {
    return {
      columns: getComputedStyle(row).gridTemplateColumns.split(" ").length,
      summaryGap: getComputedStyle(document.querySelector(".decision-summary") as HTMLElement).marginBottom,
    };
  });

  expect(desktopLayout.columns).toBe(4);
  expect(desktopLayout.summaryGap).toBe("8px");
});

test("keeps decision queue actions usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAppApis(page);
  await page.goto("/#/decision-queue");

  await expect(page.getByRole("heading", { name: "Decision Queue" })).toBeVisible();
  await expect(page.locator(".decision-type", { hasText: "Transfer match" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();

  const mobileLayout = await page.locator(".decision-row").first().evaluate((row) => {
    const actions = row.querySelector(".decision-actions") as HTMLElement;
    const firstButton = actions.querySelector("button") as HTMLElement;

    return {
      actionsJustify: getComputedStyle(actions).justifyContent,
      buttonFlex: getComputedStyle(firstButton).flexGrow,
      headerDisplay: getComputedStyle(document.querySelector(".decision-table-header") as HTMLElement).display,
      rowColumns: getComputedStyle(row).gridTemplateColumns.split(" ").length,
    };
  });

  expect(mobileLayout).toEqual({
    actionsJustify: "stretch",
    buttonFlex: "1",
    headerDisplay: "none",
    rowColumns: 1,
  });
});

async function mockAppApis(
  page: Page,
  options: { onTransactionPatch?: () => void; onTransactionsRequest?: (url: URL) => void } = {},
) {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { accounts: [account], entity_name: "Household" },
    });
  });
  await page.route("**/api/calendar/upcoming**", async (route) => {
    const url = new URL(route.request().url());
    const includeCandidates = url.searchParams.get("include_candidates") !== "false";
    const items = includeCandidates ? [upcomingCandidate] : [];

    await route.fulfill({
      contentType: "application/json",
      json: {
        end_date: "2026-06-30",
        expected_total: includeCandidates ? "98.31" : "0.00",
        items,
        start_date: "2026-06-01",
        total_count: items.length,
      },
    });
  });
  await page.route("**/api/commitments", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        commitments: [
          {
            commitment_type: "subscription",
            expected_amount: "9.99",
            frequency: "monthly",
            id: "commitment-1",
            instance_count: 1,
            name: "Netflix",
            next_due_date: "2026-06-20",
            source: "detected",
            status: "candidate",
          },
        ],
        entity_name: "Household",
        total_count: 1,
      },
    });
  });
  await page.route("**/api/dashboard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        account_count: 1,
        available_after_commitments: "660.00",
        cash_balance_account_count: 1,
        cash_on_hand: "1000.00",
        commitment_count: 0,
        confidence: "ready",
        decision_count: 1,
        entity_name: "Household",
        flexible_spend_actual: "48.99",
        flexible_spend_allowance: "500.00",
        flexible_spend_remaining: "451.01",
        lowest_projected_balance: "660.00",
        message: "Local API data loaded.",
        missing_balance_account_count: 0,
        transaction_count: 2,
        upcoming_candidate_total: "340.00",
        upcoming_confirmed_total: "0.00",
      },
    });
  });
  await page.route("**/api/decisions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        decisions: [decision],
        entity_name: "Household",
        total_count: 1,
      },
    });
  });
  await page.route("**/api/forecast**", async (route) => {
    const url = new URL(route.request().url());
    const includeCandidates = url.searchParams.get("include_candidates") !== "false";

    await route.fulfill({
      contentType: "application/json",
      json: {
        candidate_commitments_total: includeCandidates ? "98.31" : "0.00",
        confidence: "ready",
        confirmed_commitments_total: "0.00",
        end_date: "2026-06-30",
        lowest_projected_balance: "660.00",
        points: includeCandidates
          ? [
              {
                amount: "98.31",
                confidence: "candidate",
                date: "2026-06-10",
                kind: "loan_payment",
                label: "Klarna",
                projected_balance: "901.69",
              },
            ]
          : [],
        projected_ending_balance: "660.00",
        start_date: "2026-06-01",
        starting_balance: "1000.00",
      },
    });
  });
  await page.route("**/api/insights**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        category_groups: [
          {
            group: "income",
            inflow_total: "3250.00",
            net_total: "3250.00",
            outflow_total: "0.00",
            transaction_count: 1,
          },
          {
            group: "flexible",
            inflow_total: "0.00",
            net_total: "-48.99",
            outflow_total: "48.99",
            transaction_count: 1,
          },
        ],
        end_date: "2026-06-30",
        income_sources: [
          {
            inflow_total: "3250.00",
            source_name: "Payroll",
            transaction_count: 1,
          },
        ],
        internal_transfers_excluded: true,
        merchant_breakdowns: [
          {
            group: "flexible",
            merchant_name: "Morrisons",
            outflow_total: "48.99",
            transaction_count: 1,
          },
        ],
        start_date: "2026-06-01",
        top_merchants: [{ merchant_name: "Morrisons", outflow_total: "48.99", transaction_count: 1 }],
      },
    });
  });
  await page.route("**/api/planning/overview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: planningOverview,
    });
  });
  await page.route("**/api/transactions**", async (route) => {
    if (route.request().method() === "PATCH") {
      options.onTransactionPatch?.();
      await route.fulfill({
        contentType: "application/json",
        json: { ...baseTransaction, reviewed: true, source_category: "Flexible" },
      });
      return;
    }

    const url = new URL(route.request().url());
    const normalizedGroup = url.searchParams.get("normalized_group");
    const transactionType = url.searchParams.get("transaction_type");
    options.onTransactionsRequest?.(url);

    const transactions = [baseTransaction, incomeTransaction].filter((transaction) => {
      if (normalizedGroup && transaction.normalized_group !== normalizedGroup) return false;
      if (transactionType && transaction.transaction_type !== transactionType) return false;
      return true;
    });

    await route.fulfill({
      contentType: "application/json",
      json: {
        returned_count: transactions.length,
        total_count: transactions.length,
        transactions,
      },
    });
  });
}
