import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE, config } from "../config";
import { prisma } from "../lib/prisma";
import { HttpError } from "./error";

export interface SessionUser {
  id: number;
  email: string;
}

interface SessionClaims {
  userId: number;
  version: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function signSession(user: { id: number; email: string; sessionVersion: number }): string {
  return jwt.sign({ email: user.email, ver: user.sessionVersion }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtTtlSeconds,
    algorithm: "HS256",
  });
}

function readToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[AUTH_COOKIE];
  if (fromCookie) return fromCookie;
  // Bearer tokens are accepted too, which makes the API easy to try with curl.
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice("Bearer ".length);
  return undefined;
}

/** Signature and expiry check only (no database). Returns null for a missing or invalid token. */
export function readSessionClaims(req: Request): SessionClaims | null {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) return null;
    return { userId, version: Number(payload.ver ?? 0) };
  } catch {
    return null;
  }
}

/**
 * Guards every admin route on the server. The UI redirect alone is not protection.
 * The token must be valid AND still current: signing out bumps the user's session version,
 * so a copied token stops working immediately, as does a token of a deleted user.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const claims = readSessionClaims(req);
  if (!claims) return next(new HttpError(401, "UNAUTHENTICATED", "Please sign in"));

  const user = await prisma.user.findUnique({ where: { id: claims.userId } });
  if (!user || user.sessionVersion !== claims.version) {
    return next(new HttpError(401, "UNAUTHENTICATED", "Session expired, please sign in again"));
  }

  req.user = { id: user.id, email: user.email };
  next();
};
