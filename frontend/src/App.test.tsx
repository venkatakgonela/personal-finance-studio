import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import * as api from "./api";

vi.mock("./api");

const mockedApi = vi.mocked(api);

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage?.clear();
    window.location.hash = "#/import";
    mockedApi.getHealth.mockResolvedValue({
      app: "Personal Finance Studio",
      env: "local",
      status: "ok",
    });
    mockedApi.getPlanningOverview.mockResolvedValue({
      entity_name: "Household",
      goals: [],
      import_freshness: {
        days_since_latest_transaction: null,
        latest_import_date: null,
        latest_transaction_date: null,
        message: "No imported transactions yet.",
        status: "no_data",
      },
      monthly_review: {
        decision_count: 0,
        end_date: "2026-06-14",
        headline: "Review pending",
        income_total: "0.00",
        net_total: "0.00",
        next_actions: [],
        outflow_total: "0.00",
        reviewed_count: 0,
        start_date: "2026-06-01",
        unreviewed_count: 0,
      },
      saved_filters: [],
      sinking_funds: [],
      stale_commitments: [],
      subscriptions: [],
    });
  });

  it("renders the import-first finance studio shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Bring fresh data into the plan." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /API/ })).toBeInTheDocument();
    expect(screen.getByText("Choose file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Detect" })[0]).toBeDisabled();
  });

  it("previews a selected Snoop CSV and shows detected accounts", async () => {
    mockedApi.previewSnoopImport.mockResolvedValue({
      source_filename: "snoop.csv",
      row_count: 5,
      valid_row_count: 5,
      invalid_row_count: 0,
      duplicate_fingerprint_count: 0,
      date_start: "2026-06-09",
      date_end: "2026-06-14",
      pending_count: 1,
      inflow_total: "3590.00",
      outflow_total: "-388.99",
      net_total: "3201.01",
      accounts: [
        {
          provider: "HSBC Personal",
          name: "Household Current",
          transaction_count: 4,
          inflow_total: "3250.00",
          outflow_total: "-388.99",
          net_total: "2861.01",
          suggested_type: "unknown",
        },
      ],
      categories: [],
      warnings: [],
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    const file = new File(["date,amount"], "snoop.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose Snoop CSV"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByText("5 rows found")).toBeInTheDocument());
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();
    expect(mockedApi.previewSnoopImport).toHaveBeenCalledWith(file);
  });

  it("renders the Budget Control Tower workflow without crowding every control into the first view", async () => {
    window.location.hash = "#/budget";
    mockedApi.getDashboardSummary.mockResolvedValue({
      account_count: 1,
      available_after_commitments: "590.12",
      cash_balance_account_count: 1,
      cash_on_hand: "590.12",
      commitment_count: 0,
      confidence: "ready",
      decision_count: 0,
      entity_name: "Household",
      flexible_spend_actual: "4837.11",
      flexible_spend_allowance: null,
      flexible_spend_remaining: null,
      lowest_projected_balance: "590.12",
      message: "Ready",
      missing_balance_account_count: 0,
      transaction_count: 25,
      upcoming_candidate_total: "0.00",
      upcoming_confirmed_total: "0.00",
    });
    mockedApi.getInsights.mockResolvedValue({
      category_groups: [
        {
          group: "flexible",
          inflow_total: "0.00",
          net_total: "-4837.11",
          outflow_total: "-4837.11",
          transaction_count: 13,
        },
        {
          group: "income",
          inflow_total: "7160.00",
          net_total: "7160.00",
          outflow_total: "0.00",
          transaction_count: 9,
        },
      ],
      end_date: "2026-06-15",
      income_sources: [],
      internal_transfers_excluded: true,
      merchant_breakdowns: [],
      start_date: "2026-06-01",
      top_merchants: [],
    });
    mockedApi.getUpcomingCommitments.mockResolvedValue({
      end_date: "2026-06-30",
      expected_total: "0.00",
      items: [],
      start_date: "2026-06-01",
      total_count: 0,
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText("Budget control tower")).toBeInTheDocument());
    expect(screen.getByText("Decide what is safe, then tune the plan.")).toBeInTheDocument();
    expect(screen.getByText("1. What do I have?")).toBeInTheDocument();
    expect(screen.queryByText("Envelope budgets")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Monthly plan/ }));
    expect(screen.getByText("Monthly plan method")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Envelope" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit envelopes" }));
    expect(screen.getByText("Envelope budgets")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Monthly budget envelopes" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Assumptions/ }));
    expect(screen.getByText("Safe-spend assumptions")).toBeInTheDocument();
    expect(screen.getByLabelText("Job or income change expected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Review/ }));
    expect(screen.getByText("Next best actions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review actuals" })).toHaveAttribute("href", "#/transactions");
  });
});
