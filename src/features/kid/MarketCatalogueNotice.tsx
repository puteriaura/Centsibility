import { marketCatalogueMessage, marketCatalogueNeedsUpdate } from "@/lib/market-search";

export function MarketCatalogueNotice({ symbols, failed, query, onRetry }: {
  symbols?: Array<{ symbol?: string; verified?: unknown }>;
  failed: boolean;
  query: string;
  onRetry: () => void;
}) {
  const outdated = marketCatalogueNeedsUpdate(symbols ?? []);
  return <div role={outdated || failed ? "alert" : "status"} className="text-xs text-[var(--text-muted)] text-center py-4 space-y-2">
    <p>{marketCatalogueMessage(Boolean(symbols), failed, query, outdated)}</p>
    {(outdated || failed) && <button type="button" onClick={onRetry} className="min-h-11 px-4 font-semibold underline text-[var(--primary-text)]">Retry</button>}
  </div>;
}
