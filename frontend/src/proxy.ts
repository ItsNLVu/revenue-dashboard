import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "rd_session";

/**
 * Fast redirect to the login page when there is no session cookie at all.
 * The token itself is verified by the admin layout (via /api/auth/me) and by the backend on every admin request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login" || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
