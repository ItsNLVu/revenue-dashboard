import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { RevenueTrendCard } from "@/components/revenue-trend/RevenueTrendCard";
import { serverFetch } from "@/lib/api";
import { addDays, formatWeekRange, parseWeekParam } from "@/lib/format";
import type { WeeklyDashboard } from "@/lib/types";

// Always render with fresh data: the page must show exactly what the admin saved.
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { week } = await searchParams;
  const weekParam = parseWeekParam(week);

  let data: WeeklyDashboard;
  try {
    data = await serverFetch<WeeklyDashboard>(`/api/dashboard/weekly${weekParam ? `?weekStart=${weekParam}` : ""}`);
  } catch (error) {
    console.error(error);
    return (
      <Shell>
        <div className="rounded-[20px] border border-line bg-surface p-10 text-center">
          <p className="font-medium">Could not load the dashboard.</p>
          <p className="mt-1 text-sm text-muted">Make sure the backend API is running (see README), then refresh.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <nav className="mb-4 flex items-center justify-between gap-3" aria-label="Week">
        <div className="flex items-center gap-1">
          <WeekLink week={addDays(data.weekStart, -7)} label="Previous week">
            <ChevronLeft size={16} />
          </WeekLink>
          <p className="min-w-44 text-center text-sm font-medium tabular-nums">
            {formatWeekRange(data.current.weekStart, data.current.weekEnd)}
          </p>
          <WeekLink week={addDays(data.weekStart, 7)} label="Next week">
            <ChevronRight size={16} />
          </WeekLink>
          {data.weekStart !== data.defaultWeekStart && (
            <Link href="/" className="ml-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              Latest
            </Link>
          )}
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-subtle"
        >
          <LayoutDashboard size={15} aria-hidden />
          Admin
        </Link>
      </nav>

      {/* key: reset toggles when switching weeks */}
      <RevenueTrendCard key={data.weekStart} data={data} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-5 sm:py-8">{children}</main>;
}

function WeekLink({ week, label, children }: { week: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/?week=${week}`}
      aria-label={label}
      className="grid size-8 place-items-center rounded-lg text-ink/70 hover:bg-surface hover:text-ink"
    >
      {children}
    </Link>
  );
}
