"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eraser, ExternalLink } from "lucide-react";
import { ApiError, apiFetch, loginUrlForCurrentPage } from "@/lib/api";
import { formatCount, formatDayDate, formatMoneyPrecise } from "@/lib/format";
import type { AdminWeek } from "@/lib/types";
import { Alert, Button, inputClass } from "./ui";

const FIELDS = [
  { key: "posRevenue", label: "POS revenue", unit: "$", integer: false },
  { key: "eatclubRevenue", label: "Eatclub revenue", unit: "$", integer: false },
  { key: "labourCost", label: "Labour cost", unit: "$", integer: false },
  { key: "covers", label: "Covers", unit: "", integer: true },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type RowValues = Record<FieldKey, string>;
type Rows = Record<string, RowValues>;
type Errors = Record<string, string>;

const EMPTY_ROW: RowValues = { posRevenue: "", eatclubRevenue: "", labourCost: "", covers: "" };

function toRows(week: AdminWeek): Rows {
  return Object.fromEntries(
    week.days.map((day) => [
      day.date,
      day.hasData
        ? {
            posRevenue: String(day.posRevenue),
            eatclubRevenue: String(day.eatclubRevenue),
            labourCost: String(day.labourCost),
            covers: String(day.covers),
          }
        : EMPTY_ROW,
    ]),
  );
}

const isBlank = (row: RowValues) => FIELDS.every((f) => row[f.key].trim() === "");

// Plain digits, or digits with thousands separators: 1200.50 or 1,200.50 (but not 1,2.5)
const NUMBER = /^(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/;

function parseField(raw: string, integer: boolean): { value?: number; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "Required" };
  if (!NUMBER.test(trimmed)) return { error: "Enter a number of 0 or more" };
  const text = trimmed.replace(/,/g, "");
  if (integer && text.includes(".")) return { error: "Whole number only" };
  if (!integer && /\.\d{3,}$/.test(text)) return { error: "Max 2 decimals" };
  return { value: Number(text) };
}

/** Client-side check before saving. A day is either left completely empty (no data) or fully filled in. */
function validate(rows: Rows) {
  const errors: Errors = {};
  const days: Array<{ date: string } & Record<FieldKey, number>> = [];

  for (const [date, row] of Object.entries(rows)) {
    if (isBlank(row)) continue;
    const day = { date } as { date: string } & Record<FieldKey, number>;
    for (const field of FIELDS) {
      const { value, error } = parseField(row[field.key], field.integer);
      if (error) errors[`${date}.${field.key}`] = error;
      else day[field.key] = value!;
    }
    days.push(day);
  }

  return { errors, days };
}

const UNSAVED_MESSAGE = "You have unsaved changes in this week. Leave without saving?";

export function WeekMetricsForm({ week }: { week: AdminWeek }) {
  const router = useRouter();
  const [version, setVersion] = useState(week.version);
  const [saved, setSaved] = useState<Rows>(() => toRows(week));
  const [rows, setRows] = useState<Rows>(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string; conflict?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);

  // Warn before leaving with unsaved numbers: closing/reloading the tab, and in-app links or
  // buttons marked with data-leaves-page (week arrows, dashboard link, sign out).
  useEffect(() => {
    if (!dirty) return;
    const warnOnUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const confirmLeave = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest("a[href], [data-leaves-page]");
      if (!target) return;
      if (target.matches("a[href]") && (target as HTMLAnchorElement).target === "_blank") return;
      if (!window.confirm(UNSAVED_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnOnUnload);
    // Capture phase: runs before Next.js <Link> handles the click.
    document.addEventListener("click", confirmLeave, true);
    return () => {
      window.removeEventListener("beforeunload", warnOnUnload);
      document.removeEventListener("click", confirmLeave, true);
    };
  }, [dirty]);

  function update(date: string, field: FieldKey, value: string) {
    setRows((current) => ({ ...current, [date]: { ...current[date], [field]: value } }));
    setErrors((current) => {
      const next = { ...current };
      delete next[`${date}.${field}`];
      return next;
    });
    setStatus(null);
  }

  function clearDay(date: string) {
    setRows((current) => ({ ...current, [date]: EMPTY_ROW }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(date))));
    setStatus(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const { errors: clientErrors, days } = validate(rows);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      setStatus({ tone: "error", text: "Some values need fixing. A day must be fully filled in or left empty." });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const result = await apiFetch<AdminWeek>("/api/admin/metrics", {
        method: "PUT",
        body: JSON.stringify({ weekStart: week.weekStart, baseVersion: version, days }),
      });
      const fresh = toRows(result);
      setVersion(result.version);
      setSaved(fresh);
      setRows(fresh);
      setStatus({ tone: "success", text: "Saved. The dashboard now shows these numbers." });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push(loginUrlForCurrentPage());
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setStatus({ tone: "error", text: error.message, conflict: true });
        return;
      }
      if (error instanceof ApiError) {
        // Map "days.<index>.<field>" from the API back to the row it belongs to.
        const mapped: Errors = {};
        for (const [path, message] of Object.entries(error.fieldErrors)) {
          const [, index, field] = path.split(".");
          const date = days[Number(index)]?.date;
          if (date && field) mapped[`${date}.${field}`] = message;
        }
        setErrors(mapped);
      }
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  /** After a 409: replace the form with the numbers someone else just saved. */
  async function loadLatest() {
    try {
      const latest = await apiFetch<AdminWeek>(`/api/admin/metrics?weekStart=${week.weekStart}`);
      const fresh = toRows(latest);
      setVersion(latest.version);
      setSaved(fresh);
      setRows(fresh);
      setErrors({});
      setStatus({ tone: "success", text: "Loaded the latest numbers. Re-enter your changes and save again." });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Could not load the latest numbers" });
    }
  }

  const preview = summarize(rows);

  return (
    <form onSubmit={onSubmit} className="rounded-[20px] border border-line bg-surface p-5 sm:p-6" noValidate>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Daily figures</h2>
          <p className="mt-0.5 text-sm text-muted">Leave a day empty if there is no data for it yet.</p>
        </div>
        <Link
          href={`/?week=${week.weekStart}`}
          className="flex items-center gap-1.5 text-sm font-medium text-ink/75 underline-offset-4 hover:text-ink hover:underline"
        >
          View this week on the dashboard
          <ExternalLink size={14} aria-hidden />
        </Link>
      </div>

      <div className="mt-5 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="sticky left-0 z-10 bg-surface pb-2 font-medium">Day</th>
              {FIELDS.map((field) => (
                <th key={field.key} className="pb-2 pl-3 font-medium">
                  {field.label}
                  {field.unit && <span className="text-muted/70"> ({field.unit})</span>}
                </th>
              ))}
              <th className="pb-2 pl-3 text-right font-medium">Revenue</th>
              <th className="w-10 pb-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {week.days.map((day) => {
              const row = rows[day.date];
              const revenue = preview.byDate.get(day.date);
              return (
                <tr key={day.date} className="align-top">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t border-line bg-surface pt-4 pr-3 pb-2 text-left font-medium whitespace-nowrap"
                  >
                    {formatDayDate(day.date)}
                  </th>
                  {FIELDS.map((field) => {
                    const errorKey = `${day.date}.${field.key}`;
                    const error = errors[errorKey];
                    return (
                      <td key={field.key} className="border-t border-line py-2 pl-3">
                        <input
                          aria-label={`${field.label} on ${formatDayDate(day.date)}`}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? `${errorKey}-error` : undefined}
                          inputMode={field.integer ? "numeric" : "decimal"}
                          autoComplete="off"
                          placeholder="-"
                          value={row[field.key]}
                          onChange={(e) => update(day.date, field.key, e.target.value)}
                          className={`${inputClass} text-right tabular-nums`}
                        />
                        {error && (
                          <p id={`${errorKey}-error`} className="mt-1 text-xs text-down">
                            {error}
                          </p>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-t border-line pt-4 pb-2 pl-3 text-right whitespace-nowrap tabular-nums">
                    {revenue === undefined ? <span className="text-muted/60">-</span> : formatMoneyPrecise(revenue)}
                  </td>
                  <td className="border-t border-line py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => clearDay(day.date)}
                      disabled={isBlank(row)}
                      title="Clear this day"
                      aria-label={`Clear ${formatDayDate(day.date)}`}
                      className="grid size-9 place-items-center rounded-[10px] text-muted hover:bg-subtle hover:text-ink disabled:invisible"
                    >
                      <Eraser size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td className="sticky left-0 z-10 border-t border-line bg-surface pt-3">Week total</td>
              <td colSpan={3} className="border-t border-line pt-3 pl-3 text-muted">
                Avg per day {formatMoneyPrecise(preview.avgPerDay)}
              </td>
              <td className="border-t border-line pt-3 pl-3 text-muted tabular-nums">{formatCount(preview.covers)} covers</td>
              <td className="border-t border-line pt-3 pl-3 text-right tabular-nums">{formatMoneyPrecise(preview.revenue)}</td>
              <td className="border-t border-line" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {status && (
          <div className="mr-auto">
            <Alert tone={status.tone}>
              {status.text}
              {status.conflict && (
                <button type="button" onClick={loadLatest} className="ml-2 font-medium underline underline-offset-2">
                  Load latest numbers
                </button>
              )}
            </Alert>
          </div>
        )}
        <Button
          onClick={() => {
            setRows(saved);
            setErrors({});
            setStatus(null);
          }}
          disabled={!dirty || saving}
        >
          Discard changes
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
          Save week
        </Button>
      </div>
    </form>
  );
}

/** Live totals of the values currently typed (same rules as the API: revenue = POS + Eatclub, avg over days entered). */
function summarize(rows: Rows) {
  const byDate = new Map<string, number>();
  let revenueCents = 0;
  let covers = 0;
  for (const [date, row] of Object.entries(rows)) {
    if (isBlank(row)) continue;
    const pos = parseField(row.posRevenue, false).value ?? 0;
    const eatclub = parseField(row.eatclubRevenue, false).value ?? 0;
    const dayCents = Math.round(pos * 100) + Math.round(eatclub * 100);
    byDate.set(date, dayCents / 100);
    revenueCents += dayCents;
    covers += parseField(row.covers, true).value ?? 0;
  }
  const days = byDate.size;
  return { byDate, revenue: revenueCents / 100, avgPerDay: days ? Math.round(revenueCents / days) / 100 : 0, covers };
}
