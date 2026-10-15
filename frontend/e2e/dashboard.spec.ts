import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addDays, kpi, mondayOf, SANDBOX_WEEK } from "./helpers";

// Expects freshly seeded data (`npm run db:seed` in backend/): the current week matches the reference video.
const card = "section[aria-labelledby='revenue-trend-title']";
const thisWeek = mondayOf(new Date());

test.describe("Revenue trend dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(card)).toBeVisible();
  });

  test("shows the current week from the API", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "This Week's Revenue Trend", exact: true })).toBeVisible();
    await expect(kpi(page, "Total Revenue")).toContainText("$15,974");
    await expect(kpi(page, "Average per Day")).toContainText("$2,282");
    await expect(kpi(page, "Total Covers")).toContainText("871");
    await expect(kpi(page, "Total Revenue")).not.toContainText("vs");

    // Y axis like the design
    for (const tick of ["0k", "0.75k", "1.5k", "2.25k", "3k"]) {
      await expect(page.locator(".recharts-yAxis-tick-labels").getByText(tick, { exact: true })).toBeVisible();
    }
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      await expect(page.locator(".recharts-xAxis-tick-labels").getByText(day, { exact: true })).toBeVisible();
    }

    // 3 series: POS + Eatclub stacked, Labour separate; 7 bars each
    await expect(page.locator(".recharts-bar")).toHaveCount(3);
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(21);
  });

  test("compare mode adds the previous week and percentages", async ({ page }) => {
    const compare = page.getByRole("button", { name: "Compare to Previous" });
    await expect(compare).toHaveAttribute("aria-pressed", "false");
    await compare.click();
    await expect(compare).toHaveAttribute("aria-pressed", "true");

    await expect(
      page.getByRole("heading", { name: "This Week's Revenue Trend vs Previous Period", exact: true }),
    ).toBeVisible();
    await expect(kpi(page, "Total Revenue")).toContainText("$15,974vs $14,982 (+6.6%)");
    await expect(kpi(page, "Average per Day")).toContainText("$2,282vs $2,140 (+6.6%)");
    await expect(kpi(page, "Total Covers")).toContainText("871vs 820 (+6.2%)");

    await expect(page.locator(".recharts-bar")).toHaveCount(6);
    const legend = page.locator(card).locator("ul").last();
    for (const label of [
      "POS Revenue (Current)",
      "Eatclub Revenue (Current)",
      "Labour Costs (Current)",
      "Direct Revenue (Previous)",
      "Total Revenue (Previous)",
      "Labour Costs (Previous)",
      "Positive Event Impact",
      "Negative Event Impact",
    ]) {
      await expect(legend.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("toggling never changes the numbers and never refetches", async ({ page }) => {
    // The reference video shows random numbers on every toggle; this app must show the admin's exact data.
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/")) apiCalls.push(req.url());
    });

    const compare = page.getByRole("button", { name: "Compare to Previous" });
    for (let i = 0; i < 6; i++) {
      await compare.click();
      await expect(kpi(page, "Total Revenue")).toContainText("$15,974");
      await expect(kpi(page, "Total Covers")).toContainText("871");
    }
    expect(apiCalls).toEqual([]);
  });

  test("series checkboxes hide and show their bars", async ({ page }) => {
    await page.getByRole("button", { name: "Compare to Previous" }).click();
    await expect(page.locator(".recharts-bar")).toHaveCount(6);

    const pos = page.getByRole("checkbox", { name: "POS Revenue" });
    await pos.uncheck({ force: true });
    await expect(pos).not.toBeChecked();
    // POS current + previous disappear
    await expect(page.locator(".recharts-bar")).toHaveCount(4);

    await page.getByRole("checkbox", { name: "Labour Costs" }).uncheck({ force: true });
    await expect(page.locator(".recharts-bar")).toHaveCount(2);

    // KPIs are totals of the week, they do not depend on the visible series
    await expect(kpi(page, "Total Revenue")).toContainText("$15,974");

    await pos.check({ force: true });
    await expect(page.locator(".recharts-bar")).toHaveCount(4);
  });

  test("events appear as markers with details in the tooltip", async ({ page }) => {
    await expect(page.getByRole("img", { name: /negative event: Heavy rain/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /positive event: Street food festival/ })).toBeVisible();

    const sat = page.locator(".recharts-xAxis-tick-labels").getByText("Sat", { exact: true });
    const box = (await sat.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y - 120);

    const tooltip = page.locator(".recharts-tooltip-wrapper");
    await expect(tooltip).toContainText("Street food festival");
    await expect(tooltip).toContainText("POS Revenue");
    await expect(tooltip).toContainText("$2,185");
    await expect(tooltip).toContainText("$720");
  });

  test("Export PNG downloads an image of the card", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`revenue-trend-${thisWeek}.png`);
    const file = await readFile((await download.path())!);
    expect(file.subarray(1, 4).toString()).toBe("PNG");
    expect(file.length).toBeGreaterThan(20_000);
  });

  test("navigates between weeks", async ({ page }) => {
    await page.getByRole("link", { name: "Previous week" }).click();
    await expect(page).toHaveURL(new RegExp(`week=${addDays(thisWeek, -7)}`));
    await expect(page.getByRole("heading", { name: "Revenue Trend", exact: true })).toBeVisible();
    await expect(kpi(page, "Total Revenue")).toContainText("$14,982");
    await expect(kpi(page, "Total Covers")).toContainText("820");

    await page.getByRole("link", { name: "Latest" }).click();
    await expect(kpi(page, "Total Revenue")).toContainText("$15,974");
  });

  test("a week without data shows an empty state", async ({ page }) => {
    await page.goto(`/?week=${SANDBOX_WEEK}`);
    await expect(page.getByText("No data has been entered for this week yet.")).toBeVisible();
    await expect(kpi(page, "Total Revenue")).toContainText("$0");

    await page.getByRole("button", { name: "Compare to Previous" }).click();
    await expect(kpi(page, "Total Revenue")).toContainText("no previous data");
  });

  test("an invalid week in the URL falls back to the default week", async ({ page }) => {
    for (const bad of ["2026-13-45", "2026-02-30", "1999-12-27", "not-a-date"]) {
      const res = await page.goto(`/?week=${bad}`);
      expect(res?.status()).toBe(200);
      await expect(kpi(page, "Total Revenue")).toContainText("$15,974");
    }
  });

  test("any day of the week in the URL opens that week", async ({ page }) => {
    await page.goto(`/?week=${addDays(thisWeek, 3)}`);
    await expect(kpi(page, "Total Revenue")).toContainText("$15,974");
  });

  test("fits a phone screen without horizontal page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(kpi(page, "Total Revenue")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
