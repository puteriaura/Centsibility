/**
 * One money and one date format for the whole app.
 * Money reads "RM1,536.29" (negatives "−RM12.00"); dates read "05 Sep 2026".
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatRM(amount: number, options: { sign?: boolean } = {}): string {
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
  const day = String(date.getDate()).padStart(2, "0");
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
