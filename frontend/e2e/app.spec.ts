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

test("real local stack loads dashboard data without fetch errors", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Good afternoon, Kiran." })).toBeVisible();
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Available Money" })).toBeVisible();
});

test("renders the dashboard with the polished visual system", async ({ page }) => {
  await mockAppApis(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Good afternoon, Kiran." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link")).toHaveCount(8);
  await expect(page.getByLabel("Date range", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Available Money" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Queue" })).toBeVisible();
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);

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
  options: { onTransactionsRequest?: (url: URL) => void } = {},
) {
  await page.route("**/api/accounts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { accounts: [account], entity_name: "Household" },
    });
  });
  await page.route("**/api/calendar/upcoming**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        end_date: "2026-06-30",
        expected_total: "340.00",
        items: [],
        start_date: "2026-06-01",
        total_count: 0,
      },
    });
  });
  await page.route("**/api/commitments", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { commitments: [], entity_name: "Household", total_count: 0 },
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
    await route.fulfill({
      contentType: "application/json",
      json: {
        candidate_commitments_total: "340.00",
        confidence: "ready",
        confirmed_commitments_total: "0.00",
        end_date: "2026-06-30",
        lowest_projected_balance: "660.00",
        points: [],
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
            group: "flexible",
            inflow_total: "0.00",
            net_total: "-48.99",
            outflow_total: "-48.99",
            transaction_count: 1,
          },
        ],
        end_date: "2026-06-30",
        internal_transfers_excluded: true,
        start_date: "2026-06-01",
        top_merchants: [{ merchant_name: "Morrisons", outflow_total: "-48.99", transaction_count: 1 }],
      },
    });
  });
  await page.route("**/api/transactions**", async (route) => {
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
