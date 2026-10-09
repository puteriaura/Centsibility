import { marketPricePresentation } from "@/lib/market-presentation";

export function MarketQuoteLine({ state, price, lastClose, stale }: {
  state: "open" | "closed" | "unknown";
  price?: number | null;
  lastClose?: number | null;
  stale?: boolean;
}) {
  const presentation = marketPricePresentation(state, price, lastClose);
  return <span>{presentation.price !== null ? <>US${presentation.price.toFixed(2)} · </> : null}{presentation.label}{stale && presentation.price !== null ? " · Saved data (stale)" : ""}</span>;
}
