import { describe, expect, it } from "vitest";
import { addDays, isMonday, isValidIsoDate, mondayOf, todayIso, weekDates } from "./week";

describe("week helpers", () => {
  it("validates real calendar dates only", () => {
    expect(isValidIsoDate("2026-10-12")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-1-2")).toBe(false);
    expect(isValidIsoDate("not-a-date")).toBe(false);
  });

  it("finds the Monday of any day, including Sunday", () => {
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
    expect(mondayOf("2026-10-15")).toBe("2026-10-12");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-28", 6)).toBe("2027-01-03");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("lists the 7 dates of a week", () => {
    expect(weekDates("2026-10-12")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(isMonday("2026-10-12")).toBe(true);
    expect(isMonday("2026-10-13")).toBe(false);
  });

  it("uses local date parts for today", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30), undefined)).toBe("2026-01-05");
  });

  it("can follow a business timezone instead of the server's", () => {
    // 20:00 UTC on Sunday is already Monday morning in Vietnam (UTC+7)
    const sundayEveningUtc = new Date(Date.UTC(2026, 9, 18, 20, 0));
    expect(todayIso(sundayEveningUtc, "UTC")).toBe("2026-10-18");
    expect(todayIso(sundayEveningUtc, "Asia/Ho_Chi_Minh")).toBe("2026-10-19");
    expect(mondayOf(todayIso(sundayEveningUtc, "Asia/Ho_Chi_Minh"))).toBe("2026-10-19");
  });
});
