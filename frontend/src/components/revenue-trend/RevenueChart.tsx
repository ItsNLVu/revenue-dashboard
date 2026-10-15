"use client";

import { Bar, BarChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatAxisK, formatDayDate, formatMoneyPrecise, niceAxis } from "@/lib/format";
import type { EventImpact, ImpactEvent, WeeklyDashboard } from "@/lib/types";
import { EventIcon } from "./EventIcon";
import { SERIES, type VisibleSeries } from "./series";

// null = no data entered for that day, so no bar is drawn (different from a real $0 day).
interface ChartRow {
  day: string;
  date: string;
  previousDate: string;
  hasData: boolean;
  previousHasData: boolean;
  pos: number | null;
  eatclub: number | null;
  labour: number | null;
  prevPos: number | null;
  prevEatclub: number | null;
  prevLabour: number | null;
  events: ImpactEvent[];
}

interface RevenueChartProps {
  data: WeeklyDashboard;
  compare: boolean;
  visible: VisibleSeries;
}

const color = Object.fromEntries(SERIES.map((s) => [s.key, s])) as Record<string, (typeof SERIES)[number]>;
const TOP_RADIUS: [number, number, number, number] = [3, 3, 0, 0];
const MARKER_GAP = 30;

export function RevenueChart({ data, compare, visible }: RevenueChartProps) {
  const rows: ChartRow[] = data.current.days.map((day, i) => {
    const previous = data.previous.days[i];
    const value = (has: boolean, amount: number) => (has ? amount : null);
    return {
      day: day.dayLabel,
      date: day.date,
      previousDate: previous.date,
      hasData: day.hasData,
      previousHasData: previous.hasData,
      pos: value(day.hasData, day.posRevenue),
      eatclub: value(day.hasData, day.eatclubRevenue),
      labour: value(day.hasData, day.labourCost),
      prevPos: value(previous.hasData, previous.posRevenue),
      prevEatclub: value(previous.hasData, previous.eatclubRevenue),
      prevLabour: value(previous.hasData, previous.labourCost),
      events: data.events.filter((e) => e.date === day.date),
    };
  });

  // The axis is sized from both weeks and every series, so it stays still while toggling.
  const axis = niceAxis(
    Math.max(
      ...rows.flatMap((r) => [
        (r.pos ?? 0) + (r.eatclub ?? 0),
        r.labour ?? 0,
        (r.prevPos ?? 0) + (r.prevEatclub ?? 0),
        r.prevLabour ?? 0,
      ]),
    ),
  );

  // Top-most visible segment of each stack gets the rounded corners.
  const currentTop = visible.eatclub ? "eatclub" : "pos";

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 40, right: 4, bottom: 0, left: -8 }}
          barGap={4}
          barCategoryGap={compare ? "10%" : "11%"}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="4 4" stroke="#e6e6e6" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: "#e6e6e6" }}
            tick={{ fill: "var(--color-ink)", fontSize: 13 }}
            tickMargin={8}
          />
          <YAxis
            domain={[0, axis.max]}
            ticks={axis.ticks}
            tickFormatter={formatAxisK}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-ink)", fontSize: 12 }}
            width={48}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} rows={rows} compare={compare} />}
            cursor={{ fill: "rgba(0,0,0,0.035)" }}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ outline: "none", zIndex: 10 }}
          />

          {/* Current week: POS + Eatclub stacked, labour on its own */}
          {visible.pos && (
            <Bar
              dataKey="pos"
              name={color.pos.label}
              stackId="current"
              fill={color.pos.color}
              radius={currentTop === "pos" ? TOP_RADIUS : 0}
            />
          )}
          {visible.eatclub && (
            <Bar dataKey="eatclub" name={color.eatclub.label} stackId="current" fill={color.eatclub.color} radius={TOP_RADIUS} />
          )}
          {/* Every bar gets a stackId so Recharts keeps this order: current, labour, previous, previous labour */}
          {visible.labour && (
            <Bar dataKey="labour" name={color.labour.label} stackId="labour" fill={color.labour.color} radius={TOP_RADIUS} />
          )}

          {/* Previous week, same layout in lighter colours */}
          {compare && visible.pos && (
            <Bar
              dataKey="prevPos"
              name={color.pos.previousLabel}
              stackId="previous"
              fill={color.pos.previousColor}
              radius={currentTop === "pos" ? TOP_RADIUS : 0}
            />
          )}
          {compare && visible.eatclub && (
            <Bar
              dataKey="prevEatclub"
              name={color.eatclub.previousLabel}
              stackId="previous"
              fill={color.eatclub.previousColor}
              radius={TOP_RADIUS}
            />
          )}
          {compare && visible.labour && (
            <Bar
              dataKey="prevLabour"
              name={color.labour.previousLabel}
              stackId="previousLabour"
              fill={color.labour.previousColor}
              radius={TOP_RADIUS}
            />
          )}

          {rows.flatMap((row) => markersFor(row, compare, visible))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One marker per impact type and day, floating just above the tallest bar of that day. */
function markersFor(row: ChartRow, compare: boolean, visible: VisibleSeries) {
  const impacts = (["positive", "negative"] as const).filter((impact) => row.events.some((e) => e.impact === impact));
  if (impacts.length === 0) return [];

  const stack = (pos: number | null, eatclub: number | null) =>
    (visible.pos ? (pos ?? 0) : 0) + (visible.eatclub ? (eatclub ?? 0) : 0);
  const heights = [stack(row.pos, row.eatclub), visible.labour ? (row.labour ?? 0) : 0];
  if (compare) heights.push(stack(row.prevPos, row.prevEatclub), visible.labour ? (row.prevLabour ?? 0) : 0);
  const top = Math.max(...heights);

  return impacts.map((impact, i) => (
    <ReferenceDot
      key={`${row.date}-${impact}`}
      x={row.day}
      y={top}
      ifOverflow="visible"
      shape={(props: { cx?: number; cy?: number }) => (
        <EventMarker
          cx={(props.cx ?? 0) + (impacts.length > 1 ? (i - 0.5) * 28 : 0)}
          cy={(props.cy ?? 0) - MARKER_GAP}
          impact={impact}
          titles={row.events.filter((e) => e.impact === impact).map((e) => e.title)}
        />
      )}
    />
  ));
}

function EventMarker({ cx, cy, impact, titles }: { cx: number; cy: number; impact: EventImpact; titles: string[] }) {
  const positive = impact === "positive";
  return (
    <g transform={`translate(${cx}, ${cy})`} className="event-marker" role="img" aria-label={`${impact} event: ${titles.join(", ")}`}>
      <title>{titles.join("\n")}</title>
      <circle r={12} fill={positive ? "#ecfcef" : "#fdeeef"} stroke={positive ? "#bfeccb" : "#f6c9cd"} />
      <svg x={-7} y={-7} width={14} height={14} overflow="visible">
        <EventIcon impact={impact} />
      </svg>
    </g>
  );
}

function ChartTooltip({
  active,
  payload = [],
  label,
  rows,
  compare,
}: TooltipContentProps<ValueType, NameType> & { rows: ChartRow[]; compare: boolean }) {
  // Look the day up by its label: for a day without data Recharts sends no payload at all.
  const row = rows.find((r) => r.day === label);
  if (!active || !row) return null;
  const isPrevious = (p: (typeof payload)[number]) => String(p.dataKey).startsWith("prev");
  const current = payload.filter((p) => !isPrevious(p));
  const previous = payload.filter(isPrevious);

  return (
    <div className="min-w-56 rounded-xl border border-line bg-white px-3.5 py-3 text-[13px] shadow-lg shadow-black/5">
      <TooltipSection title={formatDayDate(row.date)} entries={current} hasData={row.hasData} />
      {compare && (
        <TooltipSection
          title={`${formatDayDate(row.previousDate)} (previous)`}
          entries={previous}
          hasData={row.previousHasData}
        />
      )}
      {row.events.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
          {row.events.map((event) => (
            <li key={event.id} className="flex gap-2">
              <span className="mt-0.5 shrink-0">
                <EventIcon impact={event.impact} />
              </span>
              <span>
                <span className="font-medium">{event.title}</span>
                {event.description && <span className="block max-w-64 text-muted">{event.description}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tooltips use the plain series names ("Eatclub Revenue"), the section title already says which week. */
const plainLabel = (dataKey: unknown) => {
  const key = String(dataKey).replace(/^prev/, "").toLowerCase();
  return color[key]?.label ?? String(dataKey);
};

function TooltipSection({
  title,
  entries,
  hasData,
}: {
  title: string;
  entries: TooltipContentProps<ValueType, NameType>["payload"];
  hasData: boolean;
}) {
  if (hasData && !entries?.length) return null;
  return (
    <div className="[&+&]:mt-2 [&+&]:border-t [&+&]:border-line [&+&]:pt-2">
      <p className="mb-1 font-medium">{title}</p>
      {!hasData ? (
        <p className="text-muted">No data entered</p>
      ) : (
        entries?.map((entry) => (
          <p key={String(entry.dataKey)} className="flex items-center justify-between gap-4 tabular-nums">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full" style={{ background: entry.color }} />
              {plainLabel(entry.dataKey)}
            </span>
            {formatMoneyPrecise(Number(entry.value))}
          </p>
        ))
      )}
    </div>
  );
}
