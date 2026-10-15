// Calendar helpers. Dates travel as ISO "YYYY-MM-DD" strings and are stored as Postgres DATE,
// so all arithmetic happens in UTC to avoid timezone drift. Weeks start on Monday.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

export function isMonday(iso: string): boolean {
  return toDate(iso).getUTCDay() === 1;
}

export function mondayOf(iso: string): string {
  const weekday = toDate(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((weekday + 6) % 7));
}

export function weekDates(weekStart: string): string[] {
  return DAY_LABELS.map((_, i) => addDays(weekStart, i));
}

/** Today's date in the server's local timezone. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
