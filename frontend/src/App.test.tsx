import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import * as api from "./api";

vi.mock("./api");

const mockedApi = vi.mocked(api);

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders the import-first finance studio shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Good afternoon, Kiran." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
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
          name: "GONELA V S K",
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

    const file = new File(["date,amount"], "snoop.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose Snoop CSV"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(screen.getByText("5 rows found")).toBeInTheDocument());
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.getByText("£3,590.00")).toBeInTheDocument();
    expect(screen.getByText("-£388.99")).toBeInTheDocument();
  });
});
