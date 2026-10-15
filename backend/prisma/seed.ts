/**
 * `npm run db:seed`: admin account + 4 weeks of demo data (see src/lib/demo-data.ts).
 * Safe to re-run: only the 4 demo weeks are rewritten.
 */
import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/demo-data";

try {
  process.loadEnvFile();
} catch {
  // no .env file, rely on the environment
}

const prisma = new PrismaClient();

seedDemoData(prisma, {
  email: process.env.ADMIN_EMAIL ?? "admin@example.com",
  password: process.env.ADMIN_PASSWORD ?? "admin12345",
  mode: "seed",
})
  .then(({ email, weeks }) => console.log(`Seeded admin ${email} and weeks ${weeks.join(", ")}`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
