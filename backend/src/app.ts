import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "./config";
import { errorHandler, notFound } from "./middleware/error";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  // The dashboard must always show exactly what the admin saved, never a cached copy.
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
