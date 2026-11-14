export const malaysiaDay = (date = new Date()) =>
  date.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

export function validAmount(value: unknown, min = 0.01, max = 100000): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= min && value <= max && Number(value.toFixed(2)) === value;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validChildBirthday(value: unknown, today = malaysiaDay()): value is string {
  if (!validDate(value)) return false;
  const age = Number(today.slice(0, 4)) - Number(value.slice(0, 4)) -
    Number(today.slice(5) < value.slice(5));
  return age >= 6 && age <= 17;
}

export const validChildName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80 &&
  !/[\p{Cc}]/u.test(value);

export const validAvatar = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 80 &&
  !/[<>&/\p{Cc}]/u.test(value);

export const validDueDays = (value: unknown): value is number =>
  value === 7 || value === 14 || value === 30 || value === 60;

export const validSignature = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 250000 &&
  /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);

export const SADAQAH_CAUSES = ["Local Masjid", "Orphan Relief", "Clean Water Wells"] as const;

export const HIBAH_FREQUENCIES = ["daily", "weekly", "bi-weekly", "monthly", "quarterly", "annually"];
export function validHibahDate(value: unknown): value is string {
  return typeof value === "string" && validDate(value.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
