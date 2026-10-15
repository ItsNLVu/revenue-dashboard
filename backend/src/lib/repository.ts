import type { Event, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { summarizeWeek, type DayValues } from "./metrics";
import { addDays, DAY_LABELS, mondayOf, toDate, toIso } from "./week";

/** Reads a week; pass a transaction client to read inside a transaction. */
export async function loadWeek(weekStart: string, db: Prisma.TransactionClient = prisma) {
  const rows = await db.dailyMetric.findMany({
    where: { date: { gte: toDate(weekStart), lte: toDate(addDays(weekStart, 6)) } },
  });

  const byDate = new Map<string, DayValues>(
    rows.map((row) => [
      toIso(row.date),
      {
        posRevenue: row.posRevenue.toNumber(),
        eatclubRevenue: row.eatclubRevenue.toNumber(),
        labourCost: row.labourCost.toNumber(),
        covers: row.covers,
      },
    ]),
  );

  return summarizeWeek(weekStart, byDate);
}

export function serializeEvent(event: Event) {
  const date = toIso(event.date);
  const weekday = (event.date.getUTCDay() + 6) % 7;
  return {
    id: event.id,
    date,
    dayLabel: DAY_LABELS[weekday],
    impact: event.impact,
    title: event.title,
    description: event.description,
  };
}

export async function loadEvents(weekStart: string) {
  const events = await prisma.event.findMany({
    where: { date: { gte: toDate(weekStart), lte: toDate(addDays(weekStart, 6)) } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  return events.map(serializeEvent);
}

/** Mondays of every week that has at least one day of data, newest first. */
export async function listWeeksWithData(): Promise<string[]> {
  const rows = await prisma.dailyMetric.findMany({ select: { date: true }, orderBy: { date: "desc" } });
  return [...new Set(rows.map((row) => mondayOf(toIso(row.date))))];
}
