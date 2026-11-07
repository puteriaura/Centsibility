/**
 * One money and one date format for the whole app.
 * Money reads "RM1,536.29" (negatives "−RM12.00"); dates read "5 Sep 2026".
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatRM(amount: number | null, options: { sign?: boolean } = {}): string {
  if (amount === null) return "Data unavailable";
  const value = Number.isFinite(amount) ? amount : 0;
  const digits = Math.abs(value).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? "−" : options.sign && value > 0 ? "+" : "";
  return `${sign}RM${digits}`;
}

export function formatDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getDate();
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(value?: string | number | Date | null): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(+date)) return "";
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${hours % 12 || 12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
}
