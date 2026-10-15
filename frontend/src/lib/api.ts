import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
  ) {
    // Prefer the first field message ("Title is required") over the generic "Request is invalid".
    super(body?.error.details?.[0]?.message ?? body?.error.message ?? `Request failed with status ${status}`);
  }

  /** Field-level validation messages keyed by path, e.g. { "days.0.covers": "Must be 0 or more" }. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.body?.error.details ?? []).map((d) => [d.path, d.message]));
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/** Login page URL that brings the admin back to the current page after signing in again. */
export function loginUrlForCurrentPage(): string {
  return `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

/** Browser-side call. Goes through the Next.js /api rewrite, so the session cookie is sent automatically. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  return parse<T>(res);
}

/** Server-side call (Server Components). Talks to the backend directly and forwards the session cookie. */
export async function serverFetch<T>(path: string, cookie?: string): Promise<T> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  const res = await fetch(`${apiUrl}${path}`, {
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });
  return parse<T>(res);
}
