import type { MarketUsage } from "../../supabase/functions/_shared/market-types";
import type { PennyIntent } from "../../supabase/functions/_shared/penny-intents";
// Typed helpers for invoking Supabase Edge Functions.
// These replace the old client-side "server function" calls
// for financial operations that must run server-side.

import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError, FunctionsFetchError } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  isParentBypassed,
  isKidBypassed,
  ADMIN_BYPASS,
} from "@/lib/admin-bypass";
import {
  DEMO_IDENTITY,
  DEMO_KID_STATE,
  DEMO_TRANSACTIONS,
  DEMO_KIDS,
} from "@/lib/demo-data";
import { sanitizeDisplayText } from "@/lib/labels";
import { getKidSession, clearKidSession } from "@/lib/kid-session";
import {
  SCREENING,
  VERIFIED_STOCK_ADDITIONS,
} from "../../supabase/functions/_shared/market-screening";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

export function getMockEdgeResponse<T>(
  functionName: string,
  body: Record<string, unknown>,
): T {
  if (!import.meta.env.DEV)
    throw new Error("Demo responses are unavailable in production");
  const action = String(body.action || "");
  switch (action) {
    case "get-profile":
      return { id: "demo-parent-id", email: DEMO_IDENTITY.parentEmail } as T;
    case "get-pin":
      return { hasPin: false } as T;
    case "verify-pin":
      return { valid: true } as T;
    case "pin-status":
      return { attemptsLeft: 5, lockedUntil: null } as T;
    case "set-pin":
    case "clear-pin":
    case "unlock":
      return { ok: true } as T;
    case "login":
      return {
        kidId: DEMO_IDENTITY.kidId,
        name: "Aiman",
        code: DEMO_IDENTITY.kidCode,
      } as T;
    case "get-state": {
      const investListRes = getMockEdgeResponse<{ investments: any[] }>(
        "kid-finance",
        { action: "invest-list" },
      );
      const activeSum = (investListRes.investments || [])
        .filter((i) => i.status === "active")
        .reduce((sum, i) => sum + (Number(i.currentValue) || 0), 0);
      const invVal = Number(activeSum.toFixed(2));
      return {
        ...DEMO_KID_STATE,
        kid: {
          ...DEMO_KID_STATE.kid,
          investmentsValue: invVal,
        },
        investmentsValue: invVal,
      } as T;
    }
    case "get-history":
      return { txs: DEMO_TRANSACTIONS } as T;
    case "claim-coins":
      return { claimed: 10 } as T;
    case "deposit":
      return { newBalance: 150 } as T;
    case "create-kid":
      return { kid: { id: "demo-kid-" + Date.now(), name: body.name } } as T;
    case "get-statement": {
      const kidId = String(body.kidId || "");
      const kid = DEMO_KIDS.find((k) => k.id === kidId);
      if (!kid) {
        throw new Error("Not found or not your child");
      }
      const from = String(body.from || "");
      const to = String(body.to || "");
      const startDate = new Date(`${from}T00:00:00+08:00`);
      const endDate = new Date(`${to}T23:59:59.999+08:00`);
      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      const txs = DEMO_TRANSACTIONS.filter((t) => {
        if (t.kid_id !== kid.id) return false;
        const txTime = new Date(t.created_at).getTime();
        return txTime >= startMs && txTime <= endMs;
      });
      return {
        kid: { id: kid.id, name: kid.name, balance: kid.balance },
        transactions: txs,
        period: { from, to },
      } as T;
    }
    case "get-scheduled-hibahs":
      return { scheduledHibahs: [] } as T;
    case "quest-board":
      return {
        ageGroup: "10-12",
        quests: [
          {
            id: "demo-quest-1",
            slug: "duit-poket-master",
            title: "Duit Poket Master",
            summary: "Learn how to split your daily pocket money wisely.",
            icon: "Coins",
            points: 400,
            position: 1,
            questionCount: 3,
            status: "done",
            completedAt: new Date().toISOString(),
            bestCorrect: 3,
          },
          {
            id: "demo-quest-2",
            slug: "smart-shopper",
            title: "Smart Shopper",
            summary:
              "Compare prices and spot real discounts at the kedai runcit.",
            icon: "ShoppingBag",
            points: 400,
            position: 2,
            questionCount: 3,
            status: "open",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-3",
            slug: "savings-streak",
            title: "Savings Streak",
            summary: "Discover how tiny daily savings add up to big rewards.",
            icon: "TrendingUp",
            points: 400,
            position: 3,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-4",
            slug: "scam-spotter",
            title: "Online Safety & Scams",
            summary: "Identify fake prize messages and suspicious links.",
            icon: "ShieldAlert",
            points: 400,
            position: 4,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-5",
            slug: "budget-boss",
            title: "Budget Boss",
            summary: "Make a weekly plan for canteen lunches and stationery.",
            icon: "Receipt",
            points: 400,
            position: 5,
            questionCount: 3,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-6",
            slug: "sadaqah-champion",
            title: "Sadaqah Champion",
            summary:
              "Understand the barakah and joy of giving to those in need.",
            icon: "Heart",
            points: 400,
            position: 6,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-7",
            slug: "bank-basics",
            title: "Bank & Digital Money",
            summary: "How DuitNow, cards, and bank accounts work.",
            icon: "CreditCard",
            points: 400,
            position: 7,
            questionCount: 3,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
          {
            id: "demo-quest-8",
            slug: "halal-wealth",
            title: "Halal Wealth Builder",
            summary: "Earning honestly and growing money the Shariah way.",
            icon: "Award",
            points: 400,
            position: 8,
            questionCount: 4,
            status: "locked",
            completedAt: null,
            bestCorrect: null,
          },
        ],
      } as T;
    case "quest-start":
      return {
        attemptId: "demo-attempt-" + Date.now(),
        quest: {
          title: "Smart Shopper",
          points: 400,
        },
        questions: [
          {
            id: "demo-q1",
            position: 1,
            prompt:
              "You have RM10 and want a drink (RM3) and a notebook (RM5). How much change will you get?",
            choices: ["RM1", "RM2", "RM3", "RM4"],
          },
          {
            id: "demo-q2",
            position: 2,
            prompt:
              "A shop offers 'Buy 2 Free 1' for pencils costing RM2 each. How much for 3 pencils?",
            choices: ["RM2", "RM4", "RM6", "RM5"],
          },
          {
            id: "demo-q3",
            position: 3,
            prompt:
              "What is the best way to avoid impulse buying at the school bookshop?",
            choices: [
              "Bring all your savings",
              "Make a shopping list first",
              "Buy whatever your friend buys",
              "Buy items on the front display",
            ],
          },
        ],
      } as T;
    case "quest-answer": {
      const isCorrect = body.selectedIndex === 1;
      return {
        correct: isCorrect,
        correctIndex: 1,
        explanation: isCorrect
          ? "Great job! Calculating before buying keeps your money safe."
          : "Not quite. Remember to add the costs first (RM3 + RM5 = RM8), then subtract from RM10.",
        done: body.questionId === "demo-q3",
        correctCount: isCorrect ? 3 : 2,
        total: 3,
        passed: isCorrect,
        pointsAwarded: isCorrect ? 400 : 0,
        firstCompletion: isCorrect,
      } as T;
    }
    case "loan-repay":
      return {
        ok: true,
        paid: Number(body.amount) || 0,
        fullyRepaid: false,
        trustDelta: 0,
      } as T;
    case "contribute-goal":
      return {
        ok: true,
        added: Number(body.amount) || 0,
        saved: Number(body.amount) || 0,
      } as T;
    case "create-goal":
      return { ok: true, goalId: "demo-goal-" + Date.now() } as T;
    case "update-goal":
      return { ok: true, saved: Number(body.target) || 0, refunded: 0 } as T;
    case "delete-goal":
      return { ok: true, refunded: 0 } as T;
    case "set-card-controls":
      return {
        card_frozen: body.frozen ?? false,
        card_daily_limit: body.dailyLimit ?? 50,
        card_online_enabled: body.onlineEnabled ?? true,
      } as T;
    case "set-kid-card-controls":
      return {
        card_frozen: body.frozen ?? false,
        card_daily_limit: body.dailyLimit ?? 50,
        card_online_enabled: body.onlineEnabled ?? true,
        card_controls_locked: body.locked ?? false,
      } as T;
    case "set-market-tracker":
      if (typeof body.enabled === "boolean") {
        setDemoMarketEnabled(body.enabled);
      }
      return { ok: true, kidId: body.kidId, enabled: body.enabled } as T;
    case "sadaqah":
      return {
        ok: true,
        balance: 137.5,
        coins_awarded: Math.floor((Number(body.amount) || 5) * 2),
        cause: (body.cause as string) || null,
      } as T;
    case "mark-notifications-read":
      return { ok: true } as T;
    case "penny-chat":
      if (functionName === "parent-finance") {
        return {
          reply:
            "Salam! As your family financial coach, I can help you guide your children on budgeting, savings, and Shariah values. What would you like to discuss today?",
          model: (body.model as string) || "deepseek-flash",
          thinking: body.thinking !== false,
          remaining: 49,
        } as T;
      }
      return {
        reply:
          "Salam! I am Penny, your Islamic finance companion. Always remember to save first, spend wisely, and give Sadaqah!",
        model: (body.model as string) || "deepseek-flash",
        thinking: body.thinking !== false,
        remaining: 29,
      } as T;
    case "transfer-recipients":
      return {
        siblings: [
          {
            id: "demo-kid-aisyah",
            name: "Aisyah",
            comfort_name: "Aisyah",
            avatar: null,
          },
          {
            id: "demo-kid-siddiq",
            name: "Siddiq",
            comfort_name: "Siddiq",
            avatar: null,
          },
        ],
        parent: { id: "demo-parent-id", name: "Ummi", avatar: null },
        balance: 142.5,
        dailyLimit: 50,
        usedToday: 0,
      } as T;
    case "transfer":
      if (
        body.pin &&
        ADMIN_BYPASS.kid.pin &&
        body.pin !== ADMIN_BYPASS.kid.pin
      ) {
        throw new Error("That PIN isn't right. 4 tries left.");
      }
      return {
        ok: true,
        approvalId: "demo-approval-" + Date.now(),
        balance: 137.5,
        status: (body.recipientKind === "parent"
          ? "completed"
          : "pending") as any,
      } as T;
    case "invest-options":
      return {
        tiers: {
          low: {
            name: "Low",
            min_rate: -0.005,
            max_rate: 0.005,
            label: "Low: moves up to 0.5% each update",
          },
          medium: {
            name: "Medium",
            min_rate: -0.01,
            max_rate: 0.01,
            label: "Medium: up to 1%",
          },
          high: {
            name: "High",
            min_rate: -0.02,
            max_rate: 0.02,
            label: "High: up to 2%",
          },
        },
        frequencies: {
          minute: {
            name: "Every minute",
            interval_seconds: 60,
            lengths: [5, 10, 15],
            min_amount: 1.0,
            max_amount: 10.0,
            max_open: 1,
            daily_limit: 3,
          },
          day: {
            name: "Daily",
            interval_seconds: 86400,
            lengths: [3, 7, 14],
            min_amount: 1.0,
            max_amount: 50.0,
            max_open: 5,
          },
          week: {
            name: "Weekly",
            interval_seconds: 604800,
            lengths: [2, 4, 8],
            min_amount: 1.0,
            max_amount: 50.0,
            max_open: 5,
          },
        },
        max_open_funds: 5,
      } as T;
    case "invest-preview": {
      const tier = String(body.tier || "low").toLowerCase();
      const lockTicks = Number(body.lockTicks || 5);
      const amount = Number(body.amount || 10);
      const rates: Record<string, [number, number]> = {
        low: [-0.005, 0.005],
        medium: [-0.01, 0.01],
        high: [-0.02, 0.02],
      };
      const [lo, hi] = rates[tier] || rates.low;
      const minVal = amount * Math.pow(1 + lo, lockTicks);
      const maxVal = amount * Math.pow(1 + hi, lockTicks);
      const freq = String(body.frequency || "minute");
      const intervalMs =
        freq === "minute" ? 60000 : freq === "day" ? 86400000 : 7 * 86400000;
      return {
        minValue: Number(minVal.toFixed(2)),
        maxValue: Number(maxVal.toFixed(2)),
        endsAt: new Date(Date.now() + lockTicks * intervalMs).toISOString(),
      } as T;
    }
    case "invest-list": {
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);
      const elapsed = (currentMinute % 7) + 2;
      const createdAtMs = (currentMinute - elapsed) * 60000;
      const principal = 10.0;

      let val = principal;
      const path = [
        {
          tick: 0,
          tickAt: new Date(createdAtMs).toISOString(),
          rate: 0,
          value: principal,
        },
      ];
      const sampleRates = [
        -0.004, -0.003, -0.002, -0.004, 0.001, -0.002, -0.003,
      ];
      for (let k = 1; k <= elapsed; k++) {
        const rate = sampleRates[(k - 1) % sampleRates.length];
        val = val * (1 + rate);
        path.push({
          tick: k,
          tickAt: new Date(createdAtMs + k * 60000).toISOString(),
          rate: Number(rate.toFixed(4)),
          value: Number(val.toFixed(2)),
        });
      }

      const curVal = path[path.length - 1].value;
      const profit = Number((curVal - principal).toFixed(2));
      const profitPct = Number(((profit / principal) * 100).toFixed(2));
      const endsAt = new Date(createdAtMs + 10 * 60000).toISOString();
      const nextUpdate = new Date(
        createdAtMs + (elapsed + 1) * 60000,
      ).toISOString();

      const activeFund = {
        id: "demo-fund-active-minute",
        kid_id: DEMO_IDENTITY.kidId,
        mode: "fund" as const,
        label: "Centsibility Fund (Low)",
        principal,
        status: "active" as const,
        tier: "low" as const,
        frequency: "minute" as const,
        lock_ticks: 10,
        protected: false,
        created_at: new Date(createdAtMs).toISOString(),
        closed_at: null,
        payout: null,
        close_reason: null,
        currentValue: curVal,
        profitRm: profit,
        profitPct,
        endsAt,
        nextUpdate,
        path,
      };

      const activeProtectedFund = {
        id: "demo-fund-active-protected",
        kid_id: DEMO_IDENTITY.kidId,
        mode: "fund" as const,
        label: "Moved from Growth Tabung",
        principal: 25.0,
        status: "active" as const,
        tier: "medium" as const,
        frequency: "week" as const,
        lock_ticks: 4,
        protected: true,
        created_at: new Date(now - 7 * 86400000).toISOString(),
        closed_at: null,
        payout: null,
        close_reason: null,
        currentValue: 25.5,
        profitRm: 0.5,
        profitPct: 2.0,
        endsAt: new Date(now + 21 * 86400000).toISOString(),
        nextUpdate: new Date(now + 7 * 86400000).toISOString(),
        path: [
          {
            tick: 0,
            tickAt: new Date(now - 7 * 86400000).toISOString(),
            rate: 0,
            value: 25.0,
          },
          {
            tick: 1,
            tickAt: new Date(now).toISOString(),
            rate: 0.02,
            value: 25.5,
          },
        ],
      };

      const pastFund = {
        id: "demo-fund-closed-weekly",
        kid_id: DEMO_IDENTITY.kidId,
        mode: "fund" as const,
        label: "Moved from Growth Tabung",
        principal: 20.0,
        status: "closed" as const,
        tier: "low" as const,
        frequency: "week" as const,
        lock_ticks: 4,
        protected: true,
        created_at: new Date(now - 30 * 86400000).toISOString(),
        closed_at: new Date(now - 2 * 86400000).toISOString(),
        payout: 20.65,
        close_reason: "matured" as const,
        currentValue: 20.65,
        profitRm: 0.65,
        profitPct: 3.25,
        endsAt: new Date(now - 2 * 86400000).toISOString(),
        nextUpdate: null,
        path: [
          {
            tick: 0,
            tickAt: new Date(now - 30 * 86400000).toISOString(),
            rate: 0,
            value: 20.0,
          },
          {
            tick: 1,
            tickAt: new Date(now - 23 * 86400000).toISOString(),
            rate: 0.008,
            value: 20.16,
          },
          {
            tick: 2,
            tickAt: new Date(now - 16 * 86400000).toISOString(),
            rate: 0.007,
            value: 20.3,
          },
          {
            tick: 3,
            tickAt: new Date(now - 9 * 86400000).toISOString(),
            rate: 0.009,
            value: 20.48,
          },
          {
            tick: 4,
            tickAt: new Date(now - 2 * 86400000).toISOString(),
            rate: 0.008,
            value: 20.65,
          },
        ],
      };

      const marketLoss = {
        id: "demo-market-loss",
        kid_id: DEMO_IDENTITY.kidId,
        mode: "market" as const,
        label: "Market: HLAL",
        principal: 20.0,
        status: "active" as const,
        symbol: "HLAL",
        entry_price: 45.0,
        entryPrice: 45.0,
        entryDate: new Date(now - 14 * 86400000).toISOString(),
        currentPrice: 42.5,
        currentValue: 18.89,
        profitRm: -1.11,
        profitPct: -5.56,
        created_at: new Date(now - 14 * 86400000).toISOString(),
        closed_at: null,
        payout: null,
        close_reason: null,
        endsAt: null,
        nextUpdate: null,
        path: [],
        lastUpdated: new Date().toISOString(),
        isMarketOpen: true,
        chartPoints: [
          {
            day: new Date(now - 14 * 86400000).toISOString().slice(0, 10),
            price: 45.0,
          },
          {
            day: new Date(now - 10 * 86400000).toISOString().slice(0, 10),
            price: 44.2,
          },
          {
            day: new Date(now - 7 * 86400000).toISOString().slice(0, 10),
            price: 43.8,
          },
          {
            day: new Date(now - 3 * 86400000).toISOString().slice(0, 10),
            price: 43.1,
          },
          { day: new Date().toISOString().slice(0, 10), price: 42.5 },
        ],
      };

      const marketClosed = {
        id: "demo-market-closed",
        kid_id: DEMO_IDENTITY.kidId,
        mode: "market" as const,
        label: "Market: SPUS",
        principal: 10.0,
        status: "active" as const,
        symbol: "SPUS",
        entry_price: 58.0,
        entryPrice: 58.0,
        entryDate: new Date(now - 21 * 86400000).toISOString(),
        currentPrice: 60.5,
        currentValue: 10.43,
        profitRm: 0.43,
        profitPct: 4.31,
        created_at: new Date(now - 21 * 86400000).toISOString(),
        closed_at: null,
        payout: null,
        close_reason: null,
        endsAt: null,
        nextUpdate: null,
        path: [],
        lastUpdated: new Date().toISOString(),
        isMarketOpen: false,
        chartPoints: [
          {
            day: new Date(now - 21 * 86400000).toISOString().slice(0, 10),
            price: 58.0,
          },
          {
            day: new Date(now - 14 * 86400000).toISOString().slice(0, 10),
            price: 58.8,
          },
          {
            day: new Date(now - 7 * 86400000).toISOString().slice(0, 10),
            price: 59.9,
          },
          { day: new Date().toISOString().slice(0, 10), price: 60.5 },
        ],
      };

      return {
        investments: [
          activeFund,
          activeProtectedFund,
          marketLoss,
          marketClosed,
          pastFund,
        ],
      } as T;
    }
    case "invest-open":
      return {
        id: "demo-fund-new-" + Date.now(),
        mode: "fund",
        label: `Centsibility Fund (${String(body.tier || "low").toUpperCase()})`,
        principal: Number(body.amount || 10),
        status: "active",
        tier: body.tier,
        frequency: body.frequency,
        lock_ticks: Number(body.lockTicks || 5),
        created_at: new Date().toISOString(),
      } as T;
    case "invest-close":
      return { success: true, payout: 10.0 } as T;
    case "market-symbols": {
      const isEnabled = getDemoMarketEnabled();
      // Default for 10-12 in demo is off unless enabled
      const effective = isEnabled !== null ? isEnabled : false;
      return {
        symbols: CURATED_MARKET_SYMBOLS.map(
          ({
            symbol,
            name,
            kind,
            active,
            halal_source,
            halal_checked_on,
            halal_url,
            verified,
          }) => ({
            symbol,
            name,
            kind,
            active,
            halal_source,
            halal_checked_on,
            halal_url,
            verified,
          }),
        ),
        enabled: effective,
        ageGroup: "10-12",
      } as T;
    }
    case "market-quotes": {
      const requested = Array.isArray(body.symbols) ? body.symbols : [];
      return {
        marketState: "closed",
        quotes: Object.fromEntries(
          requested.map((symbol) => {
            const row = CURATED_MARKET_SYMBOLS.find((s) => s.symbol === symbol);
            return [
              symbol,
              {
                available: row?.price != null,
                stale: true,
                marketState: "closed",
                quote:
                  row?.price != null
                    ? {
                        symbol,
                        price: row.price,
                        previous_close: row.previous_close,
                        change_percent: row.change_percent,
                        currency: "USD",
                        is_market_open: false,
                        price_time: row.last_updated,
                        fetched_at: row.last_updated,
                      }
                    : undefined,
              },
            ];
          }),
        ),
      } as T;
    }
    case "market-symbol": {
      const sym = String(body.symbol || "SPUS").toUpperCase();
      const found = CURATED_MARKET_SYMBOLS.find((s) => s.symbol === sym);
      if (!found || found.price == null)
        return {
          symbol: sym,
          available: false,
          marketState: "closed",
          dailyCloses: [],
        } as T;
      const basePrice = found.price;
      const closes: Array<{ day: string; close: number }> = [];
      for (let i = 90; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
          .toISOString()
          .slice(0, 10);
        const wave = Math.sin(i * 0.15) * 3;
        closes.push({ day: d, close: Number((basePrice + wave).toFixed(2)) });
      }
      return {
        symbol: sym,
        quote: {
          symbol: sym,
          price: found.price || 50,
          previous_close: found.previous_close || 49.5,
          currency: "USD",
          is_market_open: Boolean(found.is_market_open),
          price_time: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
          change_percent: found.change_percent,
        },
        available: true,
        stale: false,
        dailyCloses: closes,
      } as T;
    }
    case "market-open": {
      const sym = String(body.symbol || "SPUS").toUpperCase();
      const amt = Number(body.amount || 10);
      const found =
        CURATED_MARKET_SYMBOLS.find((s) => s.symbol === sym) ||
        CURATED_MARKET_SYMBOLS[0];
      return {
        id: "demo-market-new-" + Date.now(),
        kid_id: DEMO_IDENTITY.kidId,
        mode: "market",
        symbol: sym,
        label: `Market: ${sym}`,
        principal: amt,
        status: "active",
        entryPrice: found.price || 50,
        currentPrice: found.price || 50,
        currentValue: amt,
        profitRm: 0,
        profitPct: 0,
        created_at: new Date().toISOString(),
        isMarketOpen: Boolean(found.is_market_open),
        lastUpdated: new Date().toISOString(),
      } as T;
    }
    case "market-sell":
      return { success: true, payout: 18.89 } as T;
    case "update-kid": {
      if (body.market_tracker_enabled !== undefined) {
        setDemoMarketEnabled(
          body.market_tracker_enabled === null
            ? null
            : Boolean(body.market_tracker_enabled),
        );
      }
      return { ok: true } as T;
    }
    case "kid-investments": {
      const investListRes = getMockEdgeResponse<{ investments: any[] }>(
        "kid-finance",
        { action: "invest-list" },
      );
      const byKid: Record<string, any[]> = {
        [DEMO_IDENTITY.kidId]: investListRes.investments,
      };
      return { investmentsByKid: byKid, byKid } as T;
    }
    default:
      return { ok: true } as T;
  }
}

// ---------------------------------------------------------------------------
// Single invoke helper — works for both parent-finance and kid-finance.
//
// How auth works per function:
//
//  parent-finance  → verify_jwt = true  (default)
//    supabase.functions.invoke() automatically attaches the parent's live
//    session JWT. The gateway verifies it before the function runs.
//
//  kid-finance     → verify_jwt = false  (set in supabase/config.toml)
//    The gateway skips JWT verification entirely. supabase.functions.invoke()
//    still sends "Authorization: Bearer <anon-key>" which satisfies the
//    gateway's minimum header requirement. The function itself validates
//    kids via session_token / login_code in every handler.
//
// No second client, no manual headers, no complexity needed.
// ---------------------------------------------------------------------------
/**
 * Extract human-readable error message from an edge function invocation error.
 * For FunctionsHttpError, attempts to parse response body JSON and extract .error.
 * Falls back to error.message, then "Edge function call failed".
 */
export async function extractEdgeErrorMessage(error: unknown): Promise<string> {
  const friendlyUnknownAction =
    "This feature isn't available yet. The app is being updated. Please try again later.";

  if (error instanceof FunctionsHttpError && error.context) {
    try {
      const res =
        typeof error.context.clone === "function"
          ? error.context.clone()
          : error.context;
      const body = await res.json();
      if (
        body &&
        typeof body === "object" &&
        typeof (body as { error?: unknown }).error === "string"
      ) {
        const errorMsg = (body as { error: string }).error;
        if (errorMsg.startsWith("Unknown action:")) {
          return friendlyUnknownAction;
        }
        return sanitizeDisplayText(errorMsg);
      }
    } catch {
      // JSON parse failure must never throw out of the helper
    }
  }
  if (error instanceof Error && error.message) {
    if (error.message.startsWith("Unknown action:")) {
      return friendlyUnknownAction;
    }
    return sanitizeDisplayText(error.message);
  }
  if (typeof error === "string" && error.length > 0) {
    if (error.startsWith("Unknown action:")) {
      return friendlyUnknownAction;
    }
    return sanitizeDisplayText(error);
  }
  return "Edge function call failed";
}

const PIN_SESSION_KEY = "centsibility.parent.pinSession";

export interface ParentPinSession {
  token: string;
  expiresAt: string;
}

export function setParentPinSession(token: string, expiresAt: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(
    PIN_SESSION_KEY,
    JSON.stringify({ token, expiresAt }),
  );
}

export function getParentPinSession(): ParentPinSession | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  const raw = window.sessionStorage.getItem(PIN_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      clearParentPinSession();
      return null;
    }
    if (new Date(parsed.expiresAt) <= new Date()) {
      clearParentPinSession();
      return null;
    }
    return parsed;
  } catch {
    clearParentPinSession();
    return null;
  }
}

export function clearParentPinSession(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.removeItem(PIN_SESSION_KEY);
}

export function isAuthError(error: unknown, status?: number): boolean {
  const httpStatus =
    status ??
    (error instanceof FunctionsHttpError ? error.context?.status : undefined);
  return httpStatus === 401;
}

async function invoke<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  isRetry = false,
): Promise<T> {
  const requestBody = { ...body };
  if (functionName === "parent-finance" && !requestBody.pinSession) {
    const session = getParentPinSession();
    if (session?.token) requestBody.pinSession = session.token;
  }
  const signal = AbortSignal.timeout(
    body.action === "penny-chat" ? 45_000 : 15_000,
  );
  try {
    const { data, error, response } = await supabase.functions.invoke(
      functionName,
      {
        body: requestBody,
        signal,
      },
    );
    if (error || data?.error || data?.code === "session_invalid") {
      if (isParentBypassed() || isKidBypassed())
        return getMockEdgeResponse<T>(functionName, body);
      const status =
        response?.status ??
        (error instanceof FunctionsHttpError
          ? error.context?.status
          : undefined);
      let code = data?.code;
      if (error instanceof FunctionsHttpError) {
        try {
          code = (await error.context.clone().json())?.code;
        } catch {
          /* Non-JSON error response. */
        }
      }
      if (
        functionName === "kid-finance" &&
        (status === 401 || code === "session_invalid")
      ) {
        clearKidSession();
        if (typeof window !== "undefined")
          window.dispatchEvent(new CustomEvent("centsibility:kid-signed-out"));
        throw new Error("You were signed out. Please sign in again.");
      }
      if (error instanceof FunctionsFetchError) throw error;
      const message = error
        ? await extractEdgeErrorMessage(error)
        : typeof data.error === "string"
          ? data.error
          : "Edge function returned error";
      if (message === "PIN required") {
        clearParentPinSession();
        if (typeof window !== "undefined")
          window.dispatchEvent(new CustomEvent("centsibility:pin-required"));
        throw new Error(message);
      }
      if (functionName === "parent-finance" && isAuthError(error, status)) {
        if (!isRetry && typeof supabase.auth.refreshSession === "function") {
          let refreshed = false;
          try {
            const { data: refreshData, error: refreshError } =
              await supabase.auth.refreshSession();
            refreshed = !refreshError && !!refreshData?.session;
          } catch {
            /* Refresh failed; show the sign-in prompt below. */
          }
          if (refreshed) return invoke<T>(functionName, body, true);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("centsibility:auth-expired", {
              detail: { message: "Please sign in again" },
            }),
          );
          if (window.location?.pathname.startsWith("/parent"))
            window.location.href = "/login";
        }
        throw new Error("Please sign in again");
      }
      throw new Error(message);
    }
    return data as T;
  } catch (err) {
    if (isParentBypassed() || isKidBypassed())
      return getMockEdgeResponse<T>(functionName, body);
    if (signal.aborted)
      throw new Error("That took too long. Please try again.");
    if (err instanceof FunctionsFetchError || err instanceof TypeError) {
      throw new Error(
        "You seem to be offline. Check your connection and try again.",
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Parent Finance Edge Functions — gateway verifies parent's Supabase JWT
// ---------------------------------------------------------------------------

export async function edgeParentDeposit(params: {
  kidId: string;
  amount: number;
  label?: string;
  type: "DEPOSIT" | "WITHDRAWAL";
}) {
  return invoke<{ newBalance: number }>("parent-finance", {
    action: "deposit",
    ...params,
  });
}

export async function edgeParentGetStatement(params: {
  kidId: string;
  from: string;
  to: string;
}) {
  return invoke<{
    kid: { id: string; name: string; balance: number };
    transactions: TransactionRow[];
    period: { from: string; to: string };
  }>("parent-finance", { action: "get-statement", ...params });
}

export async function edgeParentGetProfile() {
  return invoke<{ id: string; email: string } | null>("parent-finance", {
    action: "get-profile",
  });
}

export async function edgeParentCreateKid(params: {
  name: string;
  username: string;
  birth_date?: string;
}) {
  return invoke<{ kid: any }>("parent-finance", {
    action: "create-kid",
    ...params,
  });
}

export async function edgeParentDeleteKid(params: { kidId: string }) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "delete-kid",
    ...params,
  });
}

export async function edgeParentUpdateKid(params: {
  kidId: string;
  name: string;
  username?: string;
  birth_date?: string;
  birth_year?: number;
  age_group_override?: string | null;
  market_tracker_enabled?: boolean | null;
}) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "update-kid",
    ...params,
  });
}

export async function edgeParentResetKidPin(params: { kidId: string }) {
  return invoke<{
    ok: boolean;
    kidId: string;
    name: string;
    loginCode: string;
  }>("parent-finance", { action: "reset-kid-pin", ...params });
}

export async function edgeParentApproveRequest(params: {
  approvalId: string;
  decision: "approve" | "decline";
}) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "approve-request",
    ...params,
  });
}

export async function edgeParentResolveReward(params: {
  rewardId: string;
  decision: "approve" | "decline";
}) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "resolve-reward",
    ...params,
  });
}

export async function edgeParentSetPin(params: {
  pin: string;
  currentPin?: string;
}) {
  const res = await invoke<{
    ok: boolean;
    pinSession?: string;
    pinSessionExpiresAt?: string;
  }>("parent-finance", { action: "set-pin", ...params });
  if (res.pinSession && res.pinSessionExpiresAt) {
    setParentPinSession(res.pinSession, res.pinSessionExpiresAt);
  }
  return res;
}

export async function edgeParentGetPin() {
  return invoke<{ hasPin: boolean }>("parent-finance", { action: "get-pin" });
}

export async function edgeParentVerifyPin(params: { pin: string }) {
  const res = await invoke<{
    valid: boolean;
    attemptsLeft?: number;
    pinSession?: string;
    pinSessionExpiresAt?: string;
  }>("parent-finance", { action: "verify-pin", ...params });
  if (res.valid && res.pinSession && res.pinSessionExpiresAt) {
    setParentPinSession(res.pinSession, res.pinSessionExpiresAt);
  }
  return res;
}

export async function edgeParentClearPin(params: { currentPin: string }) {
  const res = await invoke<{ ok: boolean }>("parent-finance", {
    action: "clear-pin",
    ...params,
  });
  clearParentPinSession();
  return res;
}

export async function edgeParentSetHibah(params: {
  kidId: string;
  rate: number;
}) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "set-hibah",
    ...params,
  });
}

export async function edgeParentMarkNotificationsRead() {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "mark-notifications-read",
  });
}

export async function edgeParentSetAvatar(params: {
  kidId: string;
  avatar: string;
}) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "set-avatar",
    ...params,
  });
}

export async function edgeParentSetSelfAvatar(params: { avatar: string }) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "set-self-avatar",
    ...params,
  });
}

export async function edgeParentGetSelfAvatar() {
  return invoke<{ avatar: string | null }>("parent-finance", {
    action: "get-self-avatar",
  });
}

export async function edgeParentCreateScheduledHibah(params: {
  kidId: string;
  amount: number;
  frequency: string;
  startDate: string;
  endDate?: string;
}) {
  return invoke<{ ok: boolean; hibah: any }>("parent-finance", {
    action: "create-scheduled-hibah",
    ...params,
  });
}

export async function edgeParentGetScheduledHibahs() {
  return invoke<{ scheduledHibahs: any[] }>("parent-finance", {
    action: "get-scheduled-hibahs",
  });
}

export async function edgeParentDeactivateScheduledHibah(params: {
  hibahId: string;
}) {
  return invoke<{ ok: boolean }>("parent-finance", {
    action: "deactivate-scheduled-hibah",
    ...params,
  });
}

export async function edgeParentSetKidCardControls(params: {
  kidId: string;
  frozen?: boolean;
  dailyLimit?: number;
  onlineEnabled?: boolean;
  locked?: boolean;
}) {
  return invoke<{
    card_frozen: boolean;
    card_daily_limit: number;
    card_online_enabled: boolean;
    card_controls_locked: boolean;
  }>("parent-finance", { action: "set-kid-card-controls", ...params });
}

export async function edgeParentSetMarketTracker(params: {
  kidId: string;
  enabled: boolean;
}) {
  return invoke<{ ok: boolean; kidId: string; enabled: boolean }>(
    "parent-finance",
    { action: "set-market-tracker", ...params },
  );
}

// ---------------------------------------------------------------------------
// Kid Finance Edge Functions — verify_jwt=false, anon key only
// ---------------------------------------------------------------------------

export async function edgeKidSadaqah(params: {
  code: string;
  amount: number;
  cause?: string;
}) {
  return invoke<{
    ok: boolean;
    balance?: number;
    coins_awarded?: number;
    cause?: string | null;
  }>("kid-finance", { action: "sadaqah", ...params });
}

export async function edgeKidMarkNotificationsRead(params: { code: string }) {
  return invoke<{ ok: boolean }>("kid-finance", {
    action: "mark-notifications-read",
    ...params,
  });
}

export async function edgeKidRepayLoan(params: {
  code: string;
  loanId: string;
  amount: number;
}) {
  return invoke<{
    ok: boolean;
    paid: number;
    fullyRepaid: boolean;
    trustDelta: number;
  }>("kid-finance", { action: "loan-repay", ...params });
}

export async function edgeKidContributeGoal(params: {
  code: string;
  goalId: string;
  amount: number;
}) {
  return invoke<{ ok: boolean; added: number; saved: number }>("kid-finance", {
    action: "contribute-goal",
    ...params,
  });
}

export async function edgeKidCreateGoal(params: {
  code: string;
  name: string;
  emoji?: string;
  target: number;
}) {
  return invoke<{ ok: boolean; goalId: string }>("kid-finance", {
    action: "create-goal",
    ...params,
  });
}

export async function edgeKidUpdateGoal(params: {
  code: string;
  goalId: string;
  name: string;
  emoji?: string;
  target: number;
}) {
  return invoke<{ ok: boolean; saved: number; refunded: number }>(
    "kid-finance",
    { action: "update-goal", ...params },
  );
}

export async function edgeKidDeleteGoal(params: {
  code: string;
  goalId: string;
}) {
  return invoke<{ ok: boolean; refunded: number }>("kid-finance", {
    action: "delete-goal",
    ...params,
  });
}

export async function edgeKidSetCardControls(params: {
  code: string;
  frozen?: boolean;
  dailyLimit?: number;
  onlineEnabled?: boolean;
}) {
  return invoke<{
    card_frozen: boolean;
    card_daily_limit: number;
    card_online_enabled: boolean;
  }>("kid-finance", { action: "set-card-controls", ...params });
}

export async function edgeKidLogin(params: { username: string; pin: string }) {
  return invoke<{ kidId: string; name: string; code: string }>("kid-finance", {
    action: "login",
    ...params,
  });
}

export async function edgeKidVerifyAccessCode(params: { loginCode: string }) {
  return invoke<{
    ok: boolean;
    kidId: string;
    username: string;
    name: string;
    needsBirthday?: boolean;
  }>("kid-finance", { action: "verify-access-code", ...params });
}

export async function edgeKidSetInitialPin(params: {
  loginCode: string;
  pin: string;
  comfortName?: string;
  birthDate?: string;
}) {
  return invoke<{ ok: boolean; kidId: string; name: string; code: string }>(
    "kid-finance",
    { action: "set-initial-pin", ...params },
  );
}

export async function edgeKidUnlock(params: { code: string; pin: string }) {
  return invoke<{ ok: boolean }>("kid-finance", {
    action: "unlock",
    ...params,
  });
}

export interface PinStatus {
  attemptsLeft: number;
  lockedUntil: string | null;
}
export async function edgePinStatus(mode: "kid" | "parent") {
  const result = await invoke<PinStatus>(
    mode === "kid" ? "kid-finance" : "parent-finance",
    {
      action: "pin-status",
      ...(mode === "kid" ? { code: getKidSession()?.code } : {}),
    },
  );
  if (
    !Number.isInteger(result.attemptsLeft) ||
    result.attemptsLeft < 0 ||
    result.attemptsLeft > 5
  )
    throw new Error("PIN status unavailable");
  return result;
}

export async function edgeKidGetState(params: { code: string }) {
  return invoke<{
    kid: any;
    ageGroup?: "6-9" | "10-12" | "13-17";
    investmentsValue?: number | null;
    questsCompleted?: number;
    goals: any[];
    txs: any[];
    rewards: any[];
    loans: any[];
    approvals: any[];
    attempts: any[];
    parent: any;
    notifications: {
      id: string;
      kid_id: string;
      kind: string;
      message: string;
      link?: string | null;
      read: boolean;
      created_at: string;
    }[];
    unreadNotifications: number;
  }>("kid-finance", { action: "get-state", ...params });
}

export async function edgeKidGetHistory(params: {
  code: string;
  days: number;
}) {
  return invoke<{
    txs: {
      id: string;
      type: string;
      amount: number;
      label: string | null;
      created_at: string;
    }[];
  }>("kid-finance", { action: "get-history", ...params });
}

export async function edgeKidClaimCoins(params: { code: string }) {
  return invoke<{ claimed: number }>("kid-finance", {
    action: "claim-coins",
    ...params,
  });
}

export interface QuestNode {
  id: string;
  slug: string;
  title: string;
  summary: string;
  icon: string;
  points: number;
  position: number;
  questionCount: number;
  status: "done" | "open" | "locked";
  completedAt: string | null;
  bestCorrect: number | null;
}

export async function edgeKidQuestBoard(params: { code: string }) {
  return invoke<{
    ageGroup: "6-9" | "10-12" | "13-17";
    quests: QuestNode[];
  }>("kid-finance", { action: "quest-board", ...params });
}

export async function edgeKidQuestStart(params: {
  code: string;
  questId: string;
}) {
  return invoke<{
    attemptId: string;
    quest: {
      title: string;
      points: number;
    };
    questions: {
      id: string;
      position: number;
      prompt: string;
      choices: string[];
    }[];
  }>("kid-finance", { action: "quest-start", ...params });
}

export async function edgeKidQuestAnswer(params: {
  code: string;
  attemptId: string;
  questionId: string;
  selectedIndex: number;
}) {
  return invoke<{
    correct: boolean;
    correctIndex: number;
    explanation: string;
    done: boolean;
    correctCount: number;
    total: number;
    passed?: boolean;
    pointsAwarded?: number;
    firstCompletion?: boolean;
  }>("kid-finance", { action: "quest-answer", ...params });
}

export async function edgeKidRequestApproval(params: {
  code: string;
  kind: "WITHDRAWAL" | "DEPOSIT";
  amount: number;
  reason: string;
}) {
  return invoke<{ ok: boolean }>("kid-finance", {
    action: "request-approval",
    ...params,
  });
}

export async function edgeKidRequestLoan(params: {
  code: string;
  amount: number;
  reason: string;
  signature: string;
  dueDays: number;
}) {
  return invoke<{ ok: boolean }>("kid-finance", {
    action: "request-loan",
    ...params,
  });
}

export async function edgeKidRequestReward(params: {
  code: string;
  name: string;
  cost: number;
}) {
  return invoke<{ ok: boolean }>("kid-finance", {
    action: "request-reward",
    ...params,
  });
}

export async function edgeKidUpdateProfile(params: {
  code: string;
  birth_date?: string | null;
  birth_year?: number | null;
  bio?: string | null;
}) {
  return invoke<{ ok: boolean }>("kid-finance", {
    action: "update-profile",
    ...params,
  });
}

export async function edgeKidUploadAvatar(params: {
  code: string;
  base64Image: string;
}) {
  return invoke<{ avatarUrl: string }>("kid-finance", {
    action: "upload-avatar",
    ...params,
  });
}

export interface PennyChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function edgeKidPennyChat(params: {
  code: string;
  message: string;
  previousIntent?: PennyIntent;
  thinking?: boolean;
  model?: string;
  context?: { page: string; detail?: string };
}) {
  return invoke<{
    reply: string;
    intent?: PennyIntent;
    model: string;
    thinking: boolean;
    remaining: number;
  }>("kid-finance", { action: "penny-chat", ...params });
}

export async function edgeParentPennyChat(params: {
  message: string;
  previousIntent?: PennyIntent;
  thinking?: boolean;
  model?: string;
  pinSession?: string;
  context?: { page: string; detail?: string };
}) {
  return invoke<{
    reply: string;
    intent?: PennyIntent;
    model: string;
    thinking: boolean;
    remaining: number;
  }>("parent-finance", { action: "penny-chat", ...params });
}

export interface TransferRecipientSibling {
  id: string;
  name: string;
  comfort_name: string | null;
  avatar: string | null;
}

export interface TransferRecipientParent {
  id: string;
  name: string | null;
  avatar: string | null;
}

export interface KidTransferRecipientsResponse {
  siblings: TransferRecipientSibling[];
  parent: TransferRecipientParent | null;
  balance: number;
  dailyLimit: number;
  usedToday: number;
}

export async function edgeKidTransferRecipients(params: { code: string }) {
  return invoke<KidTransferRecipientsResponse>("kid-finance", {
    action: "transfer-recipients",
    ...params,
  });
}

export async function edgeKidTransfer(params: {
  code: string;
  pin: string;
  recipientKind: "kid" | "parent";
  recipientId: string;
  amount: number;
  note?: string;
  parentLabel?: string;
}) {
  return invoke<{
    ok: boolean;
    approvalId?: string;
    balance?: number;
    status: "pending" | "completed";
  }>("kid-finance", {
    action: "transfer",
    ...params,
  });
}

export async function edgeParentTransfer(params: {
  kidId: string;
  amount: number;
  note?: string;
  parentLabel?: string;
  pin: string;
}) {
  return invoke<{ ok: boolean; balance?: number }>("parent-finance", {
    action: "transfer",
    ...params,
  });
}

// ---------------------------------------------------------------------------
// Investment (Centsibility Funds) Edge Helpers
// ---------------------------------------------------------------------------

export interface InvestmentPathTick {
  tick: number;
  tickAt: string;
  rate: number;
  value: number;
}

export interface InvestmentItem {
  id: string;
  kid_id: string;
  mode: "fund" | "market";
  label: string | null;
  principal: number;
  status: "active" | "closed";
  tier?: "low" | "medium" | "high";
  frequency?: "minute" | "day" | "week";
  lock_ticks?: number;
  protected?: boolean;
  symbol?: string;
  entry_price?: number;
  entry_price_at?: string;
  created_at: string;
  closed_at: string | null;
  payout: number | null;
  close_reason: "matured" | "early" | "sold" | null;
  currentValue: number | null;
  profitRm: number | null;
  profitPct: number | null;
  endsAt: string | null;
  nextUpdate: string | null;
  path?: InvestmentPathTick[];
  entryPrice?: number;
  entryDate?: string;
  currentPrice?: number | null;
  lastUpdated?: string | null;
  isMarketOpen?: boolean | null;
  stale?: boolean;
  chartPoints?: Array<{ day: string; price: number }>;
}

export interface InvestmentOptionsResponse {
  tiers: Record<
    string,
    { name: string; min_rate: number; max_rate: number; label: string }
  >;
  frequencies: Record<
    string,
    {
      name: string;
      interval_seconds: number;
      lengths: number[];
      min_amount: number;
      max_amount: number;
      max_open?: number;
      daily_limit?: number;
    }
  >;
  max_open_funds: number;
}

export interface InvestmentPreviewResponse {
  minValue: number;
  maxValue: number;
  endsAt: string;
}

export async function edgeKidInvestOptions(params?: { code?: string }) {
  return invoke<InvestmentOptionsResponse>("kid-finance", {
    action: "invest-options",
    ...params,
  });
}

export async function edgeKidInvestPreview(params: {
  code?: string;
  tier: string;
  frequency: string;
  lockTicks: number;
  amount: number;
}) {
  return invoke<InvestmentPreviewResponse>("kid-finance", {
    action: "invest-preview",
    ...params,
  });
}

export async function edgeKidInvestList(params?: { code?: string }) {
  return invoke<{ investments: InvestmentItem[] }>("kid-finance", {
    action: "invest-list",
    ...params,
  });
}

export async function edgeKidInvestOpen(params: {
  code?: string;
  tier: string;
  frequency: string;
  lockTicks: number;
  amount: number;
  clientRequestId?: string;
}) {
  return invoke<InvestmentItem>("kid-finance", {
    action: "invest-open",
    ...params,
  });
}

export async function edgeKidInvestClose(params: {
  code?: string;
  investmentId: string;
}) {
  return invoke<{ success: boolean; payout: number }>("kid-finance", {
    action: "invest-close",
    ...params,
  });
}

export async function edgeParentGetKidInvestments(params?: { kidId?: string }) {
  return invoke<{
    investmentsByKid: Record<string, InvestmentItem[]>;
    byKid?: Record<string, InvestmentItem[]>;
  }>("parent-finance", {
    action: "kid-investments",
    ...params,
  });
}

export interface MarketSymbolItem {
  symbol: string;
  name: string;
  kind: "etf" | "stock";
  halal_source: string;
  halal_checked_on: string;
  active: boolean;
  price?: number | null;
  previous_close?: number | null;
  change_percent?: number | null;
  is_market_open?: boolean;
  last_updated?: string | null;
  stale?: boolean;
  last_close?: number;
  last_close_as_of?: string;
  degraded_reason?: MarketSymbolDetailResponse["degradedReason"];
  halal_url?: string;
  verified?: boolean;
}

export interface MarketSymbolsResponse {
  symbols: MarketSymbolItem[];
  enabled: boolean;
  ageGroup: "6-9" | "10-12" | "13-17";
}

export interface MarketSymbolDetailResponse {
  symbol: string;
  quote?: {
    symbol: string;
    price: number;
    previous_close?: number | null;
    currency: string;
    is_market_open: boolean;
    price_time?: string | null;
    fetched_at: string;
    change_percent?: number | null;
  };
  available: boolean;
  stale?: boolean;
  marketState?: "open" | "closed" | "unknown";
  lastClose?: number;
  lastCloseAsOf?: string;
  degradedReason?: "local_quota" | "provider_quota" | "monitor_unavailable";
  dailyCloses: Array<{ day: string; close: number }>;
}

export interface MarketQuotesResponse {
  usage?: MarketUsage;
  marketState: "open" | "closed" | "unknown";
  quotes: Record<
    string,
    Omit<MarketSymbolDetailResponse, "dailyCloses" | "symbol">
  >;
}
export async function edgeKidMarketQuotes(params: {
  code?: string;
  symbols: string[];
}) {
  return invoke<MarketQuotesResponse>("kid-finance", {
    action: "market-quotes",
    ...params,
  });
}

export async function edgeKidMarketSymbols(params?: { code?: string }) {
  return invoke<MarketSymbolsResponse>("kid-finance", {
    action: "market-symbols",
    ...params,
  });
}

export async function edgeKidMarketSymbol(params: {
  code?: string;
  symbol: string;
}) {
  return invoke<MarketSymbolDetailResponse>("kid-finance", {
    action: "market-symbol",
    ...params,
  });
}

export async function edgeKidMarketOpen(params: {
  code?: string;
  symbol: string;
  amount: number;
  clientRequestId?: string;
}) {
  return invoke<InvestmentItem>("kid-finance", {
    action: "market-open",
    ...params,
  });
}

export async function edgeKidMarketSell(params: {
  code?: string;
  investmentId: string;
}) {
  return invoke<{ success: boolean; payout: number }>("kid-finance", {
    action: "market-sell",
    ...params,
  });
}

export const CURATED_MARKET_SYMBOLS: MarketSymbolItem[] = [
  {
    symbol: "SPUS",
    name: "SP Funds S&P 500 Sharia Industry Exclusions ETF",
    kind: "etf",
    halal_source: "S&P Shariah index (AAOIFI standards)",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 60.63,
    previous_close: 60.33,
    change_percent: 0.5,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "HLAL",
    name: "Wahed FTSE USA Shariah ETF",
    kind: "etf",
    halal_source: "FTSE Shariah index",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 42.5,
    previous_close: 43.2,
    change_percent: -1.62,
    is_market_open: true,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "UMMA",
    name: "Wahed Dow Jones Islamic World ETF",
    kind: "etf",
    halal_source: "Dow Jones Islamic Market index",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 24.8,
    previous_close: 24.75,
    change_percent: 0.2,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "SPWO",
    name: "SP Funds S&P World (ex-US) ETF",
    kind: "etf",
    halal_source: "S&P Shariah index",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 31.4,
    previous_close: 31.25,
    change_percent: 0.48,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "SPSK",
    name: "SP Funds Dow Jones Global Sukuk ETF",
    kind: "etf",
    halal_source: "Dow Jones Sukuk index (lower swings)",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 18.25,
    previous_close: 18.25,
    change_percent: 0.0,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "SPRE",
    name: "SP Funds S&P Global REIT Sharia ETF",
    kind: "etf",
    halal_source: "S&P Shariah index",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 21.15,
    previous_close: 20.9,
    change_percent: 1.2,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "SPTE",
    name: "SP Funds S&P Global Technology ETF",
    kind: "etf",
    halal_source: "S&P Shariah index",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 35.8,
    previous_close: 35.1,
    change_percent: 1.99,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    kind: "stock",
    halal_source:
      "S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 228.5,
    previous_close: 227.1,
    change_percent: 0.62,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    kind: "stock",
    halal_source:
      "S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 418.2,
    previous_close: 416.8,
    change_percent: 0.34,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    kind: "stock",
    halal_source:
      "S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 165.4,
    previous_close: 166.0,
    change_percent: -0.36,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    kind: "stock",
    halal_source:
      "S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 122.9,
    previous_close: 120.4,
    change_percent: 2.08,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    kind: "stock",
    halal_source:
      "S&P 500 Shariah index, via SPUS holdings, checked 1 Oct 2026",
    halal_checked_on: "2026-10-01",
    active: true,
    price: 242.1,
    previous_close: 245.3,
    change_percent: -1.3,
    is_market_open: false,
    last_updated: "2026-10-05T15:05:00Z",
  },
  ...VERIFIED_STOCK_ADDITIONS.map((s) => ({
    ...s,
    kind: "stock" as const,
    active: true,
    halal_source: SCREENING[s.symbol].source,
    halal_checked_on: SCREENING[s.symbol].checked,
  })),
].map((s) => ({
  ...s,
  kind: s.kind as MarketSymbolItem["kind"],
  halal_source: SCREENING[s.symbol].source,
  halal_checked_on: SCREENING[s.symbol].checked,
  halal_url: SCREENING[s.symbol].url,
  verified: true,
}));

let demoMarketEnabledState: boolean | null = null;
export function setDemoMarketEnabled(enabled: boolean | null) {
  demoMarketEnabledState = enabled;
  if (typeof window !== "undefined") {
    if (enabled === null)
      window.localStorage.removeItem("centsibility.demo.market_enabled");
    else
      window.localStorage.setItem(
        "centsibility.demo.market_enabled",
        String(enabled),
      );
  }
}
export function getDemoMarketEnabled(): boolean | null {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem("centsibility.demo.market_enabled");
    if (raw === "true") return true;
    if (raw === "false") return false;
  }
  if (demoMarketEnabledState !== null) return demoMarketEnabledState;
  return null;
}

export async function edgeKidLogout(params: { code: string }) {
  return invoke<{ ok: boolean }>("kid-finance", {
    action: "logout",
    ...params,
  });
}
