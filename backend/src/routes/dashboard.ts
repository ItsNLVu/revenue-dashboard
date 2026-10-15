import { Router } from "express";
import { compare } from "../lib/metrics";
import { listWeeksWithData, loadEvents, loadWeek } from "../lib/repository";
import { addDays, mondayOf, todayIso } from "../lib/week";
import { optionalWeekQuery } from "../schemas";

export const dashboardRouter = Router();

/**
 * Everything the "Revenue Trend" card needs in one call: the selected week, the week before it,
 * the comparison percentages and the events of the selected week.
 * Without ?weekStart the current week is used, or the latest week that has data.
 */
dashboardRouter.get("/weekly", async (req, res) => {
  const query = optionalWeekQuery.parse(req.query);
  const currentWeek = mondayOf(todayIso());
  const availableWeeks = await listWeeksWithData();

  const defaultWeekStart = availableWeeks.includes(currentWeek) ? currentWeek : (availableWeeks[0] ?? currentWeek);
  const weekStart = query.weekStart ?? defaultWeekStart;
  const previousWeekStart = addDays(weekStart, -7);

  const [current, previous, events] = await Promise.all([
    loadWeek(weekStart),
    loadWeek(previousWeekStart),
    loadEvents(weekStart),
  ]);

  res.json({
    weekStart,
    isCurrentWeek: weekStart === currentWeek,
    /** The week shown when no weekStart is given */
    defaultWeekStart,
    availableWeeks,
    current,
    previous,
    comparison: compare(current, previous),
    events,
  });
});
