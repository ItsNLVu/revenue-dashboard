import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, serverFetch } from "./api";

/** Admin API call from a Server Component: forwards the session cookie and sends expired sessions to the login page. */
export async function adminFetch<T>(path: string): Promise<T> {
  const cookie = (await cookies()).toString();
  try {
    return await serverFetch<T>(path, cookie);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/admin/login");
    throw error;
  }
}
