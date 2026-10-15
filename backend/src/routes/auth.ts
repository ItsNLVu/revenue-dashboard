import { Router } from "express";
import bcrypt from "bcryptjs";
import { AUTH_COOKIE, config } from "../config";
import { prisma } from "../lib/prisma";
import { readSessionClaims, requireAuth, signSession } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { loginBody } from "../schemas";

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.isProduction,
  path: "/",
};

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");

  const token = signSession(user);
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: config.jwtTtlSeconds * 1000 });
  res.json({ user: { id: user.id, email: user.email } });
});

authRouter.post("/logout", async (req, res) => {
  // Invalidate the token server-side too, not just the cookie in this browser.
  const claims = readSessionClaims(req);
  if (claims) {
    await prisma.user.updateMany({
      where: { id: claims.userId, sessionVersion: claims.version },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  res.clearCookie(AUTH_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
