import { z } from "zod";
import { isMonday, isValidIsoDate, weekDates } from "./lib/week";

export const isoDate = z
  .string()
  .refine(isValidIsoDate, "Expected a date in YYYY-MM-DD format")
  .refine((value) => value >= "2000-01-01" && value <= "2099-12-31", "Date must be between 2000 and 2099");
export const weekStart = isoDate.refine(isMonday, "Week must start on a Monday");

const money = z
  .number()
  .min(0, "Must be 0 or more")
  .max(99_999_999.99, "Value is too large")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "At most 2 decimal places");

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Password is required"),
});

/** Without weekStart the current week is used. */
export const optionalWeekQuery = z.object({ weekStart: weekStart.optional() });

export const dayInput = z.object({
  date: isoDate,
  posRevenue: money,
  eatclubRevenue: money,
  labourCost: money,
  covers: z.number().int("Covers must be a whole number").min(0, "Must be 0 or more").max(1_000_000),
});

/**
 * Replaces the stored data of one week: the days sent are upserted and the days left out are cleared,
 * so the database always matches exactly what the admin sees in the form.
 */
export const saveWeekBody = z
  .object({
    weekStart,
    /** `version` returned when the week was loaded; enables the "changed by someone else" check. */
    baseVersion: z.string().max(64).optional(),
    days: z.array(dayInput).max(7),
  })
  .superRefine((body, ctx) => {
    const allowed = new Set(weekDates(body.weekStart));
    const seen = new Set<string>();
    body.days.forEach((day, i) => {
      if (!allowed.has(day.date)) {
        ctx.addIssue({ code: "custom", path: ["days", i, "date"], message: "Date is outside the selected week" });
      }
      if (seen.has(day.date)) {
        ctx.addIssue({ code: "custom", path: ["days", i, "date"], message: "Duplicate date" });
      }
      seen.add(day.date);
    });
  });

const eventFields = {
  date: isoDate,
  impact: z.enum(["positive", "negative"]),
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
};

export const createEventBody = z.object(eventFields);
export const updateEventBody = z
  .object(eventFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");

// Postgres INT range, so a huge id is a 400 instead of a database error.
export const idParam = z.object({ id: z.coerce.number().int().positive().max(2_147_483_647) });
