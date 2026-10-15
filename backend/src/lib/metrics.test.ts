import { describe, expect, it } from "vitest";
import { compare, percentChange, summarizeWeek, type DayValues } from "./metrics";

const day = (posRevenue: number, eatclubRevenue: number, labourCost: number, covers: number): DayValues => ({
  posRevenue,
  eatclubRevenue,
  labourCost,
  covers,
});

// Same numbers as the reference video (and prisma/seed.ts)
const currentWeek = new Map<string, DayValues>([
  ["2026-10-12", day(1720, 310, 600, 112)],
  ["2026-10-13", day(1785, 325, 630, 118)],
  ["2026-10-14", day(1800, 315, 880, 120)],
  ["2026-10-15", day(1780, 290, 630, 117)],
  ["2026-10-16", day(1725, 300, 570, 114)],
  ["2026-10-17", day(2185, 720, 850, 152)],
  ["2026-10-18", day(2265, 454, 1120, 138)],
]);
const previousWeek = new Map<string, DayValues>([
  ["2026-10-05", day(1550, 290, 520, 104)],
  ["2026-10-06", day(1820, 330, 650, 110)],
  ["2026-10-07", day(1600, 290, 760, 108)],
  ["2026-10-08", day(1560, 270, 550, 106)],
  ["2026-10-09", day(1700, 290, 590, 112)],
  ["2026-10-10", day(1950, 620, 790, 140)],
  ["2026-10-11", day(2290, 422, 1130, 140)],
]);

describe("summarizeWeek", () => {
  it("adds POS + Eatclub as revenue (labour excluded) and averages over the days", () => {
    const week = summarizeWeek("2026-10-12", currentWeek);

    expect(week.totals).toEqual({ revenue: 15974, avgPerDay: 2282, labourCost: 5280, covers: 871, daysWithData: 7 });
    expect(week.days[0]).toMatchObject({ date: "2026-10-12", dayLabel: "Mon", revenue: 2030, hasData: true });
    expect(week.days[6]).toMatchObject({ date: "2026-10-18", dayLabel: "Sun" });
    expect(week.weekEnd).toBe("2026-10-18");
  });

  it("always returns 7 days and fills missing days with zeros", () => {
    const week = summarizeWeek("2026-10-12", new Map([["2026-10-14", day(100, 50, 20, 9)]]));

    expect(week.days).toHaveLength(7);
    expect(week.days.map((d) => d.hasData)).toEqual([false, false, true, false, false, false, false]);
    expect(week.days[0]).toMatchObject({ posRevenue: 0, eatclubRevenue: 0, labourCost: 0, covers: 0, revenue: 0 });
    expect(week.hasData).toBe(true);
    // A week in progress is averaged over the days entered, not diluted by empty days
    expect(week.totals.avgPerDay).toBe(150);
    expect(week.totals.daysWithData).toBe(1);
  });

  it("does not accumulate floating point errors on cents", () => {
    const week = summarizeWeek("2026-10-12", new Map([["2026-10-12", day(0.1, 0.2, 0, 0)]]));
    expect(week.totals.revenue).toBe(0.3);
  });

  it("marks an empty week as having no data", () => {
    const week = summarizeWeek("2026-10-12", new Map());
    expect(week.hasData).toBe(false);
    expect(week.totals).toEqual({ revenue: 0, avgPerDay: 0, labourCost: 0, covers: 0, daysWithData: 0 });
  });
});

describe("percentChange", () => {
  it("rounds to one decimal and keeps the sign", () => {
    expect(percentChange(15974, 14982)).toBe(6.6);
    expect(percentChange(871, 820)).toBe(6.2);
    expect(percentChange(90, 100)).toBe(-10);
  });

  it("returns null instead of dividing by zero", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe("compare", () => {
  it("matches the figures shown in the reference video", () => {
    const current = summarizeWeek("2026-10-12", currentWeek);
    const previous = summarizeWeek("2026-10-05", previousWeek);

    expect(previous.totals.revenue).toBe(14982);
    expect(previous.totals.covers).toBe(820);
    expect(compare(current, previous)).toEqual({
      previous: { revenue: 14982, avgPerDay: 2140.29, labourCost: 4990, covers: 820, daysWithData: 7, hasData: true },
      revenuePct: 6.6,
      avgPerDayPct: 6.6,
      coversPct: 6.2,
    });
  });

  it("compares a week in progress with the same weekdays of the previous week", () => {
    // Only Mon to Wed entered so far this week
    const partial = new Map([...currentWeek].slice(0, 3));
    const current = summarizeWeek("2026-10-12", partial);
    const previous = summarizeWeek("2026-10-05", previousWeek);
    const result = compare(current, previous);

    expect(current.totals.revenue).toBe(2030 + 2110 + 2115);
    // Previous Mon to Wed: 1840 + 2150 + 1890, not the full previous week
    expect(result.previous.revenue).toBe(5880);
    expect(result.previous.covers).toBe(104 + 110 + 108);
    expect(result.revenuePct).toBe(6.4);
    expect(result.avgPerDayPct).toBe(6.4);
  });

  it("averages the previous week over the comparable days it actually has", () => {
    const current = summarizeWeek("2026-10-12", currentWeek);
    const previous = summarizeWeek("2026-10-05", new Map([...previousWeek].slice(0, 2)));
    const result = compare(current, previous);

    expect(result.previous.daysWithData).toBe(2);
    expect(result.previous.avgPerDay).toBe((1840 + 2150) / 2);
  });

  it("returns nulls when the previous week has no data", () => {
    const current = summarizeWeek("2026-10-12", currentWeek);
    const previous = summarizeWeek("2026-10-05", new Map());

    expect(compare(current, previous)).toMatchObject({
      previous: { hasData: false },
      revenuePct: null,
      avgPerDayPct: null,
      coversPct: null,
    });
  });
});
