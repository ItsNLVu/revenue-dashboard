import { EventIcon } from "./EventIcon";
import { SERIES, type VisibleSeries } from "./series";

interface ChartLegendProps {
  compare: boolean;
  visible: VisibleSeries;
}

export function ChartLegend({ compare, visible }: ChartLegendProps) {
  const items = compare
    ? [
        ...SERIES.map((s) => ({ key: s.key, label: `${s.label} (Current)`, color: s.color, on: visible[s.key] })),
        ...SERIES.map((s) => ({ key: `prev-${s.key}`, label: s.previousLabel, color: s.previousColor, on: visible[s.key] })),
      ]
    : SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color, on: visible[s.key] }));

  return (
    <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-[13px] text-ink/85 sm:gap-x-6 sm:gap-y-3 sm:text-sm">
      {items.map((item) => (
        <li key={item.key} className={`flex items-center gap-2 whitespace-nowrap transition-opacity ${item.on ? "" : "opacity-35"}`}>
          <span className="size-3 rounded-full" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
      <li className="flex basis-full flex-wrap items-center justify-center gap-x-4 gap-y-2.5 border-t border-line pt-2.5 whitespace-nowrap sm:basis-auto sm:flex-nowrap sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
        <span className="flex items-center gap-1.5">
          <EventIcon impact="positive" />
          Positive Event Impact
        </span>
        <span className="flex items-center gap-1.5">
          <EventIcon impact="negative" />
          Negative Event Impact
        </span>
      </li>
    </ul>
  );
}
