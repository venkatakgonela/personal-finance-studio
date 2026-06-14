import { expect, test } from "@playwright/test";

test("renders the dashboard with the polished visual system", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Good afternoon, Kiran." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Available Money" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Decision Queue" })).toBeVisible();

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

test("keeps compact row actions aligned on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const actionLayout = await page.locator(".compact-row .row-actions").first().evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      gridColumn: style.gridColumn,
      justifyContent: style.justifyContent,
    };
  });

  expect(actionLayout).toEqual({
    gridColumn: "1 / -1",
    justifyContent: "flex-end",
  });
});
