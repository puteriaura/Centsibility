import { formatDateTime } from "@/lib/format";
import { marketPricePresentation, quoteOlderThanTradingDay } from "@/lib/market-presentation";

export function MarketQuoteLine({ state, price, lastClose, stale, updatedAt }: {
  state: "open" | "closed" | "unknown";
  price?: number | null;
  lastClose?: number | null;
  stale?: boolean;
  updatedAt?: string | null;
}) {
  const presentation = marketPricePresentation(state, price, lastClose);
  const updated = presentation.price !== null ? formatDateTime(updatedAt) : "";
  const old = stale && presentation.price !== null && quoteOlderThanTradingDay(updatedAt);
  return <span className={old ? "text-[var(--warn)] font-semibold" : undefined}>{presentation.price !== null ? <>US${presentation.price.toFixed(2)} · </> : null}{presentation.label}{stale && presentation.price !== null ? " · Saved price" : ""}{updated ? ` · Price from ${updated}` : null}</span>;
}
