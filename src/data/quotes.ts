import { DAILY_LESSONS } from "@/content/lessons";

export type Quote = { text: string; source?: string };
export const QUOTES: readonly Quote[] = DAILY_LESSONS;

export function getDailyQuote(date: Date = new Date()): Quote {
  const start = Date.UTC(2026, 0, 1);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = Math.floor((today - start) / 86400000);
  const i = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[i];
}
