import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { adminFetch } from "@/lib/admin-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const {
    user: { email },
  } = await adminFetch<{ user: { email: string } }>("/api/auth/me");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="font-medium tracking-tight">Revenue Admin</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">{email}</span>
            <Link
              href="/"
              className="flex h-9 items-center gap-1.5 rounded-[10px] px-3 font-medium text-ink/75 hover:bg-subtle hover:text-ink"
            >
              Dashboard
              <ExternalLink size={14} aria-hidden />
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-6 sm:px-5 sm:py-8">{children}</main>
    </div>
  );
}
