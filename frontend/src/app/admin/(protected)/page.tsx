import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventsManager } from "@/components/admin/EventsManager";
import { WeekMetricsForm } from "@/components/admin/WeekMetricsForm";
import { adminFetch } from "@/lib/admin-server";
import { addDays, formatWeekRange, parseWeekParam } from "@/lib/format";
import type { AdminWeek, ImpactEvent } from "@/lib/types";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { week } = await searchParams;
  // Without a (valid) ?week the API picks the current week, so "today" is decided in one place: the backend.
  const requested = parseWeekParam(week);
  const metrics = await adminFetch<AdminWeek>(`/api/admin/metrics${requested ? `?weekStart=${requested}` : ""}`);
  const weekStart = metrics.weekStart;
  const { events } = await adminFetch<{ events: ImpactEvent[] }>(`/api/admin/events?weekStart=${weekStart}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium tracking-tight">Weekly data</h1>
          <p className="mt-1 text-sm text-muted">
            What you save here is exactly what the dashboard shows for this week.
          </p>
        </div>
        <nav className="flex items-center gap-1 rounded-[12px] border border-line bg-surface p-1" aria-label="Week">
          <WeekLink week={addDays(weekStart, -7)} label="Previous week">
            <ChevronLeft size={16} />
          </WeekLink>
          <p className="min-w-44 text-center text-sm font-medium tabular-nums">
            {formatWeekRange(metrics.weekStart, metrics.weekEnd)}
          </p>
          <WeekLink week={addDays(weekStart, 7)} label="Next week">
            <ChevronRight size={16} />
          </WeekLink>
        </nav>
      </div>

      {/* key: drop unsaved edits and reload the form when the week changes */}
      <WeekMetricsForm key={`metrics-${weekStart}`} week={metrics} />
      <EventsManager key={`events-${weekStart}`} weekStart={weekStart} days={metrics.days} events={events} />
    </div>
  );
}

function WeekLink({ week, label, children }: { week: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/admin?week=${week}`}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-ink/70 hover:bg-subtle hover:text-ink"
    >
      {children}
    </Link>
  );
}
