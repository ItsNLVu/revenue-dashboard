import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

// These requests are rejected before any database access, so no database is needed.
const app = createApp();

describe("API guards", () => {
  it("rejects admin routes without a session", async () => {
    const res = await request(app).get("/api/admin/metrics?weekStart=2026-10-12");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a forged token", async () => {
    const res = await request(app)
      .delete("/api/admin/events/1")
      .set("Cookie", "rd_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged");
    expect(res.status).toBe(401);
  });

  it("validates that weekStart is a Monday", async () => {
    const res = await request(app).get("/api/dashboard/weekly?weekStart=2026-10-14");
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toEqual({ path: "weekStart", message: "Week must start on a Monday" });
  });

  it("disables caching so the dashboard always shows the latest data", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("returns JSON errors for unknown routes", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
