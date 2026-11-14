import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/ui/app-icon";
import { calculateZakat, DEFAULT_NISAB, DEFAULT_ZAKAT_RATE } from "@/lib/math";
import { NISAB } from "@/lib/nisab";
import { Money } from "@/features/privacy/Money";

/**
 * Nisab threshold: approx. value of 85g of gold.
 * Using a simplified RM value for educational purposes.
 */
const NISAB_RM = DEFAULT_NISAB;
const ZAKAT_RATE = DEFAULT_ZAKAT_RATE;

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

export function ZakatSection() {
  const { data, loading, error, refresh } = useKidData();
  const [assets, setAssets] = useState<AssetRow[]>(DEFAULT_ASSETS);
  const [deductions, setDeductions] = useState<AssetRow[]>(DEFAULT_DEDUCTIONS);
  const [useWallet, setUseWallet] = useState(false);
  const [calculated, setCalculated] = useState(false);

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const missingValuation = useWallet && data.investmentsValue === null;
  const walletBalance =
    Number(data.kid.balance) +
    Number((data as any).investmentsValue ?? data.kid.invest_balance ?? 0);

  const totalAssets =
    assets.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) +
    (useWallet ? walletBalance : 0);
  const totalDeductions = deductions.reduce(
    (sum, d) => sum + (parseFloat(d.amount) || 0),
    0,
  );
  const netWealth = Math.max(0, totalAssets - totalDeductions);
  const aboveNisab = netWealth >= NISAB_RM;
  const zakatDue = calculateZakat(netWealth, NISAB_RM, ZAKAT_RATE);

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

  if (missingValuation) return <Card className="p-5 space-y-3"><p role="status">Missing quote. Wallet total and Zakat estimates unavailable.</p><Button type="button" onClick={() => { setUseWallet(false); setCalculated(false); }}>Calculate without wallet</Button></Card>;

  return (
    <div className="space-y-6 pb-12">
      <section
        className="deposit-hero deposit-hero--amber"
        aria-label="Zakat calculator"
      >
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Estimated zakat due</p>
          <p className="deposit-hero__amount tabular-nums">
            {calculated && aboveNisab ? (
              <Money amount={missingValuation ? null : zakatDue} />
            ) : (
              <Money amount={0} />
            )}
          </p>
          <p
            className="m-0 text-sm leading-snug"
          >
            Nisab RM{NISAB_RM.toLocaleString("en-MY", { minimumFractionDigits: 2 })} (<a className="text-inherit underline" href={NISAB.source}>PPZ-MAIWP, {NISAB.checkedOn}</a>). Your state’s figure may differ.
          </p>
          <p className="m-0 text-sm">Rate {(ZAKAT_RATE * 100).toFixed(1)}%
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="mosque" size={32} color="#fff" />
        </div>
      </section>

      <details className="short-details p-3 rounded-xl bg-[var(--surface-pink)] border border-[var(--primary-soft)] text-center">
        <summary className="font-bold">Details</summary>
        <p className="text-sm font-bold text-[var(--primary-text)] m-0">
          &ldquo;Take from their wealth a charity by which you purify
          them.&rdquo;
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
          Quran 9:103
        </p>
      </details>

      {/* Info Banner */}
      <Card
        variant="soft"
        className="p-4 sm:p-5 flex items-start gap-3 border border-[var(--border)]"
      >
        <div className="w-9 h-9 rounded-xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center shrink-0 mt-0.5">
          <AppIcon name="info" size={18} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--ink)] m-0">
            How Zakat on Wealth Works
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed mb-0">
            Due each lunar year, at 2.5%, above Nisab.
          </p>
          <details className="short-details text-xs"><summary>Details</summary><p>Nisab approximates 85g gold: RM{NISAB_RM.toLocaleString()}.</p></details>
        </div>
      </Card>

      {/* Wallet balance quick-add toggle */}
      <Card variant="default" className="p-4 border border-[var(--border)]">
        <label className="flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
          <span className="relative inline-flex items-center justify-center w-11 h-11 shrink-0">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Include Centsibility wallet balance"
            />
            <span
              aria-hidden="true"
              className="w-5 h-5 rounded border border-[var(--border-strong)] bg-[var(--surface)] flex items-center justify-center peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] transition-colors"
            >
              {useWallet && <AppIcon name="check" size={14} color="#ffffff" />}
            </span>
          </span>
          <div className="text-xs sm:text-sm">
            <strong className="text-[var(--ink)] block">
              Include my Centsibility balance
            </strong>
            <span className="text-[var(--text-secondary)]">
              Wallet + Investment Pool ={" "}
              <strong className="text-[var(--primary-text)] tabular-nums">
                <Money amount={missingValuation ? null : walletBalance} />
              </strong>
            </span>
          </div>
        </label>
      </Card>

      {/* Assets Form */}
      <div className="space-y-3">
        <SectionTitle>Your Assets (RM)</SectionTitle>
        <Card
          variant="default"
          className="p-4 sm:p-5 space-y-3 border border-[var(--border)]"
        >
          {assets.map((a, i) => (
            <div key={a.label} className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--ink)]">
                {a.label}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={a.amount}
                onChange={(e) =>
                  updateRow(assets, setAssets, i, e.target.value)
                }
                aria-label={a.label}
                className="w-full min-h-[48px] px-3.5 py-2 text-base text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none"
              />
            </div>
          ))}
        </Card>
      </div>

      {/* Deductions Form */}
      <div className="space-y-3">
        <SectionTitle>Deductions & Debts (RM)</SectionTitle>
        <Card
          variant="default"
          className="p-4 sm:p-5 space-y-3 border border-[var(--border)]"
        >
          {deductions.map((d, i) => (
            <div key={d.label} className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--ink)]">
                {d.label}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={d.amount}
                onChange={(e) =>
                  updateRow(deductions, setDeductions, i, e.target.value)
                }
                aria-label={d.label}
                className="w-full min-h-[48px] px-3.5 py-2 text-base text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none"
              />
            </div>
          ))}
        </Card>
      </div>

      {/* Calculate Button */}
      <Button
        type="button"
        variant="primary"
        onClick={() => setCalculated(true)}
        className="w-full justify-center text-sm font-bold min-h-[48px]"
        aria-label="Calculate Zakat"
      >
        <AppIcon name="calculator" size={18} />
        Calculate Zakat Obligation
      </Button>

      {/* Calculation Results Card */}
      {calculated && (
        <Card
          variant="default"
          className="p-5 sm:p-6 space-y-4 border-2 border-[var(--primary)]/20 shadow-md"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <AppIcon name="chart" size={20} color="var(--primary)" />
              Zakat Calculation Summary
            </h3>
            {aboveNisab ? (
              <Badge variant="brand">Above Nisab</Badge>
            ) : (
              <Badge variant="default">Below Nisab</Badge>
            )}
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            <SummaryRow label="Total Qualifying Assets" value={totalAssets} />
            <SummaryRow
              label="Total Deductions / Debts"
              value={totalDeductions}
              negative
            />
            <div className="pt-2 border-t border-[var(--border)]">
              <SummaryRow label="Net Zakatable Wealth" value={netWealth} bold />
            </div>
            <div className="flex items-center justify-between pt-1 text-xs text-[var(--text-secondary)]">
              <span>Nisab Threshold (85g Gold)</span>
              <span className="font-semibold tabular-nums">
                RM{NISAB_RM.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Amount Due Callout */}
          <div className="p-4 rounded-xl bg-[var(--surface-pink)] border border-[var(--primary-soft)] text-center space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)] block">
              Zakat due (2.5%)
            </span>
            <div className="text-3xl font-extrabold text-[var(--primary-text)] tabular-nums">
              <Money amount={missingValuation ? null : zakatDue} />
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {missingValuation ? "Missing quote. Wealth and Zakat estimates unavailable." : aboveNisab
                ? "This supports eligible recipients in your community."
                : "Below Nisab; no Zakat is due now."}
            </p>
          </div>

          {/* Distribution Suggestions */}
          {!missingValuation && aboveNisab && zakatDue > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[var(--ink)]">
                Suggested categories
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "Fuqara (Poor)", icon: "heart", pct: 40 },
                  { name: "Masakeen (Needy)", icon: "house", pct: 25 },
                  { name: "Fi Sabilillah", icon: "mosque", pct: 20 },
                  { name: "Ibnus Sabil (Travelers)", icon: "trip", pct: 15 },
                ].map((cat) => (
                  <div
                    key={cat.name}
                    className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <AppIcon
                        name={cat.icon}
                        size={14}
                        color="var(--primary)"
                      />
                      <span className="text-[11px] text-[var(--text-muted)] font-semibold">
                        {cat.pct}%
                      </span>
                    </div>
                    <strong className="block text-[var(--ink)] leading-snug">
                      {cat.name}
                    </strong>
                    <span className="text-xs font-bold text-[var(--primary-text)] tabular-nums">
                      <Money amount={(zakatDue * cat.pct) / 100} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={reset}
            className="w-full justify-center text-xs"
          >
            Reset Calculator
          </Button>
        </Card>
      )}

      {/* Educational 8 Recipients */}
      <div className="space-y-3">
        <SectionTitle>The 8 Beneficiaries of Zakat (Asnaf)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              en: "The Poor (Fuqara)",
              desc: "People well below the basic poverty threshold.",
            },
            {
              en: "The Needy (Masakeen)",
              desc: "People whose income cannot cover daily necessities.",
            },
            {
              en: "Zakat Administrators",
              desc: "Appointed to collect, manage and distribute Zakat funds.",
            },
            {
              en: "New Muslims / Reconciled",
              desc: "Those whose hearts are being supported and welcomed.",
            },
            {
              en: "Freeing Captives",
              desc: "Liberating individuals from human bondage or oppression.",
            },
            {
              en: "Debtors (Gharimin)",
              desc: "People with overwhelming debt for basic survival.",
            },
            {
              en: "In the Cause of Allah",
              desc: "Welfare and community advancement for the public good.",
            },
            {
              en: "Stranded Wayfarers",
              desc: "Stranded travelers unable to access their resources.",
            },
          ].map((r) => (
            <Card
              key={r.en}
              variant="default"
              className="p-3.5 rounded-xl border border-[var(--border)]"
            >
              <strong className="text-xs font-bold text-[var(--ink)] block mb-1">
                {r.en}
              </strong>
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                {r.desc}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center flex items-center justify-center gap-1">
        <AppIcon name="shield" size={14} />
        Educational calculator for interactive learning.
      </p>
    </div>
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
    <div
      className={`flex items-center justify-between ${bold ? "font-bold text-[var(--ink)]" : "text-[var(--text-secondary)]"}`}
    >
      <span>{label}</span>
      <span
        className={`tabular-nums ${bold ? "text-base text-[var(--ink)]" : ""}`}
      >
        <Money amount={negative ? -value : value} />
      </span>
    </div>
  );
}
