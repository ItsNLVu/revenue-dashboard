/**
 * Seeds an admin account and 4 weeks of demo data ending with the current week, so the dashboard
 * has something to show right after installing. Safe to re-run: it rewrites only the seeded weeks.
 *
 * The current and previous week reproduce the numbers in the reference video:
 *   Total Revenue $15,974 vs $14,982 (+6.6%) · Average per Day $2,282 vs $2,140 · Covers 871 vs 820 (+6.2%)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, mondayOf, toDate, todayIso } from "../src/lib/week";

try {
  process.loadEnvFile();
} catch {
  // no .env file, rely on the environment
}

const prisma = new PrismaClient();

type Row = [pos: number, eatclub: number, labour: number, covers: number];

// Mon → Sun
const CURRENT_WEEK: Row[] = [
  [1720, 310, 600, 112],
  [1785, 325, 630, 118],
  [1800, 315, 880, 120],
  [1780, 290, 630, 117],
  [1725, 300, 570, 114],
  [2185, 720, 850, 152],
  [2265, 454, 1120, 138],
];

const PREVIOUS_WEEK: Row[] = [
  [1550, 290, 520, 104],
  [1820, 330, 650, 110],
  [1600, 290, 760, 108],
  [1560, 270, 550, 106],
  [1700, 290, 590, 112],
  [1950, 620, 790, 140],
  [2290, 422, 1130, 140],
];

/** Older weeks: the previous week scaled down a little, with a small day-to-day wobble. */
function olderWeek(factor: number, seed: number): Row[] {
  return PREVIOUS_WEEK.map(([pos, eatclub, labour, covers], i) => {
    const wobble = 1 + (((i + seed) * 37) % 9 - 4) / 100;
    return [
      Math.round(pos * factor * wobble),
      Math.round(eatclub * factor * wobble),
      Math.round(labour * factor),
      Math.round(covers * factor * wobble),
    ];
  });
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin12345";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({ where: { email }, create: { email, passwordHash }, update: { passwordHash } });

  const thisMonday = mondayOf(todayIso());
  const weeks: Array<[string, Row[]]> = [
    [addDays(thisMonday, -21), olderWeek(0.93, 3)],
    [addDays(thisMonday, -14), olderWeek(0.96, 1)],
    [addDays(thisMonday, -7), PREVIOUS_WEEK],
    [thisMonday, CURRENT_WEEK],
  ];

  const rangeStart = toDate(weeks[0][0]);
  const rangeEnd = toDate(addDays(thisMonday, 6));

  await prisma.$transaction([
    prisma.dailyMetric.deleteMany({ where: { date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.event.deleteMany({ where: { date: { gte: rangeStart, lte: rangeEnd } } }),
    prisma.dailyMetric.createMany({
      data: weeks.flatMap(([monday, rows]) =>
        rows.map(([posRevenue, eatclubRevenue, labourCost, covers], i) => ({
          date: toDate(addDays(monday, i)),
          posRevenue,
          eatclubRevenue,
          labourCost,
          covers,
        })),
      ),
    }),
    prisma.event.createMany({
      data: [
        {
          date: toDate(addDays(thisMonday, 4)),
          impact: "negative",
          title: "Heavy rain",
          description: "Storm warning from 5pm, walk-ins dropped during dinner service.",
        },
        {
          date: toDate(addDays(thisMonday, 5)),
          impact: "positive",
          title: "Street food festival",
          description: "Festival on the same street brought extra foot traffic and Eatclub orders.",
        },
        {
          date: toDate(addDays(thisMonday, -2)),
          impact: "positive",
          title: "Live music night",
          description: null,
        },
      ],
    }),
  ]);

  console.log(`Seeded admin ${email} and weeks ${weeks.map(([monday]) => monday).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
