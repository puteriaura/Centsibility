import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
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
import {
  Leaf,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Plus,
  ArrowUUpLeft,
  Timer,
  ChartLine,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/kid/invest")({
  head: () => ({ meta: [{ title: "Invest — Centsibility" }] }),
  component: KidInvest,
});

// Risk levels — kid-controlled
const RISK_LEVELS = [
  { key: "very_low",  label: "Very Low",  rate: 0.0005, color: "text-sky-400",    bg: "bg-sky-400",    desc: "Tiny gains, almost no loss" },
  { key: "low",       label: "Low",       rate: 0.001,  color: "text-neon-mint",  bg: "bg-neon-mint",  desc: "Small steady growth" },
  { key: "medium",    label: "Medium",    rate: 0.002,  color: "text-sunny",      bg: "bg-sunny",      desc: "Balanced risk & reward" },
  { key: "high",      label: "High",      rate: 0.003,  color: "text-coral",      bg: "bg-coral",      desc: "Bigger swings possible" },
  { key: "very_high", label: "Very High", rate: 0.004,  color: "text-nova-red",   bg: "bg-nova-red",   desc: "Max gains, max losses" },
] as const;

// Frequency options — how often growth is applied
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
      <AppShell mode="kid">
        <Card>Loading…</Card>
      </AppShell>
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

  const colorMap = {
    PROFIT:   { bg: "bg-gradient-to-br from-neon-mint/20 to-void/50", chart: "#20e29b", arrow: <ArrowUpRight weight="bold" className="inline w-4 h-4" />, border: "border-neon-mint/50", shadow: "shadow-[0_0_20px_var(--neon-mint)]" },
    LOSS:     { bg: "bg-gradient-to-br from-nova-red/20 to-void/50",  chart: "#ff4d4d", arrow: <ArrowDownRight weight="bold" className="inline w-4 h-4" />, border: "border-nova-red/50",  shadow: "shadow-[0_0_20px_var(--nova-red)]" },
    STAGNANT: { bg: "bg-void/50", chart: "#9ca3af", arrow: <ArrowRight weight="bold" className="inline w-4 h-4" />, border: "border-starlight/20", shadow: "shadow-none" },
  };
  const theme = colorMap[status];
  const absChange = Math.abs(endBal - startBal);
  const pctChange = startBal === 0 ? (endBal > 0 ? 100 : 0) : (absChange / startBal) * 100;

  return (
    <AppShell mode="kid">
      <h1 className="font-display text-2xl text-starlight flex items-center gap-2 drop-shadow-sm">
        <Leaf weight="duotone" className="w-8 h-8 text-nebula-pink drop-shadow-[0_0_8px_var(--nebula-pink)]" />
        Cosmic Growth
      </h1>
      <p className="font-body text-sm text-starlight/60 mt-1">
        Choose your risk and frequency. Your money grows (or dips) based on your settings.
      </p>

      {/* Balance card + chart */}
      <Card className={`mt-5 glass-panel ${theme.bg} text-white transition-colors duration-500 overflow-hidden relative ${theme.shadow} border ${theme.border}`}>
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="text-[10px] font-kid uppercase tracking-widest text-starlight/60">Generating</div>
            <div className="mt-1 font-mono text-4xl font-bold drop-shadow-md">RM {invested.toFixed(2)}</div>
            <div className="mt-3 font-kid text-sm font-bold flex items-center gap-1.5">
              <span className={`px-2 py-1 rounded-md ${status === "PROFIT" ? "bg-neon-mint/20 text-neon-mint" : status === "LOSS" ? "bg-nova-red/20 text-nova-red" : "bg-void/40 text-starlight"}`}>
                {theme.arrow} RM {absChange.toFixed(2)} ({pctChange.toFixed(1)}%)
              </span>
              <span className="text-[10px] uppercase font-body tracking-wider text-starlight/40">7d</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-kid tracking-widest uppercase text-starlight/60 mb-1.5">Status</div>
            <div className={`px-2.5 py-1 rounded-lg font-bold text-xs inline-block tracking-wider ${status === "PROFIT" ? "bg-neon-mint text-void shadow-[0_0_10px_var(--neon-mint)]" : status === "LOSS" ? "bg-nova-red text-white shadow-[0_0_10px_var(--nova-red)]" : "bg-void border border-starlight/20 text-starlight"}`}>
              {status}
            </div>
          </div>
        </div>
        <div className="h-28 mt-4 -mx-4 -mb-4 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.chart} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={theme.chart} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={["auto", "auto"]} hide />
              <Area type="monotone" dataKey="value" stroke={theme.chart} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" animationDuration={1500} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Rate info */}
      <div className="mt-3 text-center text-[11px] text-starlight/50 font-body uppercase tracking-widest border border-starlight/10 rounded-2xl py-3 px-4 glass-panel bg-void/30">
        Growth rate: <span className={riskInfo.color}>{(rate * 100).toFixed(2)}%</span> per settle ·
        Frequency: <span className="text-nebula-pink">{FREQ_OPTIONS.find((f) => f.key === currentFreq)?.label ?? currentFreq}</span>
        <br />
        Projected (4 cycles):{" "}
        <span className="text-starlight font-mono font-bold ml-1">RM {projected.toFixed(2)}</span>
      </div>

      {/* ── Risk Appetite ── */}
      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <ChartLine weight="duotone" className="w-4 h-4 text-nebula-pink" /> Risk Appetite
        </span>
      </SectionTitle>
      <Card className="glass-panel bg-void/50 border-starlight/20">
        <p className="font-body text-xs text-starlight/60 mb-4">
          Higher risk = bigger potential gains AND bigger potential losses.
        </p>
        <div className="space-y-2">
          {RISK_LEVELS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRisk(r.key)}
              disabled={savingRisk}
              className={`w-full rounded-2xl px-4 py-3 flex items-center justify-between transition border ${
                currentRisk === r.key
                  ? `${r.bg} text-void border-transparent shadow-[0_0_12px_rgba(0,0,0,0.3)]`
                  : "glass-panel bg-void/30 text-starlight/70 border-starlight/10 hover:border-starlight/30 hover:text-starlight"
              }`}
            >
              <div className="text-left">
                <div className={`font-kid font-bold text-sm ${currentRisk === r.key ? "text-void" : r.color}`}>
                  {r.label}
                </div>
                <div className={`font-body text-[10px] mt-0.5 ${currentRisk === r.key ? "text-void/70" : "text-starlight/50"}`}>
                  {r.desc}
                </div>
              </div>
              <div className={`font-mono text-sm font-bold ${currentRisk === r.key ? "text-void" : r.color}`}>
                {(r.rate * 100).toFixed(2)}%
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Update Frequency ── */}
      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Timer weight="duotone" className="w-4 h-4 text-cosmic-blue" /> Update Frequency
        </span>
      </SectionTitle>
      <Card className="glass-panel bg-void/50 border-starlight/20">
        <p className="font-body text-xs text-starlight/60 mb-4">
          How often your investment grows or changes.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FREQ_OPTIONS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFreq(f.key)}
              disabled={savingFreq}
              className={`rounded-2xl px-3 py-3 text-left transition border ${
                currentFreq === f.key
                  ? "bg-cosmic-blue border-cosmic-blue text-white shadow-[0_0_12px_var(--cosmic-blue)]"
                  : "glass-panel bg-void/30 text-starlight/70 border-starlight/10 hover:border-starlight/30 hover:text-starlight"
              }`}
            >
              <div className="font-kid font-bold text-xs">{f.label}</div>
              <div className={`font-body text-[10px] mt-0.5 ${currentFreq === f.key ? "text-white/70" : "text-starlight/40"}`}>
                {f.desc}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Transfer Energy ── */}
      <SectionTitle>Transfer Energy</SectionTitle>
      <Card className="glass-panel bg-void/50 border-starlight/20 shadow-none">
        <div className="mb-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => setDir("in")}
            className={`btn-press rounded-2xl py-4 flex items-center justify-center gap-2 font-kid text-xs font-bold transition uppercase tracking-wider border ${dir === "in" ? "bg-nebula-pink border-nebula-pink text-white shadow-[0_0_15px_var(--nebula-pink)]" : "glass-panel bg-void/30 text-starlight/80 border-starlight/20 hover:bg-white/10"}`}
          >
            <Plus weight="bold" className="w-4 h-4" /> Grow
          </button>
          <button
            onClick={() => setDir("out")}
            className={`btn-press rounded-2xl py-4 flex items-center justify-center gap-2 font-kid text-xs font-bold transition uppercase tracking-wider border ${dir === "out" ? "bg-nova-red border-nova-red text-white shadow-[0_0_15px_var(--nova-red)]" : "glass-panel bg-void/30 text-starlight/80 border-starlight/20 hover:bg-white/10"}`}
          >
            <ArrowUUpLeft weight="bold" className="w-4 h-4" /> Recall
          </button>
        </div>
        <div className="mb-4 flex justify-between font-kid text-[10px] font-bold text-starlight/50 uppercase tracking-widest px-2">
          <span>Core: <span className="font-mono text-neon-mint text-sm">RM {balance.toFixed(2)}</span></span>
          <span>Generating: <span className="font-mono text-nebula-pink text-sm">RM {invested.toFixed(2)}</span></span>
        </div>
        <MoneyKeypad
          key={dir}
          min={0.5}
          max={dir === "in" ? balance : invested}
          confirmLabel={dir === "in" ? "Lock Energy" : "Recall Energy"}
          confirmBg={dir === "in" ? "bg-nebula-pink" : "bg-nova-red"}
          onConfirm={dir === "in" ? deposit : withdraw}
        />
      </Card>
    </AppShell>
  );
}
