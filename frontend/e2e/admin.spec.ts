import { expect, test, type Page } from "@playwright/test";
import { ADMIN_EMAIL, kpi, login, mondayOf, resetSandboxWeek, SANDBOX_PREVIOUS_WEEK, SANDBOX_WEEK, saveWeek } from "./helpers";

const row = (page: Page, day: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: day }) });
const cell = (page: Page, field: string, day: string) => page.getByLabel(`${field} on ${day}`);

test.describe("Admin access", () => {
  test("redirects to the login page when signed out", async ({ page }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await expect(page).toHaveURL(/\/admin\/login\?next=/);
    await expect(page.getByRole("heading", { name: "Revenue Admin" })).toBeVisible();
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Email or password is incorrect");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("the API refuses admin calls without a session", async ({ request }) => {
    const res = await request.get(`/api/admin/metrics?weekStart=${SANDBOX_WEEK}`);
    expect(res.status()).toBe(401);
    const write = await request.put("/api/admin/metrics", { data: { weekStart: SANDBOX_WEEK, days: [] } });
    expect(write.status()).toBe(401);
  });

  test("a forged session cookie is not enough", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "rd_session", value: "forged.token.value", url: baseURL! }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a signed-in admin skips the login form", async ({ page }) => {
    await login(page);
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("signing out revokes the session on the server, not just in this browser", async ({ page, context, baseURL }) => {
    await login(page);
    const session = (await context.cookies()).find((c) => c.name === "rd_session")!;
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);

    // Re-use the old cookie, as if it had been copied before signing out
    await context.addCookies([{ name: "rd_session", value: session.value, url: baseURL! }]);
    const res = await page.request.get("/api/auth/me");
    expect(res.status()).toBe(401);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("an invalid week in the URL falls back to the current week", async ({ page }) => {
    await login(page);
    const res = await page.goto("/admin?week=2026-13-45");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Weekly data" })).toBeVisible();
  });

  test("returns to the requested page after signing in, then signs out", async ({ page }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD ?? "admin12345");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin\\?week=${SANDBOX_WEEK}`));
    await expect(page.getByText("7 Jan - 13 Jan 2030")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("Admin data entry", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ request }) => resetSandboxWeek(request));
  test.afterAll(async ({ request }) => resetSandboxWeek(request));

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("loads the seeded figures of the current week", async ({ page }) => {
    const monday = mondayOf(new Date());
    await page.goto(`/admin?week=${monday}`);
    await expect(page.getByRole("textbox", { name: /^POS revenue on Mon/ })).toHaveValue("1720");
    await expect(page.getByRole("textbox", { name: /^Covers on Sun/ })).toHaveValue("138");
    await expect(page.getByRole("row", { name: /Week total/ })).toContainText("$15,974.00");
  });

  test("validates input before saving", async ({ page }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    const save = page.getByRole("button", { name: "Save week" });
    await expect(save).toBeDisabled();

    // Partially filled day
    await cell(page, "POS revenue", "Mon 7 Jan").fill("1000");
    await save.click();
    await expect(page.locator("form").getByRole("alert")).toContainText("A day must be fully filled in or left empty");
    await expect(row(page, "Mon 7 Jan")).toContainText("Required");

    // Bad numbers
    await cell(page, "Eatclub revenue", "Mon 7 Jan").fill("-5");
    await cell(page, "Labour cost", "Mon 7 Jan").fill("12.345");
    await cell(page, "Covers", "Mon 7 Jan").fill("4.5");
    await save.click();
    await expect(row(page, "Mon 7 Jan")).toContainText("Enter a number of 0 or more");
    await expect(row(page, "Mon 7 Jan")).toContainText("Max 2 decimals");
    await expect(row(page, "Mon 7 Jan")).toContainText("Whole number only");

    // Discard brings back the saved (empty) state
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(cell(page, "POS revenue", "Mon 7 Jan")).toHaveValue("");
    await expect(save).toBeDisabled();
  });

  test("saved figures show up exactly on the dashboard", async ({ page }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);

    const entries: Record<string, [string, string, string, string]> = {
      "Mon 7 Jan": ["1,200.50", "300.25", "450", "80"],
      "Tue 8 Jan": ["999.99", "0.01", "300", "64"],
      "Sat 12 Jan": ["2500", "750", "900", "150"],
    };
    for (const [day, [pos, eatclub, labour, covers]] of Object.entries(entries)) {
      await cell(page, "POS revenue", day).fill(pos);
      await cell(page, "Eatclub revenue", day).fill(eatclub);
      await cell(page, "Labour cost", day).fill(labour);
      await cell(page, "Covers", day).fill(covers);
    }

    // Live preview: 1500.75 + 1000.00 + 3250.00 = 5750.75 ; avg over the 3 days entered 1916.92 ; 294 covers
    const total = page.getByRole("row", { name: /Week total/ });
    await expect(total).toContainText("$5,750.75");
    await expect(total).toContainText("Avg per day $1,916.92");
    await expect(total).toContainText("294 covers");

    await page.getByRole("button", { name: "Save week" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved. The dashboard now shows these numbers.");
    await expect(page.getByRole("button", { name: "Save week" })).toBeDisabled();
    // Stored values come back normalised (no thousands separator)
    await expect(cell(page, "POS revenue", "Mon 7 Jan")).toHaveValue("1200.5");

    await page.getByRole("link", { name: "View this week on the dashboard" }).click();
    await expect(page).toHaveURL(new RegExp(`/\\?week=${SANDBOX_WEEK}`));
    await expect(kpi(page, "Total Revenue")).toContainText("$5,751");
    await expect(kpi(page, "Average per Day")).toContainText("$1,917");
    await expect(kpi(page, "Total Covers")).toContainText("294");
    await expect(page.getByText("No data has been entered")).toHaveCount(0);
    await expect(page.getByText("3 of 7 days entered so far.")).toBeVisible();
    // Only the 3 entered days get bars: 2 stacked series + labour, 3 days each
    await expect(page.locator(".recharts-bar-rectangle path")).toHaveCount(9);

    // Tooltip shows the exact cents
    const mon = page.locator(".recharts-xAxis-tick-labels").getByText("Mon", { exact: true });
    const box = (await mon.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y - 60);
    await expect(page.locator(".recharts-tooltip-wrapper")).toContainText("$1,200.50");
    await expect(page.locator(".recharts-tooltip-wrapper")).toContainText("$300.25");
  });

  test("clearing a day removes it from the dashboard", async ({ page }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await page.getByRole("button", { name: "Clear Sat 12 Jan" }).click();
    await page.getByRole("button", { name: "Save week" }).click();
    await expect(page.getByRole("status")).toBeVisible();

    await page.goto(`/?week=${SANDBOX_WEEK}`);
    await expect(kpi(page, "Total Revenue")).toContainText("$2,501");
    await expect(kpi(page, "Average per Day")).toContainText("$1,250");
    await expect(kpi(page, "Total Covers")).toContainText("144");
  });

  test("warns before leaving the page with unsaved changes", async ({ page }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await cell(page, "Covers", "Wed 9 Jan").fill("12");

    // Dismiss: stay on the page, edits kept
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("unsaved changes");
      void dialog.dismiss();
    });
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page).toHaveURL(new RegExp(`week=${SANDBOX_WEEK}`));
    await expect(cell(page, "Covers", "Wed 9 Jan")).toHaveValue("12");

    // Accept: navigate away, edits dropped
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page).toHaveURL(/week=2030-01-14/);
  });

  test("does not overwrite numbers another admin saved meanwhile", async ({ page, request }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await cell(page, "POS revenue", "Mon 7 Jan").fill("1300");

    // Another admin saves the same week while this form is open
    await saveWeek(request, SANDBOX_WEEK, [["2030-01-07", 4444, 1, 1, 1]]);

    await page.getByRole("button", { name: "Save week" }).click();
    const form = page.locator("form").first();
    await expect(form.getByRole("alert")).toContainText("changed by someone else");

    await form.getByRole("button", { name: "Load latest numbers" }).click();
    await expect(cell(page, "POS revenue", "Mon 7 Jan")).toHaveValue("4444");
    await expect(cell(page, "POS revenue", "Tue 8 Jan")).toHaveValue("");

    await cell(page, "Covers", "Mon 7 Jan").fill("2");
    await page.getByRole("button", { name: "Save week" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved. The dashboard now shows these numbers.");
  });

  test("a week in progress is compared with the same days of the previous week", async ({ page, request }) => {
    await saveWeek(request, SANDBOX_PREVIOUS_WEEK, [
      ["2029-12-31", 1000, 0, 100, 10],
      ["2030-01-01", 1000, 0, 100, 10],
      ["2030-01-02", 5000, 0, 100, 10],
    ]);
    await saveWeek(request, SANDBOX_WEEK, [
      ["2030-01-07", 1100, 0, 100, 11],
      ["2030-01-08", 1100, 0, 100, 11],
    ]);

    await page.goto(`/?week=${SANDBOX_WEEK}`);
    await page.getByRole("button", { name: "Compare to Previous" }).click();
    // Mon+Tue this week (2,200) vs Mon+Tue last week (2,000), not the whole previous week (7,000)
    await expect(kpi(page, "Total Revenue")).toContainText("$2,200vs $2,000 (+10.0%)");
    await expect(kpi(page, "Average per Day")).toContainText("$1,100vs $1,000 (+10.0%)");
    await expect(kpi(page, "Total Covers")).toContainText("22vs 20 (+10.0%)");
    await expect(page.getByText("2 of 7 days entered so far. Compared with the same days of the previous week.")).toBeVisible();
  });

  test("events can be added, edited and deleted", async ({ page }) => {
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await expect(page.getByText("No events this week.")).toBeVisible();

    // Title is required
    await page.getByRole("button", { name: "Add event" }).click();
    await page.getByRole("button", { name: "Add event" }).click();
    await expect(page.getByText("Title is required")).toBeVisible();

    await page.getByLabel("Day").selectOption({ label: "Tue 8 Jan" });
    await page.getByText("Negative", { exact: true }).click();
    await page.getByLabel("Title").fill("Kitchen closed early");
    await page.getByLabel(/Description/).fill("Power cut after 8pm");
    await page.getByRole("button", { name: "Add event" }).click();

    const item = page.getByRole("listitem").filter({ hasText: "Kitchen closed early" });
    await expect(item).toContainText("Tue 8 Jan");
    await expect(item).toContainText("Power cut after 8pm");

    // Visible on the dashboard as a negative marker
    await page.goto(`/?week=${SANDBOX_WEEK}`);
    await expect(page.getByRole("img", { name: "negative event: Kitchen closed early" })).toBeVisible();

    // Edit: becomes positive with a new title
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await page.getByRole("button", { name: "Edit Kitchen closed early" }).click();
    await page.getByText("Positive", { exact: true }).click();
    await page.getByLabel("Title").fill("Private party");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Private party" })).toBeVisible();

    await page.goto(`/?week=${SANDBOX_WEEK}`);
    await expect(page.getByRole("img", { name: "positive event: Private party" })).toBeVisible();
    await expect(page.getByRole("img", { name: /negative event/ })).toHaveCount(0);

    // Delete asks for confirmation first
    await page.goto(`/admin?week=${SANDBOX_WEEK}`);
    await page.getByRole("button", { name: "Delete Private party" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Private party" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Private party" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("No events this week.")).toBeVisible();
  });
});
