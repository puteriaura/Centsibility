import { marketSession } from "../../supabase/functions/_shared/market-calendar";

export function marketPricePresentation(
  state: "open" | "closed" | "unknown",
  quote?: number | null,
  lastClose?: number | null,
) {
  const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  if (state === "closed") {
    if (valid(lastClose))
      return { price: lastClose, label: "Market closed, showing last close" };
    return {
      price: valid(quote) ? quote : null,
      label: valid(quote)
        ? "Market closed · last close unavailable; showing last saved quote"
        : "Market closed · data unavailable",
    };
  }
  return {
    price: valid(quote) ? quote : null,
    label:
      state === "unknown"
        ? "Market status unavailable"
        : valid(quote)
          ? "Delayed price"
          : "Data unavailable",
  };
}

const tradingDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});

export function quoteOlderThanTradingDay(timestamp?: string | null, now = new Date()) {
  if (!timestamp) return false;
  const quote = new Date(timestamp);
  if (!Number.isFinite(+quote) || +quote >= +now) return false;
  const quoteDay = tradingDate.format(quote);
  const session = new Date(`${tradingDate.format(now)}T17:00:00Z`);
  let laterSessions = 0;
  for (let day = 0; day < 10 && tradingDate.format(session) > quoteDay; day++) {
    if (marketSession(session) === "open" && (+session <= +now || marketSession(now) === "open")) {
      if (++laterSessions === 2) return true;
    }
    session.setUTCDate(session.getUTCDate() - 1);
  }
  return false;
}
