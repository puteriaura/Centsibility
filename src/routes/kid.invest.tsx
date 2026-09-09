import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
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
import { toast } from "sonner";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

export const Route = createFileRoute("/kid/invest")({
  head: () => ({ meta: [{ title: "Invest — Centsibility" }] }),
  component: KidInvest,
});

// Risk levels
const RISK_LEVELS = [
  { key: "very_low",  label: "Very Low",  rate: 0.0005, desc: "Tiny gains, almost no loss" },
  { key: "low",       label: "Low",       rate: 0.001,  desc: "Small steady growth" },
  { key: "medium",    label: "Medium",    rate: 0.002,  desc: "Balanced risk & reward" },
  { key: "high",      label: "High",      rate: 0.003,  desc: "Bigger swings possible" },
  { key: "very_high", label: "Very High", rate: 0.004,  desc: "Max gains, max losses" },
] as const;

// Frequency options
const FREQ_OPTIONS = [
  { key: "minute",  label: "Every Min",  desc: "Tiny ticks every minute" },
  { key: "hourly",  label: "Hourly",     desc: "Small changes each hour" },
  { key: "daily",   label: "Daily",      desc: "Once per day" },
  { key: "weekly",  label: "Weekly",     desc: "Once per week" },
  { key: "monthly", label: "Monthly",    desc: "Once per month" },
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

  if (loading || !data)
    return (
      <Card className="wireframe-card">Loading…</Card>
    );

  const k = data.kid;
  const code = getKidSession()?.code;
  const currentRisk = (k.risk_appetite as string) || "low";
  const currentFreq = (k.invest_frequency as string) || "daily";
  const rate = Number(k.invest_rate ?? 0.001);
  const balance = Number(k.balance);
  const invested = Number(k.invest_balance);
  const projected = invested * Math.pow(1 + rate, 4);

  const riskInfo = RISK_LEVELS.find((r) => r.key === currentRisk) ?? RISK_LEVELS[1];

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
      toast.success("Invested!");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const withdraw = async (amount: number) => {
    if (!code) return;
    try {
      await edgeKidInvestWithdraw({ code, amount });
      toast.success("Moved back to wallet");
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
    chartData.unshift({ name: d.toLocaleDateString("en-US", { weekday: "short" }), value: Math.max(0, runningBalance) });
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
    <>
      <h1>[icon: invest] Cosmic Growth</h1>
      <p>Choose your risk and frequency. Your money grows (or dips) based on your settings.</p>

      {/* Balance card + chart */}
      <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
        <div className="wireframe-space-between">
          <div>
            <small>Generating</small>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>RM {invested.toFixed(2)}</div>
            <div>
              <small>
                {status === "PROFIT" ? "[↑]" : status === "LOSS" ? "[↓]" : "[→]"} RM {absChange.toFixed(2)} ({pctChange.toFixed(1)}%) · 7d
              </small>
            </div>
          </div>
          <div>
            <small>Status: <strong>{status}</strong></small>
          </div>
        </div>
        <div style={{ height: "100px", marginTop: "1rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <YAxis domain={["auto", "auto"]} hide />
              <Area type="monotone" dataKey="value" stroke="#666" strokeWidth={1.5} fill="#eee" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Rate info */}
      <div className="wireframe-box" style={{ marginTop: "0.5rem", textAlign: "center" }}>
        <small>
          Growth rate: <strong>{(rate * 100).toFixed(2)}%</strong> per settle ·
          Frequency: <strong>{FREQ_OPTIONS.find((f) => f.key === currentFreq)?.label ?? currentFreq}</strong> ·
          Projected (4 cycles): <strong>RM {projected.toFixed(2)}</strong>
        </small>
      </div>

      {/* ── Risk Appetite ── */}
      <SectionTitle>[icon: chart] Risk Appetite</SectionTitle>
      <Card className="wireframe-card">
        <p><small>Higher risk = bigger potential gains AND bigger potential losses.</small></p>
        <div className="wireframe-col" style={{ marginTop: "0.5rem" }}>
          {RISK_LEVELS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRisk(r.key)}
              disabled={savingRisk}
              className="wireframe-space-between"
              style={{
                border: currentRisk === r.key ? "2px solid #000" : "1px solid #ccc",
                fontWeight: currentRisk === r.key ? "bold" : "normal",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <strong>{r.label}</strong>
                <div><small>{r.desc}</small></div>
              </div>
              <div>{(r.rate * 100).toFixed(2)}%</div>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Update Frequency ── */}
      <SectionTitle>[icon: timer] Update Frequency</SectionTitle>
      <Card className="wireframe-card">
        <p><small>How often your investment grows or changes.</small></p>
        <div className="wireframe-grid-3" style={{ marginTop: "0.5rem" }}>
          {FREQ_OPTIONS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFreq(f.key)}
              disabled={savingFreq}
              style={{
                border: currentFreq === f.key ? "2px solid #000" : "1px solid #ccc",
                textAlign: "left",
              }}
            >
              <strong>{f.label}</strong>
              <div><small>{f.desc}</small></div>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Transfer Energy ── */}
      <SectionTitle>Transfer Energy</SectionTitle>
      <Card className="wireframe-card">
        <div className="wireframe-grid-2" style={{ marginBottom: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setDir("in")}
            style={{
              border: dir === "in" ? "2px solid #000" : "1px solid #ccc",
              fontWeight: dir === "in" ? "bold" : "normal",
            }}
          >
            [icon: plus] Grow
          </button>
          <button
            type="button"
            onClick={() => setDir("out")}
            style={{
              border: dir === "out" ? "2px solid #000" : "1px solid #ccc",
              fontWeight: dir === "out" ? "bold" : "normal",
            }}
          >
            [icon: recall] Recall
          </button>
        </div>
        <div className="wireframe-space-between" style={{ marginBottom: "0.5rem" }}>
          <small>Core: RM {balance.toFixed(2)}</small>
          <small>Generating: RM {invested.toFixed(2)}</small>
        </div>
        <MoneyKeypad
          key={dir}
          min={0.5}
          max={dir === "in" ? balance : invested}
          confirmLabel={dir === "in" ? "Lock Energy" : "Recall Energy"}
          onConfirm={dir === "in" ? deposit : withdraw}
        />
      </Card>
    </>
  );
}
