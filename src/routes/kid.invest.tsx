import { MarketQuoteLine } from "@/features/kid/MarketQuoteLine";
import { marketSession } from "../../supabase/functions/_shared/market-calendar";
import type { MarketUsage } from "../../supabase/functions/_shared/market-types";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import {
  edgeKidInvestOptions,
  edgeKidInvestPreview,
  edgeKidInvestList,
  edgeKidInvestOpen,
  edgeKidInvestClose,
  edgeKidMarketSymbols,
  edgeKidMarketQuotes,
  edgeKidMarketSymbol,
  edgeKidMarketOpen,
  edgeKidMarketSell,
  type InvestmentItem,
  type InvestmentOptionsResponse,
  type InvestmentPreviewResponse,
  type MarketSymbolItem,
  type MarketSymbolsResponse,
  type MarketSymbolDetailResponse,
} from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { AppIcon } from "@/components/ui/app-icon";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
} from "recharts";
import { formatRM } from "@/lib/format";
import { Money, useMoney } from "@/features/privacy";
import { usePenny } from "@/features/penny";
import { sfx } from "@/lib/sounds";
import { getBalanceSummary } from "@/lib/finance";
import { filterMarketSymbols, marketCatalogueNeedsUpdate } from "@/lib/market-search";
import { MarketPickerStatus } from "@/features/kid/MarketPickerStatus";
import { MarketCatalogueNotice } from "@/features/kid/MarketCatalogueNotice";

export const Route = createFileRoute("/kid/invest")({
  head: () => ({ meta: [{ title: "Investment | Centsibility" }] }),
  component: KidInvest,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(n: number | null) {
  if (n === null) return "Data unavailable";
  if (n < 0) {
    return `\u2212${Math.abs(n).toFixed(2)}%`;
  }
  return `+${n.toFixed(2)}%`;
}

function profitColor(n: number | null) {
  if (n === null) return "text-[var(--text-muted)]";
  return n > 0
    ? "text-[var(--success-text)]"
    : n < 0
      ? "text-[var(--ink)]"
      : "text-[var(--ink)]";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(iso?: string | null) {
  if (!iso) return "unavailable";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "unavailable";
  return d
    .toLocaleString("en-MY", {
      day: "numeric", month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}

function fmtRelative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins === 0) return "in less than a minute";
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(diff / 3600000);
  if (hrs < 24) return `in ${hrs} hr`;
  return `${Math.round(diff / 86400000)} days`;
}

const TIER_NAMES: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const FREQ_NAMES: Record<string, string> = {
  minute: "Every minute",
  day: "Daily",
  week: "Weekly",
};

const TIER_DESCS: Record<string, string> = {
  low: "Can move up to 0.5% each update",
  medium: "Can move up to 1% each update",
  high: "Can move up to 2% each update",
};

const FREQ_DESCS: Record<string, string> = {
  minute: "Updates every minute. Good for watching live.",
  day: "Updates once per day.",
  week: "Updates once per week.",
};

const LOCK_LABELS: Record<string, Record<number, string>> = {
  minute: { 5: "5 minutes", 10: "10 minutes", 30: "30 minutes", 60: "1 hour" },
  day: { 3: "3 days", 7: "1 week", 14: "2 weeks", 30: "1 month" },
  week: { 2: "2 weeks", 4: "4 weeks", 8: "8 weeks", 12: "3 months" },
};

const MARKET_LIMITS: Record<
  "6-9" | "10-12" | "13-17",
  { min: number; maxPer: number; maxTotal: number }
> = {
  "6-9": { min: 1, maxPer: 10, maxTotal: 20 },
  "10-12": { min: 1, maxPer: 20, maxTotal: 50 },
  "13-17": { min: 1, maxPer: 50, maxTotal: 150 },
};

// ── main component ────────────────────────────────────────────────────────────

function KidInvest() {
  const { data, loading, error, refresh } = useKidData();
  const { openPenny } = usePenny();
  const { format: formatMoney } = useMoney();

  const [investments, setInvestments] = useState<InvestmentItem[] | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [options, setOptions] = useState<InvestmentOptionsResponse | null>(
    null,
  );
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketData, setMarketData] = useState<MarketSymbolsResponse | null>(
    null,
  );
  const pickerListRef = useRef<HTMLDivElement>(null);
  const [visibleSymbols, setVisibleSymbols] = useState<string[]>([]);
  const [marketUsage, setMarketUsage] = useState<MarketUsage>();
  const [catalogueMarketState, setCatalogueMarketState] = useState(marketSession());
  const [quoteRows, setQuoteRows] = useState<Record<string, Partial<MarketSymbolItem>>>({});

  // Detail / Close modals
  const [selected, setSelected] = useState<InvestmentItem | null>(null);
  const [showClose, setShowClose] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  // Start modal states
  const [showStart, setShowStart] = useState(false);
  const [chosenMode, setChosenMode] = useState<"fund" | "market" | null>(null);
  const [hasSeenExplainer, setHasSeenExplainer] = useState(false);

  // Fund flow steps: 0=tier, 1=speed, 2=length, 3=amount, 4=confirm
  const [fundStep, setFundStep] = useState(0);
  const [tier, setTier] = useState("low");
  const [freq, setFreq] = useState("week");
  const [lockTicks, setLockTicks] = useState(4);
  const [fundAmount, setFundAmount] = useState(0);
  const [preview, setPreview] = useState<InvestmentPreviewResponse | null>(
    null,
  );
  const [previewBusy, setPreviewBusy] = useState(false);

  // Market flow steps: "explainer" | "picker" | "detail" | "confirm"
  const [marketStep, setMarketStep] = useState<
    "explainer" | "picker" | "detail" | "confirm"
  >("picker");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbolItem | null>(
    null,
  );
  const [symbolDetail, setSymbolDetail] =
    useState<MarketSymbolDetailResponse | null>(null);
  const [symbolDetailLoading, setSymbolDetailLoading] = useState(false);
  const [marketAmount, setMarketAmount] = useState(0);
  const [halalModalSymbol, setHalalModalSymbol] =
    useState<MarketSymbolItem | null>(null);

  const [openBusy, setOpenBusy] = useState(false);
  const clientRequestIdRef = useRef<string>("");

  const code = getKidSession()?.code;

  // ── fetch invest list ──────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    try {
      const res = await edgeKidInvestList({ code: code ?? undefined });
      setInvestments(res.investments);
    } catch {
      // silent — show stale
    } finally {
      setListLoading(false);
    }
  }, [code]);

  const fetchMarketSymbols = useCallback(async () => {
    try {
      const res = await edgeKidMarketSymbols({ code: code ?? undefined });
      setMarketData(res);
      setMarketError(null);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : "Market data unavailable. Try again.");
    }
  }, [code]);

  useEffect(() => {
    fetchList();
    fetchMarketSymbols();
    edgeKidInvestOptions({ code: code ?? undefined })
      .then(setOptions)
      .catch(() => {});
  }, [fetchList, fetchMarketSymbols, code]);

  // ── polling: 30s for minute funds, on-focus for others ────────────────────
  const hasMinuteFund = investments?.some(
    (inv) => inv.status === "active" && inv.frequency === "minute",
  );

  useEffect(() => {
    if (!hasMinuteFund) return;
    const id = setInterval(fetchList, 30000);
    return () => clearInterval(id);
  }, [hasMinuteFund, fetchList]);

  useEffect(() => {
    const onFocus = () => {
      fetchList();
      fetchMarketSymbols();
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => { if (!document.hidden) onFocus(); }, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [fetchList, fetchMarketSymbols]);

  // Curated symbols filtered
  const filteredSymbols = useMemo(() => {
    if (marketCatalogueNeedsUpdate(marketData?.symbols ?? [])) return [];
    return filterMarketSymbols((marketData?.symbols ?? []).filter(s => s.verified), searchQuery);
  }, [marketData, searchQuery]);

  useEffect(() => { pickerListRef.current?.scrollTo({ top: 0, behavior: "instant" }); }, [searchQuery]);

  useEffect(() => {
    const root = pickerListRef.current;
    setVisibleSymbols([]);
    if (!root || !showStart || chosenMode !== "market" || marketStep !== "picker") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const symbol = (entry.target as HTMLElement).dataset.marketSymbol!;
        if (entry.isIntersecting && entry.intersectionRatio > 0) visible.add(symbol);
        else visible.delete(symbol);
      }
      setVisibleSymbols([...visible].sort());
    }, { root, threshold: 0.01 });
    root.querySelectorAll("[data-market-symbol]").forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [filteredSymbols, showStart, chosenMode, marketStep, loading]);

  useEffect(() => {
    if (!visibleSymbols.length) return;
    let cancelled = false;
    let busy = false;
    const refreshQuotes = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const result = await edgeKidMarketQuotes({ code: code ?? undefined, symbols: visibleSymbols.slice(0, 12) });
        if (cancelled) return;
        setMarketUsage(result.usage);
        setCatalogueMarketState(result.marketState);
        setQuoteRows(previous => ({ ...previous, ...Object.fromEntries(Object.entries(result.quotes).map(([symbol, row]) => {
          const state = row.marketState ?? (result.marketState === "open" && row.quote ? row.quote.is_market_open ? "open" : "closed" : result.marketState);
          return [symbol, { price: row.available ? row.quote?.price ?? null : null, last_close: row.lastClose, last_close_as_of: row.lastCloseAsOf, degraded_reason: row.degradedReason, change_percent: row.quote?.change_percent ?? null, last_updated: row.quote?.price_time ?? row.quote?.fetched_at ?? null, stale: row.stale ?? false, is_market_open: state === "unknown" ? undefined : state === "open" }];
        })) }));
      } catch {
        if (!cancelled) setQuoteRows(previous => ({ ...previous, ...Object.fromEntries(visibleSymbols.map(symbol => [symbol, { ...previous[symbol], stale: true }])) }));
      } finally { busy = false; }
    };
    void refreshQuotes();
    const timer = window.setInterval(refreshQuotes, 60000);
    window.addEventListener("focus", refreshQuotes);
    document.addEventListener("visibilitychange", refreshQuotes);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", refreshQuotes); document.removeEventListener("visibilitychange", refreshQuotes); };
  }, [visibleSymbols, code]);

  // Last update time for curated list header
  const latestQuoteTime = useMemo(() => {
    const list = Object.values(quoteRows);
    for (const s of list) {
      if (s.last_updated) return fmtTime(s.last_updated);
    }
    return null;
  }, [quoteRows]);

  // ── load / error states ────────────────────────────────────────────────────
  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const k = data.kid;
  const summary = getBalanceSummary(k, data.goals, data.loans);
  const walletBalance = summary.spending;

  const activeInvs = investments?.filter((i) => i.status === "active") ?? [];
  const closedInvs = investments?.filter((i) => i.status === "closed") ?? [];

  const totalValue = activeInvs.some(i => i.currentValue === null) ? null : activeInvs.reduce((s, i) => s + (i.currentValue ?? 0), 0);

  // Market stats
  const activeMarketInvs = activeInvs.filter((i) => i.mode === "market");
  const selectedPrice = symbolDetail ? symbolDetail.available ? symbolDetail.quote?.price ?? null : null : selectedSymbol?.price ?? null;
  const selectedMarketState = symbolDetail?.marketState ?? (symbolDetail?.quote ? symbolDetail.quote.is_market_open ? "open" : "closed" : selectedSymbol?.is_market_open === undefined ? "unknown" : selectedSymbol.is_market_open ? "open" : "closed");
  const quotaDegraded = marketUsage?.quotaHit || Object.values(quoteRows).some(row => row.degraded_reason === "local_quota" || row.degraded_reason === "provider_quota");
  const totalMarketExposure = activeMarketInvs.reduce(
    (s, i) => s + i.principal,
    0,
  );
  const hasHadMarket = (investments || []).some((i) => i.mode === "market");

  const ageGroup = marketData?.ageGroup || "10-12";
  const marketLimits = MARKET_LIMITS[ageGroup] ?? MARKET_LIMITS["10-12"];
  const maxMarketAllowed = Math.max(
    0,
    Math.min(
      marketLimits.maxPer,
      marketLimits.maxTotal - totalMarketExposure,
      walletBalance,
    ),
  );

  // ── close investment (Fund or Market) ──────────────────────────────────────
  async function confirmClose() {
    if (!selected || !code) return;
    setCloseBusy(true);
    try {
      if (selected.mode === "market") {
        const res = await edgeKidMarketSell({
          code,
          investmentId: selected.id,
        });
        if (res.success) {
          toast.success(
            `${formatRM(res.payout)} returned to your wallet`, // privacy-ok: toast
          );
          sfx.coin();
        }
      } else {
        const res = await edgeKidInvestClose({
          code,
          investmentId: selected.id,
        });
        if (res.success) {
          toast.success(
            `${formatRM(res.payout)} returned to your wallet`, // privacy-ok: toast
          );
          sfx.coin();
        }
      }
      await fetchList();
      refresh();
      setShowClose(false);
      setSelected(null);
    } catch (e: unknown) {
      toast.error(
        e instanceof Error
          ? e.message
          : selected.mode === "market"
            ? "Could not sell investment"
            : "Could not close fund",
      );
    } finally {
      setCloseBusy(false);
    }
  }

  // ── open investment flows ──────────────────────────────────────────────────
  function resetStart() {
    setChosenMode(null);
    setFundStep(0);
    setTier("low");
    setFreq("week");
    setLockTicks(4);
    setFundAmount(0);
    setPreview(null);

    setMarketStep(!hasSeenExplainer ? "explainer" : "picker");
    setSearchQuery("");
    setSelectedSymbol(null);
    setSymbolDetail(null);
    setMarketAmount(0);

    clientRequestIdRef.current = crypto.randomUUID();
  }

  function openStart() {
    resetStart();
    setShowStart(true);
    sfx.tap();
  }

  // Fund flow handlers
  async function goToFundPreview(amt: number) {
    setFundAmount(amt);
    setPreviewBusy(true);
    try {
      const res = await edgeKidInvestPreview({
        code: code ?? undefined,
        tier,
        frequency: freq,
        lockTicks,
        amount: amt,
      });
      setPreview(res);
      setFundStep(4);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function confirmFundOpen() {
    if (!code || !fundAmount) return;
    setOpenBusy(true);
    try {
      await edgeKidInvestOpen({
        code,
        tier,
        frequency: freq,
        lockTicks,
        amount: fundAmount,
        clientRequestId: clientRequestIdRef.current,
      });
      toast.success(
        `Investment of ${formatRM(fundAmount)} started`, // privacy-ok: toast
      );
      sfx.coin();
      setShowStart(false);
      await fetchList();
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not open investment");
    } finally {
      setOpenBusy(false);
    }
  }

  // Market flow handlers
  async function pickMarketSymbol(sym: MarketSymbolItem) {
    setSelectedSymbol(sym);
    setSymbolDetail(null);
    setSymbolDetailLoading(true);
    setMarketStep("detail");
    try {
      const res = await edgeKidMarketSymbol({
        code: code ?? undefined,
        symbol: sym.symbol,
      });
      setSymbolDetail(res);
    } catch {
      toast.error("Could not load price chart");
    } finally {
      setSymbolDetailLoading(false);
    }
  }

  async function confirmMarketOpen() {
    if (!code || !selectedSymbol || !marketAmount || selectedPrice === null) return;
    setOpenBusy(true);
    try {
      await edgeKidMarketOpen({
        code,
        symbol: selectedSymbol.symbol,
        amount: marketAmount,
        clientRequestId: clientRequestIdRef.current,
      });
      toast.success(
        `Investment of ${formatRM(marketAmount)} started`, // privacy-ok: toast
      );
      sfx.coin();
      setShowStart(false);
      await fetchList();
      refresh();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Could not open market tracker",
      );
    } finally {
      setOpenBusy(false);
    }
  }

  // ── available lock ticks for current freq ─────────────────────────────────
  const lockOptions = Object.keys(LOCK_LABELS[freq] ?? { 4: "" }).map(Number);
  if (!lockOptions.includes(lockTicks)) setLockTicks(lockOptions[0] ?? 4);

  const tierKeys = options
    ? Object.keys(options.tiers)
    : ["low", "medium", "high"];
  const freqKeys = options
    ? Object.keys(options.frequencies)
    : ["minute", "day", "week"];
  const maxFundAmount = options?.frequencies[freq]?.max_amount ?? 1000;
  const minFundAmount = options?.frequencies[freq]?.min_amount ?? 1;

  const minFundStr = formatRM(minFundAmount /* privacy-ok: limit */);
  const maxVal = Math.min(maxFundAmount, walletBalance);
  const maxFundStr = formatRM(maxVal /* privacy-ok: limit */);
  const maxTot = marketLimits.maxTotal;
  const marketMaxTotalStr = formatRM(maxTot /* privacy-ok: limit */);
  const minLim = marketLimits.min;
  const marketMinStr = formatRM(minLim /* privacy-ok: limit */);
  const maxLim = maxMarketAllowed;
  const marketMaxStr = formatRM(maxLim /* privacy-ok: limit */);

  return (
    <div className="space-y-5 pb-12">
      {/* Hero: total value */}
      <section className="deposit-hero" aria-label="Investment summary">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Total investment value</p>
          <p className="deposit-hero__amount tabular-nums">
            <Money amount={totalValue} />
          </p>
          <p
            className="deposit-hero__link"
            style={{ cursor: "default", textDecoration: "none" }}
          >
            {activeInvs.length} active investment
            {activeInvs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="invest" size={32} color="#fff" />
        </div>
      </section>

      {/* Disclaimer */}
      <p className="m-0 flex items-start gap-2 text-sm leading-relaxed text-[var(--text-2)]">
        <AppIcon name="info" size={18} className="mt-0.5 shrink-0 text-[var(--action)]" />
        <span>
          <strong className="text-[var(--ink)]">Practice only.</strong> No real market, no real
          shares. Real share prices help you learn how investing works.
        </span>
      </p>

      {/* Start button */}
      <Button
        type="button"
        variant="primary"
        className="w-full justify-center"
        onClick={openStart}
      >
        <AppIcon name="plus" size={16} />
        Start an investment
      </Button>

      {/* Active investments */}
      {listLoading && !investments && (
        <div className="space-y-3">
          <Skeleton style={{ height: "8rem", borderRadius: "16px" }} />
          <Skeleton style={{ height: "8rem", borderRadius: "16px" }} />
        </div>
      )}

      {activeInvs.length > 0 && (
        <div className="space-y-3">
          <div className="section-tag">
            <span>ACTIVE INVESTMENTS</span>
          </div>
          {activeInvs.map((inv) =>
            inv.mode === "market" ? (
              <MarketCard
                key={inv.id}
                inv={inv}
                onClick={() => setSelected(inv)}
              />
            ) : (
              <FundCard
                key={inv.id}
                inv={inv}
                onClick={() => setSelected(inv)}
              />
            ),
          )}
        </div>
      )}

      {activeInvs.length === 0 && !listLoading && (
        <Card variant="soft" className="p-8 text-center space-y-2">
          <AppIcon name="invest" size={32} color="var(--text-muted)" />
          <p className="text-sm text-[var(--text-secondary)]">
            No active investments yet.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Tap "Start an investment" above.
          </p>
        </Card>
      )}

      {closedInvs.length > 0 && (
        <div className="space-y-3">
          <div className="section-tag">
            <span>PAST INVESTMENTS</span>
          </div>
          {closedInvs
            .slice(0, 5)
            .map((inv) =>
              inv.mode === "market" ? (
                <PastMarketCard key={inv.id} inv={inv} />
              ) : (
                <PastFundCard key={inv.id} inv={inv} />
              ),
            )}
        </div>
      )}

      {/* ── Detail sheet ───────────────────────────────────────────── */}
      <Modal
        isOpen={!!selected && !showClose}
        onClose={() => setSelected(null)}
        title={
          selected
            ? selected.mode === "market"
              ? `Market: ${selected.symbol}`
              : `${TIER_NAMES[selected.tier ?? "low"] ?? selected.tier} Fund`
            : ""
        }
      >
        {selected && (
          <div className="space-y-5 pb-2">
            {selected.mode === "market" ? (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="brand" className="text-[11px]">
                      Market Tracker
                    </Badge>
                    <Badge variant="default" className="text-[11px]">
                      {selected.symbol}
                    </Badge>
                  </div>
                  {selected.stale && <Badge variant="warning">Stale data</Badge>}
                  {selected.currentValue === null && <Badge variant="warning">Data unavailable</Badge>}
                  {selected.isMarketOpen === false && (
                    <Badge variant="warning" className="text-[11px]">
                      Market closed
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-[var(--text-muted)]">
                  {selected.isMarketOpen === false ? "Market closed · saved quote" : "Delayed price"} · updated {fmtTime(selected.lastUpdated)}
                </p>

                {/* Price chart */}
                {selected.chartPoints && selected.chartPoints.length > 1 && (
                  <div className="h-28 -mx-1 pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selected.chartPoints.map((p) => ({
                          name: p.day,
                          value: p.price,
                        }))}
                        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                      >
                        <XAxis dataKey="name" hide />
                        <YAxis domain={["auto", "auto"]} hide />
                        <Tooltip
                          formatter={(v: number) => [
                            `US$${v.toFixed(2)}`,
                            "Price",
                          ]}
                          contentStyle={{ fontSize: 11 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          fill="var(--primary-soft)"
                          fillOpacity={0.25}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <StatLine
                    label="Put in"
                    value={<Money amount={selected.principal} />}
                  />
                  <StatLine
                    label="Value now"
                    value={<Money amount={selected.currentValue} />}
                  />
                  <StatLine
                    label="Gain or loss"
                    value={
                      <span className={profitColor(selected.profitRm)}>
                        {selected.profitRm === null ? "" : selected.profitRm >= 0 ? "+" : "−"}
                        <Money amount={selected.profitRm === null ? null : Math.abs(selected.profitRm)} /> (
                        {pct(selected.profitPct)})
                      </span>
                    }
                  />
                  <StatLine
                    label="Entry price"
                    value={`US$${(selected.entryPrice ?? selected.entry_price ?? 0).toFixed(2)}`}
                  />
                  <StatLine
                    label="Current price"
                    value={`US$${(selected.currentPrice ?? 0).toFixed(2)}`}
                  />
                  <StatLine
                    label="Started"
                    value={fmtDate(selected.entryDate || selected.created_at)}
                  />
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1">
                  <p>
                    Prices are in US dollars. Your RM play money follows the
                    same percentage change.
                  </p>
                  <p className="text-[var(--text-muted)]">
                    The US market opens at night in Malaysia.
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => {
                      openPenny({
                        context: {
                          page: "invest",
                          detail: `Active Market Tracker ${selected.symbol}. Principal ${formatRM(selected.principal /* privacy-ok: penny */)}, current value ${formatRM(selected.currentValue /* privacy-ok: penny */)}, profit ${pct(selected.profitPct)}.`,
                        },
                        prompt: `I have an active Market Tracker investment in ${selected.symbol}. Principal is ${formatRM(selected.principal /* privacy-ok: penny */)} and it is now worth ${formatRM(selected.currentValue /* privacy-ok: penny */)}. What do you think?`,
                      });
                      setSelected(null);
                    }}
                  >
                    Ask Penny about this
                  </Button>

                  {selected.status === "active" && (
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center"
                      onClick={() => setShowClose(true)}
                    >
                      Sell
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <Badge variant="brand" className="text-[11px]">
                    Centsibility Fund
                  </Badge>
                  {selected.protected && (
                    <Badge variant="default" className="text-[11px]">
                      Protected
                    </Badge>
                  )}
                  <Badge variant="default" className="text-[11px]">
                    {FREQ_NAMES[selected.frequency ?? "week"] ??
                      selected.frequency}
                  </Badge>
                </div>

                {/* Growth chart */}
                {selected.path && selected.path.length > 1 && (
                  <div className="h-28 -mx-1 pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selected.path.map((p) => ({
                          name: `Upd ${p.tick}`,
                          value: p.value,
                        }))}
                        margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                      >
                        <XAxis dataKey="name" hide />
                        <YAxis domain={["auto", "auto"]} hide />
                        <Tooltip
                          formatter={(v: number) => [
                            formatMoney(v),
                            "Value",
                          ]}
                          contentStyle={{ fontSize: 11 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          fill="var(--primary-soft)"
                          fillOpacity={0.25}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <StatLine
                    label="Put in"
                    value={<Money amount={selected.principal} />}
                  />
                  <StatLine
                    label="Value now"
                    value={<Money amount={selected.currentValue} />}
                  />
                  <StatLine
                    label={(selected.profitRm ?? 0) < 0 ? "Loss" : "Profit"}
                    value={
                      <span className={profitColor(selected.profitRm)}>
                        {pct(selected.profitPct)}{" "}
                        <Money amount={selected.profitRm === null ? null : Math.abs(selected.profitRm)} />
                      </span>
                    }
                  />
                  <StatLine label="Ends" value={fmtDate(selected.endsAt)} />
                  {selected.nextUpdate && (
                    <StatLine
                      label="Next update"
                      value={fmtRelative(selected.nextUpdate)}
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => {
                      openPenny({
                        context: {
                          page: "invest",
                          detail: `Active ${TIER_NAMES[selected.tier ?? "low"]} fund. Principal ${formatRM(selected.principal /* privacy-ok: penny */)}, current value ${formatRM(selected.currentValue /* privacy-ok: penny */)}, profit ${pct(selected.profitPct)}.`,
                        },
                        prompt: `I have an active ${TIER_NAMES[selected.tier ?? "low"]} investment. Principal is ${formatRM(selected.principal /* privacy-ok: penny */)} and it is now worth ${formatRM(selected.currentValue /* privacy-ok: penny */)}. What do you think?`,
                      });
                      setSelected(null);
                    }}
                  >
                    Ask Penny about this
                  </Button>

                  {selected.status === "active" && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-center text-[var(--error-text)]"
                      onClick={() => setShowClose(true)}
                    >
                      Take out early
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Sell / Early close confirm ──────────────────────────────── */}
      <Modal
        isOpen={showClose && !!selected}
        onClose={() => setShowClose(false)}
        title={selected?.mode === "market" ? "Sell now?" : "Take out early?"}
      >
        {selected && (
          <div className="space-y-4 pb-2">
            {selected.mode === "market" ? (
              <>
                <p className="text-sm text-[var(--ink)] leading-relaxed">
                  Sell now for about{" "}
                  <strong>
                    <Money amount={selected.currentValue} />
                  </strong>{" "}
                  (price from {fmtTime(selected.lastUpdated)}).
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  The payout will be returned to your wallet immediately.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => setShowClose(false)}
                  >
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full justify-center"
                    disabled={closeBusy}
                    onClick={confirmClose}
                  >
                    {closeBusy ? "Selling..." : "Sell"}
                  </Button>
                </div>
              </>
            ) : selected.protected ? (
              <>
                <p className="text-sm text-[var(--ink)]">
                  You get back{" "}
                  <strong>
                    <Money amount={selected.principal} />
                  </strong>
                  . The profit so far,{" "}
                  <strong>
                    <Money amount={selected.profitRm === null ? null : Math.abs(selected.profitRm)} />
                  </strong>
                  , is lost.
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Only use this if you really need the money now.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => setShowClose(false)}
                  >
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full justify-center"
                    disabled={closeBusy}
                    onClick={confirmClose}
                  >
                    {closeBusy ? "Taking out..." : "Take out"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--ink)]">
                  You get back about{" "}
                  <strong>
                    <Money amount={selected.currentValue} />
                  </strong>
                  , the value now.
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  The payout will be returned to your wallet immediately.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => setShowClose(false)}
                  >
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full justify-center"
                    disabled={closeBusy}
                    onClick={confirmClose}
                  >
                    {closeBusy ? "Taking out..." : "Take out"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Halal screening info modal ──────────────────────────────── */}
      <Modal
        isOpen={!!halalModalSymbol}
        onClose={() => setHalalModalSymbol(null)}
        title="Halal screening"
      >
        {halalModalSymbol && (
          <div className="space-y-3 pb-2 text-sm text-[var(--ink)]">
            <p>The moon marks an investment with Shariah screening evidence. Screening checks businesses and finances against Islamic rules. It does not promise a profit, and status can change.</p>
            <div>
              <strong className="block text-base font-bold">
                {halalModalSymbol.symbol}
              </strong>
              <p className="text-xs text-[var(--text-secondary)]">
                {halalModalSymbol.name}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] space-y-1.5 text-xs">
              <div>
                <span className="text-[var(--text-muted)] block">
                  Screening standard
                </span>
                <span className="font-semibold text-[var(--ink)]">
                  {halalModalSymbol.halal_source}
                  {halalModalSymbol.halal_url && <a className="block underline" href={halalModalSymbol.halal_url} target="_blank" rel="noreferrer">Read the source</a>}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">
                  Last checked
                </span>
                <span className="font-semibold text-[var(--ink)]">
                  {halalModalSymbol.halal_checked_on}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center mt-2"
              onClick={() => setHalalModalSymbol(null)}
            >
              Close
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Start flow sheet ────────────────────────────────────────── */}
      <Modal
        isOpen={showStart}
        onClose={() => setShowStart(false)}
        title={
          chosenMode === null
            ? "Start an investment"
            : chosenMode === "fund"
              ? ([
                  "Choose a tier",
                  "Choose speed",
                  "Choose length",
                  "Choose amount",
                  "Confirm",
                ][fundStep] ?? "Centsibility Fund")
              : marketStep === "explainer"
                ? "Market Tracker"
                : marketStep === "picker"
                  ? "Pick a share or ETF"
                  : marketStep === "detail"
                    ? (selectedSymbol?.symbol ?? "Market Tracker")
                    : "Confirm"
        }
      >
        <div className="space-y-4 pb-2">
          {/* Step 0: Choose Mode */}
          {chosenMode === null && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-secondary)]">
                Choose how you want to practice investing:
              </p>

              {/* Fund Option */}
              <button
                type="button"
                className="w-full text-left p-3.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-soft)] transition-all min-h-[44px]"
                onClick={() => {
                  setChosenMode("fund");
                  setFundStep(0);
                  sfx.tap();
                }}
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm text-[var(--ink)]">
                    Centsibility Fund
                  </strong>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Centsibility Fund. Practice ups and downs with made-up prices.
                </p>
              </button>

              {/* Market Option */}
              {marketData?.enabled === false ? (
                <div className="w-full p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] opacity-80 space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-[var(--text-muted)]">
                      Market Tracker
                    </strong>
                    <Badge variant="default" className="text-[11px]">
                      Locked
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Market Tracker. Follows a real share price. It can go down.
                  </p>
                  <p className="text-xs font-semibold text-[var(--primary)] pt-1">
                    Ask your parent to switch on Market Tracker. They can do it on your card in the parent app.
                  </p>
                </div>
              ) : marketData === null || marketData.symbols.length === 0 ? (
                <div className="w-full p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] opacity-80 space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-[var(--text-muted)]">
                      Market Tracker
                    </strong>
                    <Badge variant="default" className="text-[11px]">
                      Locked
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Market Tracker. Follows a real share price. It can go down.
                  </p>
                  <p className="text-xs font-semibold text-[var(--primary)] pt-1">
                    Ask your parent to switch on Market Tracker. They can do it on your card in the parent app.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full text-left p-3.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-soft)] transition-all min-h-[44px]"
                  onClick={() => {
                    setChosenMode("market");
                    if (!hasSeenExplainer) {
                      setMarketStep("explainer");
                    } else {
                      setMarketStep("picker");
                    }
                    sfx.tap();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-[var(--ink)]">
                      Market Tracker
                    </strong>
                    <Badge variant="default" className="text-[11px]">
                      Real prices
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Market Tracker. Follows a real share price. It can go down.
                  </p>
                </button>
              )}
            </div>
          )}

          {/* ── Centsibility Fund Flow ──────────────────────────────── */}
          {chosenMode === "fund" && (
            <>
              {fundStep === 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Like a real market, nobody knows which way it goes. You can
                    lose some of what you put in.
                  </p>
                  {tierKeys.map((t) => {
                    const tierCards: Record<string, string> = {
                      low: "Low: moves up to 0.5% each update",
                      medium: "Medium: up to 1%",
                      high: "High: up to 2%",
                    };
                    return (
                      <button
                        key={t}
                        type="button"
                        className={tier === t ? "w-full text-left p-3.5 rounded-xl border transition-all min-h-[44px] border-[var(--primary)] bg-[var(--surface-pink)]" : "w-full text-left p-3.5 rounded-xl border transition-all min-h-[44px] border-[var(--border)] hover:bg-[var(--surface-soft)]"}
                        onClick={() => {
                          setTier(t);
                          sfx.tap();
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-sm text-[var(--ink)]">
                            {tierCards[t] ?? TIER_NAMES[t] ?? t}
                          </strong>
                        </div>
                      </button>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => setChosenMode(null)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center"
                      onClick={() => {
                        setFundStep(1);
                        sfx.tap();
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {fundStep === 1 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-secondary)]">
                    How often do you want your fund to update?
                  </p>
                  {freqKeys.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={freq === f ? "w-full text-left p-3.5 rounded-xl border transition-all min-h-[44px] border-[var(--primary)] bg-[var(--surface-pink)]" : "w-full text-left p-3.5 rounded-xl border transition-all min-h-[44px] border-[var(--border)] hover:bg-[var(--surface-soft)]"}
                      onClick={() => {
                        setFreq(f);
                        sfx.tap();
                      }}
                    >
                      <strong className="text-sm text-[var(--ink)]">
                        {FREQ_NAMES[f] ?? f}
                      </strong>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {FREQ_DESCS[f] ?? ""}
                      </p>
                    </button>
                  ))}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => setFundStep(0)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center"
                      onClick={() => {
                        setFundStep(2);
                        sfx.tap();
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {fundStep === 2 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-secondary)]">
                    How long should the fund run?
                  </p>
                  {lockOptions.map((lt) => (
                    <button
                      key={lt}
                      type="button"
                      className={lockTicks === lt ? "w-full text-left p-3.5 rounded-xl border transition-all min-h-[44px] border-[var(--primary)] bg-[var(--surface-pink)]" : "w-full text-left p-3.5 rounded-xl border transition-all min-h-[44px] border-[var(--border)] hover:bg-[var(--surface-soft)]"}
                      onClick={() => {
                        setLockTicks(lt);
                        sfx.tap();
                      }}
                    >
                      <strong className="text-sm text-[var(--ink)]">
                        {LOCK_LABELS[freq]?.[lt] ?? `${lt} updates`}
                      </strong>
                    </button>
                  ))}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => setFundStep(1)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center"
                      onClick={() => {
                        setFundStep(3);
                        sfx.tap();
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {fundStep === 3 && (
                <div className="space-y-3 max-h-[calc(100dvh-12rem)] overflow-y-auto pr-1 pb-[calc(5rem+env(safe-area-inset-bottom,16px))]">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Min <strong>{minFundStr}</strong> · Max{" "}
                    <strong>{maxFundStr}</strong> · Wallet{" "}
                    <strong>
                      <Money amount={walletBalance} />
                    </strong>
                  </p>
                  <MoneyKeypad
                    min={minFundAmount}
                    max={Math.min(maxFundAmount, walletBalance)}
                    busy={previewBusy}
                    confirmLabel="Preview"
                    onConfirm={(amt) => goToFundPreview(amt)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-center text-xs"
                    onClick={() => setFundStep(2)}
                  >
                    Back
                  </Button>
                </div>
              )}

              {fundStep === 4 && preview && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] space-y-1">
                    <p className="text-sm text-[var(--ink)]">
                      The value can go up or down. Higher risk means bigger moves.
                    </p>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <strong>
                        <Money amount={fundAmount} />
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Tier</span>
                      <strong>{TIER_NAMES[tier] ?? tier}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Speed</span>
                      <strong>{FREQ_NAMES[freq] ?? freq}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Length</span>
                      <strong>
                        {LOCK_LABELS[freq]?.[lockTicks] ??
                          `${lockTicks} updates`}
                      </strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => setFundStep(3)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center"
                      disabled={openBusy}
                      onClick={confirmFundOpen}
                    >
                      {openBusy ? "Starting..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Market Tracker Flow ─────────────────────────────────── */}
          {chosenMode === "market" && (
            <>
              {/* Explainer Step */}
              {marketStep === "explainer" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] space-y-2">
                    <strong className="text-sm text-[var(--ink)] block">
                      How Market Tracker works
                    </strong>
                    <p className="text-xs text-[var(--ink)] leading-relaxed">
                      {ageGroup === "6-9"
                        ? "Prices go up and down every day. Your play money can go down too."
                        : ageGroup === "10-12"
                          ? "Share prices change every day. Your play money can go down, even below what you put in. What happened before doesn't tell us what happens next."
                          : "This follows a real market price. Your play money can fall below what you put in. Past results don't predict the future. This is practice, not advice."}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => setChosenMode(null)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center"
                      onClick={() => {
                        setHasSeenExplainer(true);
                        setMarketStep("picker");
                        sfx.tap();
                      }}
                    >
                      I understand
                    </Button>
                  </div>
                </div>
              )}

              {/* Picker Step */}
              {marketStep === "picker" && (
                <div className="market-picker">
                  <div className="shrink-0 space-y-2 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                      <span>Search our selected stocks and ETFs</span>
                      <MarketPickerStatus state={catalogueMarketState} updatedAt={latestQuoteTime} />
                    </div>

                    {(quotaDegraded || marketUsage?.monitoringAvailable === false) && <p role="status" className="text-xs text-[var(--text-muted)]">{quotaDegraded ? "Quote limit reached. Showing saved prices; affected rows are marked stale. Missing data stays unavailable." : "Quote monitoring unavailable. Refreshes needing a new quote are paused; affected saved prices are marked stale."}</p>}

                    {/* Search box */}
                    <div className="bg-[var(--surface)]">
                      <input
                        type="text"
                        placeholder="Search symbols or names..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>

                  {/* Symbol List */}
                  <div ref={pickerListRef} className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                    {marketError && filteredSymbols.length > 0 && <p role="alert" className="text-xs text-[var(--error-text)]">Catalogue failed to load. Please retry. <button type="button" onClick={fetchMarketSymbols}>Retry</button></p>}
                    {filteredSymbols.map((item) => { const s = { ...item, ...quoteRows[item.symbol] }; return (
                      <div
                        key={s.symbol}
                        data-market-symbol={s.symbol}
                        className="w-full p-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-soft)] transition-all grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-2"
                      >
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => pickMarketSymbol(s)}
                        >
                          <div className="flex flex-col items-start">
                            <strong className="text-sm text-[var(--ink)]">
                              {s.symbol}
                            </strong>
                            {s.is_market_open === false && (
                              <Badge variant="warning" className="mt-0.5 h-5 px-1.5 text-[11px]">
                                Closed
                              </Badge>
                            )}
                          </div>
                        </button>

                        <button
                          type="button"
                          className="text-left min-w-0"
                          onClick={() => pickMarketSymbol(s)}
                        >
                          <span
                            className="block text-sm text-[var(--text-secondary)]"
                            aria-hidden="true"
                          >
                            {s.name}
                          </span>
                          <span className="sr-only">{s.name}</span>
                        </button>

                        <button
                          type="button"
                          className="inline-flex min-h-11 min-w-11 shrink-0 justify-center items-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHalalModalSymbol(s);
                          }}
                        >
                          <Badge
                            variant="brand"
                            className="text-[11px] cursor-pointer hover:opacity-80 inline-flex items-center gap-1"
                            aria-label="Shariah screened"
                          >
                            <AppIcon name="moon" size={11} aria-hidden="true" />
                            <AppIcon name="info" size={11} aria-hidden="true" />
                            <span className="sr-only">Screening information</span>
                          </Badge>
                        </button>

                        <div className="col-span-3 flex flex-wrap justify-between gap-2 text-xs">
                          <MarketQuoteLine state={s.is_market_open === undefined ? "unknown" : s.is_market_open ? "open" : "closed"} price={s.price} lastClose={s.last_close} stale={s.stale} />
                          {s.change_percent != null && s.price != null && s.is_market_open !== false ? (
                            <span
                              className={s.change_percent >= 0 ? "text-xs font-semibold tabular-nums text-[var(--success-text)]" : "text-xs font-semibold tabular-nums text-[var(--error-text)]"}
                            >
                              {pct(s.change_percent)}
                            </span>
                          ) : null
                          }
                        </div>
                      </div>
                    ); })}
                    {filteredSymbols.length === 0 && (
                      <MarketCatalogueNotice symbols={marketData?.symbols} failed={Boolean(marketError)} query={searchQuery} onRetry={fetchMarketSymbols} />
                    )}
                  </div>

                  <div className="shrink-0 pt-3 pb-[env(safe-area-inset-bottom,0px)]">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => setChosenMode(null)}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* Detail & Keypad Step */}
              {marketStep === "detail" && selectedSymbol && (
                <div className="space-y-3 max-h-[calc(100dvh-12rem)] overflow-y-auto pr-1 pb-[calc(5rem+env(safe-area-inset-bottom,16px))]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-base font-bold text-[var(--ink)]">
                        {selectedSymbol.symbol}
                      </strong>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {selectedSymbol.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHalalModalSymbol(selectedSymbol)}
                    >
                      <Badge
                        variant="brand"
                        className="text-[11px] cursor-pointer hover:opacity-80 inline-flex items-center gap-1"
                        aria-label="Shariah screened"
                      >
                        <AppIcon name="moon" size={11} aria-hidden="true" />
                        <AppIcon name="info" size={11} aria-hidden="true" />
                        <span className="sr-only">Screening information</span>
                      </Badge>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <MarketQuoteLine state={selectedMarketState} price={selectedPrice} lastClose={symbolDetail ? symbolDetail.lastClose : selectedSymbol.last_close} stale={symbolDetail?.stale ?? selectedSymbol.stale} updatedAt={symbolDetail?.quote?.price_time ?? symbolDetail?.quote?.fetched_at ?? selectedSymbol.last_updated} />
                  </div>

                  {symbolDetail?.lastCloseAsOf && <p className="text-xs text-[var(--text-muted)]">Close known as of {fmtTime(symbolDetail.lastCloseAsOf)}. Entry uses the saved trading quote shown at confirmation.</p>}
                  {symbolDetail?.degradedReason && <p role="status" className="text-xs text-[var(--text-muted)]">Quote refresh unavailable ({symbolDetail.degradedReason === "monitor_unavailable" ? "monitoring unavailable" : "quote limit reached"}). Showing stale saved data where available.</p>}

                  {/* 90-day price chart */}
                  {symbolDetailLoading ? (
                    <Skeleton
                      style={{ height: "6rem", borderRadius: "12px" }}
                    />
                  ) : symbolDetail?.dailyCloses &&
                    symbolDetail.dailyCloses.length > 1 ? (
                    <div className="h-28 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={symbolDetail.dailyCloses}
                          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                        >
                          <XAxis dataKey="day" hide />
                          <YAxis domain={["auto", "auto"]} hide />
                          <Tooltip
                            formatter={(v: number) => [
                              `US$${v.toFixed(2)}`,
                              "Close",
                            ]}
                            contentStyle={{ fontSize: 11 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="close"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            fill="var(--primary-soft)"
                            fillOpacity={0.25}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}

                  <div className="p-2.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] space-y-0.5">
                    <p>
                      Prices are in US dollars. Your RM play money follows the
                      same percentage change.
                    </p>
                    <p className="text-[var(--text-muted)]">
                      The US market opens at night in Malaysia.
                    </p>
                  </div>

                  {selectedPrice === null || symbolDetailLoading ? (
                    <p role="status" className="text-xs text-[var(--text-muted)]">{symbolDetailLoading ? "Loading quote..." : selectedMarketState === "closed" ? "No saved price is available yet. A price is needed to start a position. Try this stock again shortly." : "No quote is available yet. Try again shortly; a quote is needed to start a position."}</p>
                  ) : activeMarketInvs.length >= 5 ? (
                    <div className="p-3 rounded-xl bg-[var(--accent-amber-soft)] border border-[var(--accent-amber)] text-xs text-[var(--ink)]">
                      You already have 5 open market investments (maximum). Sell
                      one before starting another.
                    </div>
                  ) : maxMarketAllowed <= 0 ? (
                    <div className="p-3 rounded-xl bg-[var(--accent-amber-soft)] border border-[var(--accent-amber)] text-xs text-[var(--ink)]">
                      You have reached your total market limit of{" "}
                      {marketMaxTotalStr}.
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Min <strong>{marketMinStr}</strong> · Max{" "}
                        <strong>{marketMaxStr}</strong> · Wallet{" "}
                        <strong>
                          <Money amount={walletBalance} />
                        </strong>
                      </p>
                      <MoneyKeypad
                        min={marketLimits.min}
                        max={maxMarketAllowed}
                        confirmLabel="Next"
                        onConfirm={(amt) => {
                          setMarketAmount(amt);
                          setMarketStep("confirm");
                        }}
                      />
                    </>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-center text-xs"
                    onClick={() => setMarketStep("picker")}
                  >
                    Back to symbol list
                  </Button>
                </div>
              )}

              {/* Confirm Step */}
              {marketStep === "confirm" && selectedSymbol && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] space-y-2">
                    <p className="text-sm text-[var(--ink)] leading-relaxed">
                      Practice investing{" "}
                      <strong>
                        <Money amount={marketAmount} />
                      </strong>{" "}
                      in <strong>{selectedSymbol.symbol}</strong> using the saved trading quote of{" "}
                      <strong>
                        {selectedPrice === null ? "Data unavailable" : `US$${selectedPrice.toFixed(2)}`}
                      </strong>
                      .
                    </p>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Your play money will follow real share prices. It can go
                      down.
                    </p>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                    <div className="flex justify-between">
                      <span>Symbol</span>
                      <strong>{selectedSymbol.symbol}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <strong>
                        <Money amount={marketAmount} />
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Status</span>
                      <strong>
                        {selectedMarketState === "closed" ? "Market closed" : selectedMarketState === "open" ? "Market open" : "Market status unavailable"}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center"
                      onClick={() => setMarketStep("detail")}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center"
                      disabled={openBusy || selectedPrice === null}
                      onClick={confirmMarketOpen}
                    >
                      {openBusy ? "Starting..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ── Fund card (active Centsibility Fund) ──────────────────────────────────────

export function FundCard({
  inv,
  onClick,
}: {
  inv: InvestmentItem;
  onClick: () => void;
}) {
  const isMinute = inv.frequency === "minute";
  return (
    <Card
      variant="default"
      className="p-4 rounded-2xl border border-[var(--border)] hover:border-[var(--primary)] cursor-pointer transition-all"
      onClick={() => {
        sfx.tap();
        onClick();
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="brand" className="text-[11px]">
            Centsibility Fund
          </Badge>
          {inv.protected && (
            <Badge variant="default" className="text-[11px]">
              Protected
            </Badge>
          )}
          <Badge variant="default" className="text-[11px]">
            {TIER_NAMES[inv.tier ?? "low"] ?? inv.tier}
          </Badge>
          <Badge variant="default" className="text-[11px]">
            {FREQ_NAMES[inv.frequency ?? "week"] ?? inv.frequency}
          </Badge>
        </div>
        <AppIcon
          name="chevron"
          size={16}
          className="text-[var(--text-muted)] shrink-0 mt-0.5"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[var(--text-muted)]">Put in</p>
          <p className="font-semibold tabular-nums text-[var(--ink)]">
            <Money amount={inv.principal} />
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Value now</p>
          <p className="font-semibold tabular-nums text-[var(--ink)]">
            <Money amount={inv.currentValue} />
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">
            {(inv.profitRm ?? 0) < 0 ? "Loss" : "Profit"}
          </p>
          <p
            className={inv.profitRm === null ? "font-semibold tabular-nums text-[var(--text-muted)]" : inv.profitRm >= 0 ? "font-semibold tabular-nums text-[var(--success-text)]" : "font-semibold tabular-nums text-[var(--error-text)]"}
          >
            {pct(inv.profitPct)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
        <span>Ends {fmtDate(inv.endsAt)}</span>
        {inv.nextUpdate && (
          <span>
            {isMinute ? "Next update " : "Next "}
            {fmtRelative(inv.nextUpdate)}
          </span>
        )}
      </div>
    </Card>
  );
}

// ── Market card (active Market Tracker) ──────────────────────────────────────

function MarketCard({
  inv,
  onClick,
}: {
  inv: InvestmentItem;
  onClick: () => void;
}) {
  return (
    <Card
      variant="default"
      className="p-4 rounded-2xl border border-[var(--border)] hover:border-[var(--primary)] cursor-pointer transition-all"
      onClick={() => {
        sfx.tap();
        onClick();
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="brand" className="text-[11px]">
            Market Tracker
          </Badge>
          <Badge variant="default" className="text-[11px]">
            {inv.symbol || "SPUS"}
          </Badge>
          {inv.stale && <Badge variant="warning">Stale data</Badge>}
          {inv.currentValue === null && <Badge variant="warning">Data unavailable</Badge>}
          {inv.isMarketOpen === false && (
            <Badge variant="warning" className="text-[11px]">
              Market closed
            </Badge>
          )}
        </div>
        <AppIcon
          name="chevron"
          size={16}
          className="text-[var(--text-muted)] shrink-0 mt-0.5"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[var(--text-muted)]">Put in</p>
          <p className="font-semibold tabular-nums text-[var(--ink)]">
            <Money amount={inv.principal} />
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Value now</p>
          <p className="font-semibold tabular-nums text-[var(--ink)]">
            <Money amount={inv.currentValue} />
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Gain or loss</p>
          <p
            className={inv.profitRm === null ? "font-semibold tabular-nums text-[var(--text-muted)]" : inv.profitRm >= 0 ? "font-semibold tabular-nums text-[var(--success-text)]" : "font-semibold tabular-nums text-[var(--error-text)]"}
          >
            {inv.profitRm === null ? "" : inv.profitRm >= 0 ? "+" : "−"}
            <Money amount={inv.profitRm === null ? null : Math.abs(inv.profitRm)} />
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
        <span>
          Entry US${(inv.entryPrice ?? inv.entry_price ?? 0).toFixed(2)} ·{" "}
          {fmtDate(inv.entryDate || inv.created_at)}
        </span>
        <span>Delayed · {fmtTime(inv.lastUpdated)}</span>
      </div>
    </Card>
  );
}

// ── Past fund card (Centsibility Fund) ────────────────────────────────────────

function PastFundCard({ inv }: { inv: InvestmentItem }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-xs">
      <div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-semibold text-[var(--ink)]">
            {TIER_NAMES[inv.tier ?? "low"] ?? inv.tier} Fund
          </p>
          {inv.protected && (
            <Badge variant="default" className="text-[11px] py-0 px-1.5">
              Protected
            </Badge>
          )}
        </div>
        <p className="text-[var(--text-muted)]">
          {inv.close_reason === "early" ? "Closed early" : "Matured"} ·{" "}
          {fmtDate(inv.closed_at ?? inv.endsAt)}
        </p>
      </div>
      <div className="text-right tabular-nums">
        <p className="font-bold text-[var(--ink)]">
          <Money amount={inv.payout ?? inv.principal} />
        </p>
        {inv.close_reason !== "early" && (
          <p className={profitColor(inv.profitRm)}>{pct(inv.profitPct)}</p>
        )}
      </div>
    </div>
  );
}

// ── Past market card (Market Tracker) ────────────────────────────────────────

function PastMarketCard({ inv }: { inv: InvestmentItem }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-xs">
      <div>
        <p className="font-semibold text-[var(--ink)]">
          Market: {inv.symbol || "Ticker"}
        </p>
        <p className="text-[var(--text-muted)]">
          Sold · {fmtDate(inv.closed_at ?? inv.created_at)}
        </p>
      </div>
      <div className="text-right tabular-nums">
        <p className="font-bold text-[var(--ink)]">
          <Money amount={inv.payout ?? inv.currentValue} />
        </p>
        <p className={profitColor(inv.profitRm)}>
          {inv.profitRm === null ? "" : inv.profitRm >= 0 ? "+" : "−"}
          <Money amount={inv.profitRm === null ? null : Math.abs(inv.profitRm)} /> ({pct(inv.profitPct)})
        </p>
      </div>
    </div>
  );
}

// ── small helper ──────────────────────────────────────────────────────────────

function StatLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)]">
        {label}
      </p>
      <div className="text-sm font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}
