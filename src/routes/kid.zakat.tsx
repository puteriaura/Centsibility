import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useKidData } from "@/hooks/use-kid-data";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
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
    <>
      <h1>[icon: mosque] Zakat Calculator</h1>
      <p>خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً</p>
      <p>"Take from their wealth a charity." — Quran 9:103</p>

      {/* Info banner */}
      <section>
        <div>
          <span>[icon: info]</span>
          <div>
            <div><strong>How Zakat works</strong></div>
            <p>
              Zakat is due once a year at <strong>2.5%</strong> on your total wealth if it exceeds
              the <strong>Nisab</strong> threshold (≈ RM {NISAB_RM.toLocaleString()} — the value of
              85g of gold). Only wealth held for a full lunar year (hawl) is counted.
            </p>
          </div>
        </div>
      </section>

      {/* Wallet quick-add */}
      <section>
        <label>
          <input
            type="checkbox"
            checked={useWallet}
            onChange={(e) => setUseWallet(e.target.checked)}
            aria-label="Include Centsibility wallet balance"
          />
          <span>
            <strong>Include my Centsibility balance</strong>
            <div>Wallet + Investments = RM {walletBalance.toFixed(2)}</div>
          </span>
        </label>
      </section>

      {/* Assets */}
      <h2>Your Assets (RM)</h2>
      <section>
        {assets.map((a, i) => (
          <div key={a.label}>
            <label>{a.label}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={a.amount}
              onChange={(e) => updateRow(assets, setAssets, i, e.target.value)}
              aria-label={a.label}
            />
          </div>
        ))}
      </section>

      {/* Deductions */}
      <h2>Deductions (RM)</h2>
      <section>
        {deductions.map((d, i) => (
          <div key={d.label}>
            <label>{d.label}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={d.amount}
              onChange={(e) => updateRow(deductions, setDeductions, i, e.target.value)}
              aria-label={d.label}
            />
          </div>
        ))}
      </section>

      {/* Calculate button */}
      <button
        onClick={() => setCalculated(true)}
        aria-label="Calculate Zakat"
      >
        [icon: calculate] Calculate Zakat
      </button>

      {/* Results */}
      {calculated && (
        <section>
          <h3>[icon: chart] Zakat Summary</h3>

          <div>
            <SummaryRow label="Total Assets" value={totalAssets} />
            <SummaryRow label="Total Deductions" value={totalDeductions} negative />
            <div>
              <SummaryRow label="Net Wealth" value={netWealth} bold />
            </div>
            <div>
              <div>Nisab Threshold</div>
              <div>RM {NISAB_RM.toLocaleString()}</div>
              <div>
                {aboveNisab ? "✓ Above Nisab — Zakat is due" : "Below Nisab — no Zakat due"}
              </div>
            </div>
          </div>

          {/* Zakat amount */}
          <div>
            <div>Zakat Due (2.5%)</div>
            <div>RM {zakatDue.toFixed(2)}</div>
            {aboveNisab && (
              <p>This amount purifies your wealth and helps those in need.</p>
            )}
          </div>

          {/* Distribution suggestion */}
          {aboveNisab && zakatDue > 0 && (
            <>
              <h2>Suggested Distribution</h2>
              <div>
                {[
                  {
                    name: "Fuqara (Poor)",
                    icon: "[icon: heart]",
                    pct: 40,
                  },
                  {
                    name: "Masakeen (Needy)",
                    icon: "[icon: house]",
                    pct: 25,
                  },
                  {
                    name: "Fi Sabilillah",
                    icon: "[icon: mosque]",
                    pct: 20,
                  },
                  {
                    name: "Ibnus Sabil",
                    icon: "[icon: suitcase]",
                    pct: 15,
                  },
                ].map((cat) => (
                  <div key={cat.name}>
                    <div>{cat.icon}</div>
                    <div>{cat.name}</div>
                    <div>RM {((zakatDue * cat.pct) / 100).toFixed(2)}</div>
                    <div>{cat.pct}%</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button onClick={reset} aria-label="Reset calculator">
            Reset Calculator
          </button>
        </section>
      )}

      {/* Educational section */}
      <h2>The 8 Recipients of Zakat</h2>
      <section>
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
          <div key={r.en}>
            <div>{r.ar}</div>
            <div>
              <div><strong>{r.en}</strong></div>
              <div>{r.desc}</div>
            </div>
          </div>
        ))}
      </section>

      <p>
        [icon: warning] This calculator is for educational purposes. Consult a qualified scholar for your actual Zakat obligation.
      </p>
    </>
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
    <div>
      <span>{label}</span>
      <span>
        {negative ? "−" : ""}RM {value.toFixed(2)}
      </span>
    </div>
  );
}
