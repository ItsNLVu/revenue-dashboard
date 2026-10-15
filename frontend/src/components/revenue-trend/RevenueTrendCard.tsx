"use client";

import { useRef, useState } from "react";
import { ChartColumn, Check, Download, LoaderCircle } from "lucide-react";
import { formatCount, formatMoney } from "@/lib/format";
import type { WeeklyDashboard } from "@/lib/types";
import { ChartLegend } from "./ChartLegend";
import { KpiCard } from "./KpiCard";
import { RevenueChart } from "./RevenueChart";
import { SERIES, type SeriesKey, type VisibleSeries } from "./series";

export function RevenueTrendCard({ data }: { data: WeeklyDashboard }) {
  const cardRef = useRef<HTMLElement>(null);
  const [compare, setCompare] = useState(false);
  const [visible, setVisible] = useState<VisibleSeries>({ pos: true, eatclub: true, labour: true });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { current, comparison } = data;
  // Like-for-like: the previous week limited to the weekdays this week has data for.
  const previous = comparison.previous;
  const title = `${data.isCurrentWeek ? "This Week's Revenue Trend" : "Revenue Trend"}${compare ? " vs Previous Period" : ""}`;
  const prev = (value: string) => (previous.hasData ? value : null);
  const partial = current.hasData && current.totals.daysWithData < 7;

  const toggleSeries = (key: SeriesKey) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  async function exportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      // Loaded on demand: only needed when someone actually exports.
      const { toPng } = await import("html-to-image");
      const url = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#fdfdfd",
        filter: (node) => !(node instanceof HTMLElement && node.dataset.exportIgnore !== undefined),
      });
      const link = document.createElement("a");
      link.download = `revenue-trend-${current.weekStart}${compare ? "-vs-previous" : ""}.png`;
      link.href = url;
      link.click();
    } catch (error) {
      console.error(error);
      setExportError("Could not create the image. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section
      ref={cardRef}
      className="rounded-[20px] border border-line bg-surface p-5 sm:px-6 sm:pt-6 sm:pb-7"
      aria-labelledby="revenue-trend-title"
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h2 id="revenue-trend-title" className="max-w-80 text-xl leading-snug font-medium tracking-tight">
          {title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <legend className="sr-only">Series</legend>
            {SERIES.map((series) => (
              <label key={series.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink/85 select-none">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={visible[series.key]}
                  onChange={() => toggleSeries(series.key)}
                />
                <span className="grid size-4 place-items-center rounded-[4px] border border-ink bg-white text-white peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-eatclub/50">
                  {visible[series.key] && <Check size={12} strokeWidth={3} aria-hidden />}
                </span>
                <span className="h-0.5 w-2.5 rounded-full" style={{ background: series.color }} aria-hidden />
                {series.label}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap items-center gap-3" data-export-ignore>
            <button
              type="button"
              aria-pressed={compare}
              onClick={() => setCompare((c) => !c)}
              className={`flex h-8 items-center gap-1.5 rounded-[10px] border px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                compare
                  ? "border-ink bg-ink text-white hover:bg-ink/90"
                  : "border-accent-strong bg-accent text-ink hover:bg-accent-strong"
              }`}
            >
              <ChartColumn size={15} aria-hidden />
              Compare to Previous
            </button>
            <button
              type="button"
              onClick={exportPng}
              disabled={exporting}
              className="flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-subtle px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-[#ecebe7] disabled:opacity-60"
            >
              {exporting ? (
                <LoaderCircle size={15} className="animate-spin" aria-hidden />
              ) : (
                <Download size={15} aria-hidden />
              )}
              Export PNG
            </button>
          </div>
        </div>
      </header>

      {exportError && (
        <p role="alert" className="mt-3 rounded-[10px] bg-down/10 px-3 py-2 text-sm text-down" data-export-ignore>
          {exportError}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:mt-7">
        <KpiCard
          label="Total Revenue"
          value={formatMoney(current.totals.revenue)}
          comparison={compare ? { previousValue: prev(formatMoney(previous.revenue)), percent: comparison.revenuePct } : undefined}
        />
        <KpiCard
          label="Average per Day"
          value={formatMoney(current.totals.avgPerDay)}
          comparison={
            compare ? { previousValue: prev(formatMoney(previous.avgPerDay)), percent: comparison.avgPerDayPct } : undefined
          }
        />
        <KpiCard
          label="Total Covers"
          value={formatCount(current.totals.covers)}
          comparison={compare ? { previousValue: prev(formatCount(previous.covers)), percent: comparison.coversPct } : undefined}
        />
      </div>

      {/* On small screens the chart keeps a readable width and scrolls sideways instead of squeezing the bars */}
      {partial && (
        <p className="mt-3 text-[13px] text-muted">
          {current.totals.daysWithData} of 7 days entered so far.
          {compare && " Compared with the same days of the previous week."}
        </p>
      )}

      <div className="relative mt-2 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="min-w-[600px] sm:min-w-0">
          <RevenueChart data={data} compare={compare} visible={visible} />
        </div>
        {!current.hasData && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">
            No data has been entered for this week yet.
          </p>
        )}
      </div>
      <p className="mt-1 text-center text-xs text-muted sm:hidden">Swipe the chart to see the whole week</p>

      <ChartLegend compare={compare} visible={visible} />
    </section>
  );
}
