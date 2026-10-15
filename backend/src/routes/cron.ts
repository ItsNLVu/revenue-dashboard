import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { seedDemoData } from "../lib/demo-data";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/error";

export const cronRouter = Router();

/**
 * Public demo only: puts the demo data back every day (Vercel Cron, see vercel.json), so the
 * hosted dashboard always shows the current week and any visitor edits are undone.
 * Disabled unless CRON_SECRET is set; Vercel sends it as "Authorization: Bearer <CRON_SECRET>".
 */
cronRouter.get("/reset-demo", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(404, "NOT_FOUND", "Route GET /api/cron/reset-demo not found");
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(req.headers.authorization ?? "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new HttpError(401, "UNAUTHENTICATED", "Invalid cron secret");
  }

  const result = await seedDemoData(prisma, {
    email: process.env.ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.ADMIN_PASSWORD ?? "admin12345",
    mode: "reset",
  });
  res.json({ status: "reset", weeks: result.weeks });
});
