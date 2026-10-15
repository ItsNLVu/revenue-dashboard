import { addDays, DAY_LABELS, weekDates } from "./week";

export interface DayValues {
  posRevenue: number;
  eatclubRevenue: number;
  labourCost: number;
  covers: number;
}

export interface DaySummary extends DayValues {
  date: string;
  dayLabel: (typeof DAY_LABELS)[number];
  /** POS + Eatclub. Labour is a cost, not revenue. */
  revenue: number;
  /** False when nothing was entered for this day yet (values are then 0). */
  hasData: boolean;
}

export interface Totals {
  revenue: number;
  /** Revenue divided by the number of days that have data. */
  avgPerDay: number;
  labourCost: number;
  covers: number;
  daysWithData: number;
}

export interface PeriodSummary {
  weekStart: string;
  weekEnd: string;
  /** False when no day of the week has been entered yet. */
  hasData: boolean;
  days: DaySummary[];
  totals: Totals;
}

export interface Comparison {
  /**
   * The previous week restricted to the weekdays the current week has data for, so a week in
   * progress (e.g. Mon to Wed) is compared with Mon to Wed of the week before, not with a full week.
   */
  previous: Totals & { hasData: boolean };
  revenuePct: number | null;
  avgPerDayPct: number | null;
  coversPct: number | null;
}

// Sum money in integer cents so 0.1 + 0.2 style float errors never reach the UI.
const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (cents: number) => cents / 100;

function sumDays(days: DaySummary[]): Totals {
  let revenueCents = 0;
  let labourCents = 0;
  let covers = 0;
  let daysWithData = 0;

  for (const day of days) {
    if (!day.hasData) continue;
    revenueCents += toCents(day.revenue);
    labourCents += toCents(day.labourCost);
    covers += day.covers;
    daysWithData += 1;
  }

  return {
    revenue: fromCents(revenueCents),
    avgPerDay: daysWithData === 0 ? 0 : fromCents(Math.round(revenueCents / daysWithData)),
    labourCost: fromCents(labourCents),
    covers,
    daysWithData,
  };
}

/**
 * Builds a Monday to Sunday summary. Days without a row are reported as zero with hasData=false
 * so the chart always has 7 slots and the UI can tell "no data yet" from "zero sales".
 */
export function summarizeWeek(weekStart: string, rowsByDate: Map<string, DayValues>): PeriodSummary {
  const days = weekDates(weekStart).map((date, i): DaySummary => {
    const row = rowsByDate.get(date);
    const values: DayValues = row ?? { posRevenue: 0, eatclubRevenue: 0, labourCost: 0, covers: 0 };
    const revenue = fromCents(toCents(values.posRevenue) + toCents(values.eatclubRevenue));
    return { date, dayLabel: DAY_LABELS[i], ...values, revenue, hasData: row !== undefined };
  });

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    hasData: days.some((d) => d.hasData),
    days,
    totals: sumDays(days),
  };
}

/** Percentage change rounded to one decimal; null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function compare(current: PeriodSummary, previous: PeriodSummary): Comparison {
  const comparableDays = previous.days.filter((_, i) => current.days[i].hasData);
  const previousTotals = sumDays(comparableDays);
  const hasData = previousTotals.daysWithData > 0;

  return {
    previous: { ...previousTotals, hasData },
    revenuePct: hasData ? percentChange(current.totals.revenue, previousTotals.revenue) : null,
    avgPerDayPct: hasData ? percentChange(current.totals.avgPerDay, previousTotals.avgPerDay) : null,
    coversPct: hasData ? percentChange(current.totals.covers, previousTotals.covers) : null,
  };
}
