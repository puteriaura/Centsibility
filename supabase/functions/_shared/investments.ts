// supabase/functions/_shared/investments.ts
// Shared helper for calculating investment values and formatting investment lists

import { OpenInvestmentContext } from "./penny-ai.ts";
import { isQuoteStale } from "./market.ts";
import { marketSession } from "./market-calendar.ts";

export interface InvestmentValueResult {
  totalValue: number | null;
  investments: OpenInvestmentContext[];
}

export async function currentInvestmentValues(
  admin: any,
  kidId: string,
  now: Date = new Date()
): Promise<InvestmentValueResult> {
  const { data: invs } = await admin
    .from("investments")
    .select("*")
    .eq("kid_id", kidId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (!invs || invs.length === 0) {
    return { totalValue: 0, investments: [] };
  }

  const nowIso = now.toISOString();
  const contextList: OpenInvestmentContext[] = [];

  for (const rawInv of invs) {
    const inv = { ...rawInv };
    delete inv.seed; // NEVER expose seed

    if (inv.mode === "market") {
      const entryPrice = Number(inv.entry_price || 1);
      const { data: qRow } = await admin
        .from("market_quotes")
        .select("price, fetched_at, is_market_open")
        .eq("symbol", inv.symbol)
        .maybeSingle();

      const cachedPrice = qRow && qRow.price !== null && qRow.price !== undefined
        ? Number(qRow.price)
        : null;
      const principal = Number(inv.principal);
      // round(principal * cached price / entry_price, 2)
      const currentValue = cachedPrice !== null && cachedPrice > 0 && entryPrice > 0 ? Number((principal * (cachedPrice / entryPrice)).toFixed(2)) : null;
      const profitPct = currentValue === null ? null : Number((((currentValue - principal) / principal) * 100).toFixed(2));

      contextList.push({
        mode: "market",
        symbol: inv.symbol,
        principal,
        currentValue,
        profitPct,
        endsAt: inv.closed_at ?? undefined,
      });
    } else if (inv.mode === "fund") {
      const principal = Number(inv.principal);
      const intervalMs = inv.frequency === "minute"
        ? 60000
        : inv.frequency === "day"
        ? 86400000
        : inv.frequency === "quarter"
        ? 90 * 86400000
        : 7 * 86400000;
      const endsAt = inv.closed_at ?? new Date(new Date(inv.created_at).getTime() + Number(inv.lock_ticks || 0) * intervalMs).toISOString();

      let val = principal;
      const { data: pathRows } = await admin.rpc("investment_fund_path", {
        p_id: inv.id,
        p_at: nowIso,
      });

      if (pathRows && pathRows.length > 0) {
        val = Number(pathRows[pathRows.length - 1].value);
      }

      const currentValue = Number(val.toFixed(2));
      const profitPct = Number((((currentValue - principal) / principal) * 100).toFixed(2));

      contextList.push({
        mode: "fund",
        tier: inv.tier,
        principal,
        currentValue,
        profitPct,
        endsAt,
      });
    }
  }

  const totalValue = contextList.some(item => item.currentValue === null) ? null : Number(contextList.reduce((sum, item) => sum + (item.currentValue ?? 0), 0).toFixed(2));
  return { totalValue, investments: contextList };
}

export async function formatInvestmentList(
  admin: any,
  invs: any[],
  now: Date = new Date()
): Promise<any[]> {
  const nowIso = now.toISOString();

  return Promise.all(
    (invs || []).map(async (rawInv: any) => {
      const inv = { ...rawInv };
      delete inv.seed; // NEVER return seed
      // Before the stored-terms migration, every Fund has the original principal
      // floor and returns principal on early closure. This is response metadata
      // only; the existing database RPC still determines every payout.
      if (inv.mode === "fund" && inv.protected === undefined) inv.protected = true;

      if (inv.mode === "market") {
        const entryPrice = Number(inv.entry_price || 1);
        const entryDate = inv.entry_price_at || inv.created_at;
        const { data: qRow } = await admin
          .from("market_quotes")
          .select("*")
          .eq("symbol", inv.symbol)
          .maybeSingle();

        const currentPrice = qRow && qRow.price !== null && qRow.price !== undefined
          ? Number(qRow.price)
          : null;
        const currentValue = inv.status === "closed" && inv.payout !== null && inv.payout !== undefined
          ? Number(inv.payout)
          : currentPrice !== null && currentPrice > 0 && entryPrice > 0 ? Number((Number(inv.principal) * (currentPrice / entryPrice)).toFixed(2)) : null;
        const profitRm = currentValue === null ? null : Number((currentValue - Number(inv.principal)).toFixed(2));
        const profitPct = currentValue === null ? null : Number((((currentValue - Number(inv.principal)) / Number(inv.principal)) * 100).toFixed(2));

        const entryDay = (entryDate || nowIso).slice(0, 10);
        const { data: closes } = await admin
          .from("market_daily_closes")
          .select("day, close")
          .eq("symbol", inv.symbol)
          .gte("day", entryDay)
          .order("day", { ascending: true });

        const chartPoints: Array<{ day: string; price: number }> = (closes || []).map((c: any) => ({
          day: String(c.day),
          price: Number(c.close),
        }));

        const lastDay = (qRow?.fetched_at || nowIso).slice(0, 10);
        if (currentPrice && !chartPoints.some((p) => p.day === lastDay)) {
          chartPoints.push({ day: lastDay, price: currentPrice });
        }

        return {
          ...inv,
          currentValue,
          profitRm,
          profitPct,
          entryPrice,
          entryDate,
          currentPrice,
          lastUpdated: qRow?.price_time || qRow?.fetched_at || null,
          isMarketOpen: !qRow || marketSession(now) === "unknown" ? null
            : marketSession(now) === "closed" ? false : Boolean(qRow.is_market_open),
          stale: qRow ? isQuoteStale(qRow, now) : false,
          chartPoints,
          endsAt: inv.closed_at ?? null,
          nextUpdate: null,
          path: [],
        };
      }

      const intervalMs = inv.frequency === "minute" ? 60000 : inv.frequency === "day" ? 86400000 : inv.frequency === "quarter" ? 90 * 86400000 : 7 * 86400000;
      const endsAt = inv.closed_at ?? new Date(new Date(inv.created_at).getTime() + Number(inv.lock_ticks || 0) * intervalMs).toISOString();

      let ticks: Array<{ tick: number; tickAt: string; rate: number; value: number }> = [];
      if (inv.mode === "fund") {
        const { data: pathRows } = await admin.rpc("investment_fund_path", {
          p_id: inv.id,
          p_at: nowIso,
        });
        if (pathRows) {
          ticks = pathRows.map((r: any) => ({
            tick: r.tick,
            tickAt: r.tick_at,
            rate: Number(r.rate),
            value: Number(r.value),
          }));
        }
      }

      const fullPath = [
        { tick: 0, tickAt: inv.created_at, rate: 0, value: Number(inv.principal) },
        ...ticks,
      ];
      const currentValue = inv.status === "closed" && inv.payout !== null && inv.payout !== undefined
        ? Number(inv.payout)
        : fullPath[fullPath.length - 1].value;
      const profitRm = Number((currentValue - Number(inv.principal)).toFixed(2));
      const profitPct = Number((((currentValue - Number(inv.principal)) / Number(inv.principal)) * 100).toFixed(2));
      const nextTick = ticks.length + 1;
      const nextUpdate = (inv.status === "active" && nextTick <= Number(inv.lock_ticks || 0))
        ? new Date(new Date(inv.created_at).getTime() + nextTick * intervalMs).toISOString()
        : null;

      return {
        ...inv,
        currentValue,
        profitRm,
        profitPct,
        endsAt,
        nextUpdate,
        path: fullPath.slice(-15),
      };
    })
  );
}
