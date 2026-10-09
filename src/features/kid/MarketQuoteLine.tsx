import { marketPricePresentation } from "@/lib/market-presentation";

export function MarketQuoteLine({ state, price, lastClose, stale, updatedAt }: {
  state: "open" | "closed" | "unknown";
  price?: number | null;
  lastClose?: number | null;
  stale?: boolean;
  updatedAt?: string | null;
}) {
  const presentation = marketPricePresentation(state, price, lastClose);
  const time = updatedAt ? new Date(updatedAt) : null;
  const updated = presentation.price !== null && time && Number.isFinite(time.getTime()) ? time.toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase() : null;
  return <span>{presentation.price !== null ? <>US${presentation.price.toFixed(2)} · </> : null}{presentation.label}{stale && presentation.price !== null ? " · Saved data (stale)" : ""}{updated ? ` · updated ${updated}` : null}</span>;
}
