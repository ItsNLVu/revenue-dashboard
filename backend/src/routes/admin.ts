import { createHash } from "node:crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import type { PeriodSummary } from "../lib/metrics";
import { loadEvents, loadWeek, serializeEvent } from "../lib/repository";
import { addDays, mondayOf, toDate, todayIso } from "../lib/week";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { createEventBody, idParam, optionalWeekQuery, saveWeekBody, updateEventBody } from "../schemas";

export const adminRouter = Router();
adminRouter.use(requireAuth);

/**
 * Fingerprint of a week's content. The form sends back the version it was loaded with, so a save
 * that would overwrite someone else's newer changes is refused instead of silently winning.
 */
function weekVersion(week: PeriodSummary): string {
  const content = week.days.map((d) => (d.hasData ? [d.posRevenue, d.eatclubRevenue, d.labourCost, d.covers] : null));
  return createHash("sha1").update(JSON.stringify(content)).digest("hex").slice(0, 16);
}

async function loadWeekWithVersion(weekStart: string) {
  const week = await loadWeek(weekStart);
  return { ...week, version: weekVersion(week) };
}

adminRouter.get("/metrics", async (req, res) => {
  const { weekStart = mondayOf(todayIso()) } = optionalWeekQuery.parse(req.query);
  res.json(await loadWeekWithVersion(weekStart));
});

adminRouter.put("/metrics", async (req, res) => {
  const { weekStart, baseVersion, days } = saveWeekBody.parse(req.body);
  const sentDates = days.map((day) => toDate(day.date));
  // Same order every time, so concurrent writers can never lock rows in opposite orders.
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));

  await prisma.$transaction(async (tx) => {
    // One writer per week at a time (released automatically at commit/rollback).
    const lockKey = Math.round(toDate(weekStart).getTime() / 86_400_000);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1, ${lockKey}::int)`;

    if (baseVersion && weekVersion(await loadWeek(weekStart, tx)) !== baseVersion) {
      throw new HttpError(
        409,
        "WEEK_CHANGED",
        "This week was changed by someone else while you were editing. Reload to see the latest numbers.",
      );
    }

    await tx.dailyMetric.deleteMany({
      where: { date: { gte: toDate(weekStart), lte: toDate(addDays(weekStart, 6)), notIn: sentDates } },
    });
    for (const { date, ...values } of ordered) {
      await tx.dailyMetric.upsert({
        where: { date: toDate(date) },
        create: { date: toDate(date), ...values },
        update: values,
      });
    }
  }, { maxWait: 10_000, timeout: 15_000 });

  res.json(await loadWeekWithVersion(weekStart));
});

adminRouter.get("/events", async (req, res) => {
  const { weekStart = mondayOf(todayIso()) } = optionalWeekQuery.parse(req.query);
  res.json({ weekStart, events: await loadEvents(weekStart) });
});

adminRouter.post("/events", async (req, res) => {
  const { date, ...fields } = createEventBody.parse(req.body);
  const event = await prisma.event.create({ data: { date: toDate(date), ...fields } });
  res.status(201).json({ event: serializeEvent(event) });
});

adminRouter.patch("/events/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  const { date, ...fields } = updateEventBody.parse(req.body);
  const event = await prisma.event.update({
    where: { id },
    data: { ...fields, ...(date ? { date: toDate(date) } : {}) },
  });
  res.json({ event: serializeEvent(event) });
});

adminRouter.delete("/events/:id", async (req, res) => {
  const { id } = idParam.parse(req.params);
  await prisma.event.delete({ where: { id } });
  res.status(204).end();
});
