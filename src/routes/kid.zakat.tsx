import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mosque,
  Info,
  Calculator,
  ChartBar,
  HandHeart,
  HouseLine,
  SuitcaseRolling,
  Warning,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/kid/zakat")({
  head: () => ({ meta: [{ title: "Zakat Calculator — Centsibility" }] }),
  component: KidZakat,
});

/**
 * Nisab threshold — approx. value of 85g of gold.
 * Using a simplified RM value for educational purposes.
 */
const NISAB_RM = 22_000;
const ZAKAT_RATE = 0.025; // 2.5%

type AssetRow = { label: string; amount: string };

const DEFAULT_ASSETS: AssetRow[] = [
  { label: "Cash in hand", amount: "" },
  { label: "Bank savings", amount: "" },
  { label: "Gold / Silver value", amount: "" },
  { label: "Investments", amount: "" },
  { label: "Other assets", amount: "" },
];

const DEFAULT_DEDUCTIONS: AssetRow[] = [
  { label: "Debts owed", amount: "" },
  { label: "Expenses due", amount: "" },
];

function KidZakat() {
  const { data, loading } = useKidData();
  const [assets, setAssets] = useState<AssetRow[]>(DEFAULT_ASSETS);
  const [deductions, setDeductions] = useState<AssetRow[]>(DEFAULT_DEDUCTIONS);
  const [useWallet, setUseWallet] = useState(false);
  const [calculated, setCalculated] = useState(false);

  if (loading || !data) {
    return (
      <AppShell mode="kid">
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </AppShell>
    );
  }

  const walletBalance = Number(data.kid.balance) + Number(data.kid.invest_balance ?? 0);

  const totalAssets =
    assets.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) +
    (useWallet ? walletBalance : 0);
  const totalDeductions = deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const netWealth = Math.max(0, totalAssets - totalDeductions);
  const aboveNisab = netWealth >= NISAB_RM;
  const zakatDue = aboveNisab ? netWealth * ZAKAT_RATE : 0;

  const updateRow = (
    list: AssetRow[],
    setter: React.Dispatch<React.SetStateAction<AssetRow[]>>,
    idx: number,
    value: string,
  ) => {
    const next = [...list];
    next[idx] = { ...next[idx], amount: value };
    setter(next);
  };

  const reset = () => {
    setAssets(DEFAULT_ASSETS);
    setDeductions(DEFAULT_DEDUCTIONS);
    setUseWallet(false);
    setCalculated(false);
  };

  return (
    <AppShell mode="kid">
      <h1 className="font-display text-2xl text-charcoal flex items-center gap-2">
        <Mosque weight="duotone" className="w-8 h-8 text-emerald-halal" /> Zakat Calculator
      </h1>
      <p className="font-arabic text-base text-emerald-halal mt-1">
        خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً
      </p>
      <p className="font-body text-sm italic text-slate-parent">
        "Take from their wealth a charity." — Quran 9:103
      </p>

      {/* Info banner */}
      <Card className="mt-4 bg-emerald-halal/5 border border-emerald-halal/30 shadow-sm">
        <div className="flex items-start gap-3">
          <Info weight="duotone" className="w-6 h-6 text-emerald-halal shrink-0 mt-0.5" />
          <div>
            <div className="font-kid text-sm font-bold text-emerald-halal">How Zakat works</div>
            <p className="mt-1 font-body text-xs text-slate-parent leading-relaxed">
              Zakat is due once a year at <strong>2.5%</strong> on your total wealth if it exceeds
              the <strong>Nisab</strong> threshold (≈ RM {NISAB_RM.toLocaleString()} — the value of
              85g of gold). Only wealth held for a full lunar year (hawl) is counted.
            </p>
          </div>
        </div>
      </Card>

      {/* Wallet quick-add */}
      <Card className="mt-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useWallet}
            onChange={(e) => setUseWallet(e.target.checked)}
            className="h-5 w-5 rounded-md accent-emerald-halal"
            aria-label="Include Centsibility wallet balance"
          />
          <div>
            <div className="font-kid text-sm font-bold text-charcoal">
              Include my Centsibility balance
            </div>
            <div className="font-body text-[11px] text-pewter">
              Wallet + Investments = RM {walletBalance.toFixed(2)}
            </div>
          </div>
        </label>
      </Card>

      {/* Assets */}
      <SectionTitle>Your Assets (RM)</SectionTitle>
      <Card>
        <div className="space-y-2">
          {assets.map((a, i) => (
            <div key={a.label} className="flex items-center gap-2">
              <label className="flex-1 font-body text-sm text-charcoal">{a.label}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={a.amount}
                onChange={(e) => updateRow(assets, setAssets, i, e.target.value)}
                aria-label={a.label}
                className="w-28 rounded-2xl border border-border bg-cream px-3 py-2 text-right font-mono text-sm"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Deductions */}
      <SectionTitle>Deductions (RM)</SectionTitle>
      <Card>
        <div className="space-y-2">
          {deductions.map((d, i) => (
            <div key={d.label} className="flex items-center gap-2">
              <label className="flex-1 font-body text-sm text-charcoal">{d.label}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={d.amount}
                onChange={(e) => updateRow(deductions, setDeductions, i, e.target.value)}
                aria-label={d.label}
                className="w-28 rounded-2xl border border-border bg-cream px-3 py-2 text-right font-mono text-sm"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Calculate button */}
      <button
        onClick={() => setCalculated(true)}
        className="btn-press mt-5 w-full rounded-[1.25rem] bg-emerald-halal py-3.5 font-kid font-bold text-white shadow-soft flex items-center justify-center gap-2 transition"
        aria-label="Calculate Zakat"
      >
        <Calculator weight="bold" className="w-5 h-5" /> Calculate Zakat
      </button>

      {/* Results */}
      {calculated && (
        <Card className="mt-5 bg-gradient-to-br from-emerald-halal/10 to-sunny/10 border border-emerald-halal/20 shadow-soft">
          <h3 className="font-kid text-lg font-bold text-charcoal flex items-center justify-center gap-2 mb-4">
            <ChartBar weight="duotone" className="w-6 h-6 text-emerald-halal" /> Zakat Summary
          </h3>

          <div className="space-y-2">
            <SummaryRow label="Total Assets" value={totalAssets} />
            <SummaryRow label="Total Deductions" value={totalDeductions} negative />
            <div className="border-t border-border pt-2">
              <SummaryRow label="Net Wealth" value={netWealth} bold />
            </div>
            <div className="rounded-2xl bg-cream p-3 text-center">
              <div className="font-kid text-xs font-bold text-pewter uppercase tracking-wider">
                Nisab Threshold
              </div>
              <div className="font-mono text-lg font-bold text-charcoal">
                RM {NISAB_RM.toLocaleString()}
              </div>
              <div
                className={`mt-1 font-kid text-xs font-bold ${aboveNisab ? "text-emerald-halal" : "text-pewter"}`}
              >
                {aboveNisab ? "✓ Above Nisab — Zakat is due" : "Below Nisab — no Zakat due"}
              </div>
            </div>
          </div>

          {/* Zakat amount */}
          <div className="mt-4 rounded-3xl bg-gradient-halal p-5 text-center text-[color:var(--warm-white)]">
            <div className="font-body text-xs uppercase tracking-wider opacity-80">
              Zakat Due (2.5%)
            </div>
            <div className="mt-1 font-mono text-4xl font-bold">RM {zakatDue.toFixed(2)}</div>
            {aboveNisab && (
              <p className="mt-2 font-body text-xs opacity-80">
                This amount purifies your wealth and helps those in need.
              </p>
            )}
          </div>

          {/* Distribution suggestion */}
          {aboveNisab && zakatDue > 0 && (
            <>
              <SectionTitle>Suggested Distribution</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    name: "Fuqara (Poor)",
                    icon: <HandHeart weight="duotone" className="w-6 h-6 text-emerald-halal" />,
                    pct: 40,
                  },
                  {
                    name: "Masakeen (Needy)",
                    icon: <HouseLine weight="duotone" className="w-6 h-6 text-coral" />,
                    pct: 25,
                  },
                  {
                    name: "Fi Sabilillah",
                    icon: <Mosque weight="duotone" className="w-6 h-6 text-sky" />,
                    pct: 20,
                  },
                  {
                    name: "Ibnus Sabil",
                    icon: <SuitcaseRolling weight="duotone" className="w-6 h-6 text-sunny" />,
                    pct: 15,
                  },
                ].map((cat) => (
                  <div
                    key={cat.name}
                    className="rounded-[1.25rem] bg-card p-3 text-center shadow-sm border border-border"
                  >
                    <div className="flex justify-center mb-1">{cat.icon}</div>
                    <div className="font-kid text-[10px] font-bold text-charcoal mt-1">
                      {cat.name}
                    </div>
                    <div className="font-mono text-sm font-bold text-emerald-halal mt-0.5">
                      RM {((zakatDue * cat.pct) / 100).toFixed(2)}
                    </div>
                    <div className="font-body text-[9px] text-pewter">{cat.pct}%</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            onClick={reset}
            className="btn-press mt-5 w-full rounded-[1.25rem] bg-cream py-3.5 font-kid font-bold text-charcoal shadow-sm"
            aria-label="Reset calculator"
          >
            Reset Calculator
          </button>
        </Card>
      )}

      {/* Educational section */}
      <SectionTitle>The 8 Recipients of Zakat</SectionTitle>
      <Card>
        <div className="space-y-2">
          {[
            { ar: "الفُقَرَاء", en: "The Poor (Fuqara)", desc: "Those who have less than Nisab" },
            { ar: "المَسَاكِين", en: "The Needy (Masakeen)", desc: "Those in extreme poverty" },
            { ar: "العَامِلِين", en: "Zakat Collectors", desc: "Those who administer Zakat" },
            {
              ar: "المُؤَلَّفَة",
              en: "New Muslims",
              desc: "Those whose hearts are to be reconciled",
            },
            { ar: "الرِّقَاب", en: "Freeing Captives", desc: "To free those in bondage" },
            { ar: "الغَارِمِين", en: "Debtors", desc: "Those burdened by debt" },
            { ar: "فِي سَبِيلِ الله", en: "Fi Sabilillah", desc: "In the path of Allah" },
            { ar: "ابْنِ السَّبِيل", en: "Travelers", desc: "Those stranded on a journey" },
          ].map((r) => (
            <div key={r.en} className="flex items-center gap-3 rounded-2xl bg-cream/50 px-3 py-2">
              <div className="font-arabic text-sm text-emerald-halal shrink-0 w-24 text-right">
                {r.ar}
              </div>
              <div className="min-w-0">
                <div className="font-kid text-xs font-bold text-charcoal">{r.en}</div>
                <div className="font-body text-[10px] text-pewter">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-6 mb-8 flex items-start justify-center gap-1.5 text-center font-body text-[11px] text-pewter">
        <Warning weight="fill" className="w-4 h-4 text-pewter shrink-0 mt-0.5" />
        <span className="flex-1 text-left">
          This calculator is for educational purposes. Consult a qualified scholar for your actual
          Zakat obligation.
        </span>
      </p>
    </AppShell>
  );
}

function SummaryRow({
  label,
  value,
  negative,
  bold,
}: {
  label: string;
  value: number;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`font-body text-sm ${bold ? "font-bold text-charcoal" : "text-slate-parent"}`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-sm ${bold ? "font-bold text-charcoal" : ""} ${negative ? "text-coral" : "text-charcoal"}`}
      >
        {negative ? "−" : ""}RM {value.toFixed(2)}
      </span>
    </div>
  );
}
