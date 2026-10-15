// Shapes returned by the backend API (see backend/src/routes).

export type DayLabel = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type EventImpact = "positive" | "negative";

export interface DaySummary {
  date: string;
  dayLabel: DayLabel;
  posRevenue: number;
  eatclubRevenue: number;
  labourCost: number;
  covers: number;
  revenue: number;
  hasData: boolean;
}

export interface Totals {
  revenue: number;
  /** Revenue / number of days that have data */
  avgPerDay: number;
  labourCost: number;
  covers: number;
  daysWithData: number;
}

export interface PeriodSummary {
  weekStart: string;
  weekEnd: string;
  hasData: boolean;
  days: DaySummary[];
  totals: Totals;
}

/** Admin view of a week: `version` is sent back on save to detect concurrent edits. */
export interface AdminWeek extends PeriodSummary {
  version: string;
}

export interface ImpactEvent {
  id: number;
  date: string;
  dayLabel: DayLabel;
  impact: EventImpact;
  title: string;
  description: string | null;
}

export interface WeeklyDashboard {
  weekStart: string;
  isCurrentWeek: boolean;
  defaultWeekStart: string;
  availableWeeks: string[];
  current: PeriodSummary;
  previous: PeriodSummary;
  comparison: {
    /** Previous week limited to the weekdays the current week has data for (like-for-like) */
    previous: Totals & { hasData: boolean };
    revenuePct: number | null;
    avgPerDayPct: number | null;
    coversPct: number | null;
  };
  events: ImpactEvent[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}
