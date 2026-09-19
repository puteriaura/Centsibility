import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import {
  edgeKidInvestDeposit,
  edgeKidInvestWithdraw,
  edgeKidInvestSettle,
  edgeKidSetInvestRisk,
  edgeKidSetInvestFrequency,
} from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

export const Route = createFileRoute("/kid/invest")({
  head: () => ({ meta: [{ title: "Invest — Centsibility" }] }),
  component: KidInvest,
});

// Risk levels
const RISK_LEVELS = [
  { key: "very_low",  label: "Very Low",  rate: 0.0005, desc: "Tiny steady gains, minimal risk" },
  { key: "low",       label: "Low",       rate: 0.001,  desc: "Small steady growth rate" },
  { key: "medium",    label: "Medium",    rate: 0.002,  desc: "Balanced Shariah growth" },
  { key: "high",      label: "High",      rate: 0.003,  desc: "Higher potential return swings" },
  { key: "very_high", label: "Very High", rate: 0.004,  desc: "Maximum returns, highest volatility" },
] as const;

// Frequency options
const FREQ_OPTIONS = [
  { key: "minute",  label: "Every Min",  desc: "Instant live ticks" },
  { key: "hourly",  label: "Hourly",     desc: "Compounded hourly" },
  { key: "daily",   label: "Daily",      desc: "Daily market close" },
  { key: "weekly",  label: "Weekly",     desc: "Weekly rebalancing" },
  { key: "monthly", label: "Monthly",    desc: "Monthly harvest" },
] as const;

function KidInvest() {
  const { data, loading, refresh } = useKidData();
  const [dir, setDir] = useState<"in" | "out">("in");
  const [savingRisk, setSavingRisk] = useState(false);
  const [savingFreq, setSavingFreq] = useState(false);

  useEffect(() => {
    const code = getKidSession()?.code;
    if (!code) return;
    edgeKidInvestSettle({ code })
      .then((r) => {
        if (r.paid > 0) toast.success(`Your investment grew by RM${r.paid.toFixed(2)}!`);
        else if (r.paid < 0) toast.error(`Investment dipped by RM${Math.abs(r.paid).toFixed(2)}`);
        refresh();
      })
      .catch(() => {});
  }, [refresh]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "14rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const k = data.kid;
  const code = getKidSession()?.code;
  const currentRisk = (k.risk_appetite as string) || "low";
  const currentFreq = (k.invest_frequency as string) || "daily";
  const rate = Number(k.invest_rate ?? 0.001);
  const balance = Number(k.balance);
  const invested = Number(k.invest_balance);
  const projected = invested * Math.pow(1 + rate, 4);

  const setRisk = async (key: string) => {
    if (!code || savingRisk) return;
    setSavingRisk(true);
    try {
      await edgeKidSetInvestRisk({ code, riskAppetite: key });
      toast.success("Risk level updated!");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSavingRisk(false);
    }
  };

  const setFreq = async (key: string) => {
    if (!code || savingFreq) return;
    setSavingFreq(true);
    try {
      await edgeKidSetInvestFrequency({ code, frequency: key });
      toast.success("Frequency updated!");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSavingFreq(false);
    }
  };

  const deposit = async (amount: number) => {
    if (!code) return;
    try {
      await edgeKidInvestDeposit({ code, amount });
      toast.success("Funds added to investment!");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const withdraw = async (amount: number) => {
    if (!code) return;
    try {
      await edgeKidInvestWithdraw({ code, amount });
      toast.success("Funds recalled to main wallet");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  // 7-day chart
  const last7DaysTxs = data.txs.filter(
    (t: (typeof data.txs)[number]) =>
      ["INVEST_IN", "INVEST_OUT", "HIBAH"].includes(t.type) &&
      (t.type !== "HIBAH" || t.label.includes("Investment")) &&
      new Date(t.created_at).getTime() > Date.now() - 7 * 86400000,
  );
  const chartData = [];
  let runningBalance = invested;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    chartData.unshift({
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      value: Math.max(0, runningBalance),
    });
    const dayTxs = last7DaysTxs.filter(
      (t: (typeof last7DaysTxs)[number]) => new Date(t.created_at).getDate() === d.getDate(),
    );
    for (const t of dayTxs) {
      if (t.type === "INVEST_IN") runningBalance -= t.amount;
      else if (t.type === "INVEST_OUT") runningBalance += t.amount;
      else if (t.type === "HIBAH") runningBalance -= t.amount;
    }
  }
  const startBal = chartData[0]?.value || 0;
  const endBal = chartData[chartData.length - 1]?.value || 0;
  let status: "PROFIT" | "LOSS" | "STAGNANT" = "STAGNANT";
  if (endBal > startBal) status = "PROFIT";
  else if (endBal < startBal) status = "LOSS";

  const absChange = Math.abs(endBal - startBal);
  const pctChange = startBal === 0 ? (endBal > 0 ? 100 : 0) : (absChange / startBal) * 100;

  return (
    <div className="space-y-6 pb-12">
      <section className="deposit-hero" aria-label="Invested portfolio">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Invested portfolio</p>
          <p className="deposit-hero__amount tabular-nums">RM{invested.toFixed(2)}</p>
          <p className="deposit-hero__link" style={{ cursor: "default", textDecoration: "none" }}>
            {status === "PROFIT" ? "+" : status === "LOSS" ? "−" : ""}
            RM{absChange.toFixed(2)} ({pctChange.toFixed(1)}%) · 7 days · Wallet RM{balance.toFixed(2)}
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="invest" size={32} color="#fff" />
        </div>
      </section>

      <div>
        <h1 className="text-lg font-bold text-[var(--ink)] m-0">Halal Growth</h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 mb-0">
          Shariah-compliant fund simulation with risk controls.
        </p>
      </div>

      {/* Balance card + chart */}
      <Card variant="default" className="p-5 sm:p-6 rounded-2xl border border-[var(--border)] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
              7-day movement
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              <span
                className={`font-bold tabular-nums ${
                  status === "PROFIT"
                    ? "text-[var(--success)]"
                    : status === "LOSS"
                      ? "text-[var(--error)]"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {status === "PROFIT" ? "+ " : status === "LOSS" ? "- " : ""}RM {absChange.toFixed(2)} ({pctChange.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div>
            {status === "PROFIT" ? (
              <Badge variant="success">Profit</Badge>
            ) : status === "LOSS" ? (
              <Badge variant="error">Dip</Badge>
            ) : (
              <Badge variant="default">Steady</Badge>
            )}
          </div>
        </div>

        {/* Solid fill only — no chart gradients */}
        <div className="h-28 sm:h-32 -mx-2 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <YAxis domain={["auto", "auto"]} hide />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="var(--primary-soft)"
                fillOpacity={1}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Rate info footer */}
        <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between text-xs text-[var(--text-secondary)] gap-2">
          <span>
            Growth rate: <strong className="text-[var(--ink)]">{(rate * 100).toFixed(2)}%</strong> / cycle
          </span>
          <span>
            Cadence: <strong className="text-[var(--ink)]">{FREQ_OPTIONS.find((f) => f.key === currentFreq)?.label ?? currentFreq}</strong>
          </span>
          <span>
            Projected (4 cycles): <strong className="text-[var(--primary)] font-bold">RM {projected.toFixed(2)}</strong>
          </span>
        </div>
      </Card>

      {/* ── Risk Appetite ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AppIcon name="chart" size={18} color="var(--primary)" />
          <SectionTitle>Risk Appetite</SectionTitle>
        </div>
        <Card variant="default" className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Higher risk offers higher growth potential alongside potential market swings.
          </p>
          <div className="space-y-2">
            {RISK_LEVELS.map((r) => {
              const isSelected = currentRisk === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRisk(r.key)}
                  disabled={savingRisk}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer min-h-[44px] ${
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--surface-pink)] shadow-xs"
                      : "border-[var(--border)] bg-white hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className={`text-sm ${isSelected ? "text-[var(--primary)]" : "text-[var(--ink)]"}`}>
                        {r.label}
                      </strong>
                      {isSelected && <Badge variant="brand">Active</Badge>}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{r.desc}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold tabular-nums text-[var(--ink)]">
                      {(r.rate * 100).toFixed(2)}%
                    </span>
                    <span className="block text-[10px] text-[var(--text-muted)]">rate</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Update Frequency ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AppIcon name="timer" size={18} color="var(--primary)" />
          <SectionTitle>Growth Schedule</SectionTitle>
        </div>
        <Card variant="default" className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Choose how frequently your investment portfolio compounds returns.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FREQ_OPTIONS.map((f) => {
              const isSelected = currentFreq === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFreq(f.key)}
                  disabled={savingFreq}
                  className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer min-h-[44px] ${
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--surface-pink)] shadow-xs"
                      : "border-[var(--border)] bg-white hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <strong className={`text-xs sm:text-sm block ${isSelected ? "text-[var(--primary)]" : "text-[var(--ink)]"}`}>
                    {f.label}
                  </strong>
                  <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block">
                    {f.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Transfer Energy / Invest & Recall ── */}
      <div className="space-y-3">
        <SectionTitle>Manage Investment Funds</SectionTitle>
        <Card variant="default" className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={dir === "in" ? "primary" : "secondary"}
              onClick={() => setDir("in")}
              className="w-full justify-center"
            >
              <AppIcon name="plus" size={14} /> Add to Invest
            </Button>
            <Button
              type="button"
              variant={dir === "out" ? "primary" : "secondary"}
              onClick={() => setDir("out")}
              className="w-full justify-center"
            >
              <AppIcon name="recall" size={14} /> Recall to Wallet
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] py-1 border-b border-[var(--border)]">
            <span>Core Wallet: <strong>RM {balance.toFixed(2)}</strong></span>
            <span>Invested Pool: <strong>RM {invested.toFixed(2)}</strong></span>
          </div>

          <MoneyKeypad
            key={dir}
            min={0.5}
            max={dir === "in" ? balance : invested}
            confirmLabel={dir === "in" ? "Deposit to Investment" : "Recall to Main Wallet"}
            onConfirm={dir === "in" ? deposit : withdraw}
          />
        </Card>
      </div>
    </div>
  );
}
