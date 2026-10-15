import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin12345";

/** Mondays far in the future that the seed never touches, so tests can write to them freely. */
export const SANDBOX_WEEK = "2030-01-07";
export const SANDBOX_PREVIOUS_WEEK = "2029-12-31";

export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Weekly data" })).toBeVisible();
}

export async function apiLogin(request: APIRequestContext) {
  const res = await request.post("/api/auth/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

/** Saves a week through the API, like another admin would. */
export async function saveWeek(
  request: APIRequestContext,
  weekStart: string,
  days: Array<[date: string, pos: number, eatclub: number, labour: number, covers: number]>,
) {
  await apiLogin(request);
  const res = await request.put("/api/admin/metrics", {
    data: {
      weekStart,
      days: days.map(([date, posRevenue, eatclubRevenue, labourCost, covers]) => ({
        date,
        posRevenue,
        eatclubRevenue,
        labourCost,
        covers,
      })),
    },
  });
  expect(res.ok()).toBeTruthy();
}

/** Empties the sandbox weeks through the API (metrics and events). */
export async function resetSandboxWeek(request: APIRequestContext) {
  await apiLogin(request);
  for (const weekStart of [SANDBOX_PREVIOUS_WEEK, SANDBOX_WEEK]) {
    const put = await request.put("/api/admin/metrics", { data: { weekStart, days: [] } });
    expect(put.ok()).toBeTruthy();

    const { events } = await (await request.get(`/api/admin/events?weekStart=${weekStart}`)).json();
    for (const event of events as { id: number }[]) {
      await request.delete(`/api/admin/events/${event.id}`);
    }
  }
}

export const kpi = (page: Page, label: string) => page.getByRole("group", { name: label });
