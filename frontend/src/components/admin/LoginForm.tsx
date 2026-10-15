"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { Alert, Button, inputClass } from "./ui";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Is the API running?");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <input name="email" type="email" required autoComplete="username" autoFocus className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
