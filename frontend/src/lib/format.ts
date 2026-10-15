const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currencyPrecise = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** $15,974 */
export const formatMoney = (value: number) => currency.format(value);
/** $1,000.50, used in tooltips where cents matter */
export const formatMoneyPrecise = (value: number) => currencyPrecise.format(value);
/** 871 */
export const formatCount = (value: number) => integer.format(value);

/** +6.6% / -3.0% */
export function formatPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Y-axis ticks as in the design: 0k, 0.75k, 1.5k, 2.25k, 3k */
export function formatAxisK(value: number): string {
  return `${Number((value / 1000).toFixed(2))}k`;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** 12 Oct - 18 Oct 2026 */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${shortDate.format(new Date(`${weekStart}T00:00:00Z`))} - ${longDate.format(new Date(`${weekEnd}T00:00:00Z`))}`;
}

/** Thu 15 Oct */
export function formatDayDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/** Shifts an ISO date by whole days (UTC, so no DST surprises). */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Reads a `?week=` URL value: any real date from 2000 to 2099 opens the week containing it.
 * Anything else (missing, malformed, impossible like 2026-13-45) returns undefined.
 */
export function parseWeekParam(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(value)) return undefined;
  if (value < "2000-01-01" || value > "2099-12-31") return undefined;
  return mondayOf(value);
}

/** Monday of the week containing the given date. */
export function mondayOf(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return addDays(iso, -((weekday + 6) % 7));
}

/** A "nice" axis maximum split into 4 steps, e.g. 2,905 → 3,000 (step 750) like the design. */
export function niceAxis(maxValue: number, intervals = 4): { max: number; ticks: number[] } {
  const raw = Math.max(maxValue, 1) / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 5, 7.5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const ticks = Array.from({ length: intervals + 1 }, (_, i) => Number((step * i).toFixed(6)));
  return { max: ticks[intervals], ticks };
}
