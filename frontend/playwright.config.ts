import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "cd .. && uv run uvicorn app.main:app --host 127.0.0.1 --port 8025",
      url: "http://127.0.0.1:8025/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
