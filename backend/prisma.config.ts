import { defineConfig } from "prisma/config";

// With a config file Prisma no longer reads .env by itself, so load it here (real env vars win).
try {
  process.loadEnvFile();
} catch {
  // no .env file, rely on the environment
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
