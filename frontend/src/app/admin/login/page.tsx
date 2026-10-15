import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { serverFetch } from "@/lib/api";

export const metadata: Metadata = { title: "Sign in · Revenue Admin" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  // Only redirect back inside the admin area, never to an arbitrary URL.
  const redirectTo =
    typeof next === "string" && next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";

  // Already signed in (valid, non-revoked session): skip the form.
  const signedIn = await serverFetch("/api/auth/me", (await cookies()).toString()).then(
    () => true,
    () => false,
  );
  if (signedIn) redirect(redirectTo);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-[20px] border border-line bg-surface p-7">
        <h1 className="text-xl font-medium tracking-tight">Revenue Admin</h1>
        <p className="mt-1 text-sm text-muted">Sign in to manage the dashboard data.</p>
        <LoginForm redirectTo={redirectTo} />
      </div>
    </main>
  );
}
