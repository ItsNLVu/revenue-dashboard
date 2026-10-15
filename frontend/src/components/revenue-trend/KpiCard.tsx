import { formatPercent } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: string;
  /** Shown only in compare mode */
  comparison?: {
    previousValue: string | null;
    percent: number | null;
  };
}

export function KpiCard({ label, value, comparison }: KpiCardProps) {
  return (
    <div role="group" aria-label={label} className="rounded-xl bg-subtle px-3 py-3">
      <p className="text-sm text-ink/85">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-xl font-medium tracking-tight tabular-nums">{value}</span>
        {comparison && <ComparisonText {...comparison} />}
      </p>
    </div>
  );
}

function ComparisonText({ previousValue, percent }: NonNullable<KpiCardProps["comparison"]>) {
  if (previousValue === null) {
    return <span className="text-[13px] text-muted">no previous data</span>;
  }

  const tone = percent === null || percent === 0 ? "text-muted" : percent > 0 ? "text-up" : "text-down";
  return (
    <span className="text-[13px] text-ink/80 tabular-nums">
      vs {previousValue}{" "}
      <span className={`font-semibold ${tone}`}>({percent === null ? "n/a" : formatPercent(percent)})</span>
    </span>
  );
}
