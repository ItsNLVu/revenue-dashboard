// Load backend/.env when present (Node >= 20.12). Real environment variables win.
try {
  process.loadEnvFile();
} catch {
  // no .env file, rely on the environment
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name} (see backend/.env.example)`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  jwtTtlSeconds: 60 * 60 * 8,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  isProduction: process.env.NODE_ENV === "production",
};

export const AUTH_COOKIE = "rd_session";
