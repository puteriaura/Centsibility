// NYSE core session calendar, reviewed 2026-10-08.
// https://www.nyse.com/trade/hours-calendars
const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
  "2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19", "2028-07-04", "2028-09-04", "2028-11-23", "2028-12-25",
]);
const EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26", "2028-07-03", "2028-11-24"]);
export function marketSession(now = new Date()): "open" | "closed" | "unknown" {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value || "";
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  if (!["2026", "2027", "2028"].includes(part("year"))) return "unknown";
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  return ["Sat", "Sun"].includes(part("weekday")) || HOLIDAYS.has(day) || minute < 570 || minute >= (EARLY_CLOSE.has(day) ? 780 : 960) ? "closed" : "open";
}
