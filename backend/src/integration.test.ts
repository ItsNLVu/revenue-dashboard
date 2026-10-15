import { createServer } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

/**
 * Runs against the real database from backend/.env (after `npm run db:migrate` and `npm run db:seed`).
 * Skipped when DATABASE_URL is not set.
 * Writes only to a sandbox week in 2030 and empties it again afterwards.
 */
const SANDBOX_WEEK = "2030-01-14";
// One listening HTTP server for all requests (supertest would otherwise start one per request).
const app = createServer(createApp()).listen(0);

async function signIn() {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({
    email: process.env.ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.ADMIN_PASSWORD ?? "admin12345",
  });
  expect(res.status).toBe(200);
  const token = String(res.headers["set-cookie"]).match(/rd_session=([^;]+)/)?.[1];
  return { agent, token: token! };
}

const day = (date: string, pos: number) => ({ date, posRevenue: pos, eatclubRevenue: 10, labourCost: 5, covers: 3 });

describe.skipIf(!process.env.DATABASE_URL)("API with the database", () => {
  let agent: Awaited<ReturnType<typeof signIn>>["agent"];

  beforeAll(async () => {
    ({ agent } = await signIn());
    await agent.put("/api/admin/metrics").send({ weekStart: SANDBOX_WEEK, days: [] });
  });

  afterAll(async () => {
    // Sign in again: the sign-out test ends every session of the admin.
    ({ agent } = await signIn());
    await agent.put("/api/admin/metrics").send({ weekStart: SANDBOX_WEEK, days: [] });
    await prisma.$disconnect();
    app.close();
  });

  it("saves a week and serves exactly those numbers on the dashboard", async () => {
    const save = await agent
      .put("/api/admin/metrics")
      .send({ weekStart: SANDBOX_WEEK, days: [day("2030-01-14", 1000.5), day("2030-01-15", 99.99)] });
    expect(save.status).toBe(200);

    const dashboard = await request(app).get(`/api/dashboard/weekly?weekStart=${SANDBOX_WEEK}`);
    expect(dashboard.body.current.totals).toMatchObject({ revenue: 1120.49, covers: 6, daysWithData: 2 });
    expect(dashboard.body.current.days[0]).toMatchObject({ posRevenue: 1000.5, hasData: true });
    expect(dashboard.body.current.days[2]).toMatchObject({ hasData: false });
  });

  it("handles concurrent saves of the same week without errors", async () => {
    // Overlapping saves with different sets of days, so deletes and inserts interleave
    const variants = [
      ["2030-01-20", "2030-01-14", "2030-01-16"],
      ["2030-01-15", "2030-01-17", "2030-01-19"],
      ["2030-01-14", "2030-01-15", "2030-01-16", "2030-01-17", "2030-01-18"],
    ];
    const results = await Promise.all(
      Array.from({ length: 24 }, (_, i) =>
        agent.put("/api/admin/metrics").send({
          weekStart: SANDBOX_WEEK,
          days: variants[i % variants.length].map((date, j) => day(date, 100 * i + j)),
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(24).fill(200));

    // The stored week is exactly one of the saves, never a mix of two
    const week = await agent.get(`/api/admin/metrics?weekStart=${SANDBOX_WEEK}`);
    const stored = week.body.days.filter((d: { hasData: boolean }) => d.hasData).map((d: { date: string }) => d.date);
    expect(variants.map((v) => [...v].sort().join())).toContain(stored.join());
  });

  it("refuses to overwrite changes made since the form was loaded (409)", async () => {
    const loaded = await agent.get(`/api/admin/metrics?weekStart=${SANDBOX_WEEK}`);
    const { version } = loaded.body;

    // Someone else saves in between
    await agent.put("/api/admin/metrics").send({ weekStart: SANDBOX_WEEK, days: [day("2030-01-14", 555)] });

    const stale = await agent
      .put("/api/admin/metrics")
      .send({ weekStart: SANDBOX_WEEK, baseVersion: version, days: [day("2030-01-14", 777)] });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("WEEK_CHANGED");

    const fresh = await agent.get(`/api/admin/metrics?weekStart=${SANDBOX_WEEK}`);
    expect(fresh.body.days[0].posRevenue).toBe(555);

    const retry = await agent
      .put("/api/admin/metrics")
      .send({ weekStart: SANDBOX_WEEK, baseVersion: fresh.body.version, days: [day("2030-01-14", 777)] });
    expect(retry.status).toBe(200);
  });

  it("defaults admin reads to the current week", async () => {
    const res = await agent.get("/api/admin/metrics");
    expect(res.status).toBe(200);
    expect(res.body.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${res.body.weekStart}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it("rejects ids and dates outside the supported range with 400", async () => {
    expect((await agent.delete("/api/admin/events/99999999999")).status).toBe(400);
    expect((await request(app).get("/api/dashboard/weekly?weekStart=0000-01-03")).status).toBe(400);
    expect((await agent.post("/api/admin/events").send({ date: "1899-12-31", impact: "positive", title: "x" })).status).toBe(
      400,
    );
  });

  // Keep last: signing out ends every session of this admin.
  it("revokes the token on sign-out, including copies of it", async () => {
    const { agent: other, token } = await signIn();
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(200);

    await other.post("/api/auth/logout");

    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });
});
