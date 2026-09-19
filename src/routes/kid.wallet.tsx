import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { StatCard, TransactionRow } from "@/components/banking";
import { useKidData } from "@/hooks/use-kid-data";
import {
  edgeKidSadaqah,
  edgeKidInvestSettle,
  edgeKidInvestDeposit,
  edgeKidInvestWithdraw,
  edgeKidRequestApproval,
  edgeKidSetInvestRisk,
} from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { formatTransactionSign } from "@/lib/finance";
import { AppIcon } from "@/components/ui/app-icon";

export const Route = createFileRoute("/kid/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Centsibility" }] }),
  component: KidWallet,
});

type Tab = "deposit" | "withdraw" | "invest" | "sadaqah" | "loan";

function riskLabel(risk: string | undefined) {
  return risk === "very_low"
    ? "Very Low Risk"
    : risk === "low"
      ? "Low Risk"
      : risk === "medium"
        ? "Medium Risk"
        : risk === "high"
          ? "High Risk"
          : risk === "very_high"
            ? "Very High Risk"
            : "Growth";
}

function KidWallet() {
  const { data, loading, refresh } = useKidData();
  const [tab, setTab] = useState<Tab>("deposit");

  useEffect(() => {
    const code = getKidSession()?.code;
    if (!code) return;
    edgeKidInvestSettle({ code })
      .then((r) => {
        if (r.paid > 0) {
          sfx.coin();
          toast.success(`Investment grew by RM${r.paid.toFixed(2)}!`);
        }
        refresh();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "3rem", borderRadius: "999px" }} />
        <Skeleton style={{ height: "14rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const k = data.kid;
  const code = getKidSession()?.code;
  const balance = Number(k.balance);
  const invested = Number(k.invest_balance ?? 0);

  const ask = async (kind: "DEPOSIT" | "WITHDRAWAL", amount: number, reference?: string) => {
    if (!code) return;
    try {
      await edgeKidRequestApproval({ code, kind, amount, reason: reference ?? kind });
      sfx.success();
      toast.success("Sent to parent for approval");
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const sadaqah = async (amount: number) => {
    if (!code) return;
    if (amount > balance) {
      sfx.error();
      toast.error("Not enough balance");
      return;
    }
    try {
      await edgeKidSadaqah({ code, amount });
      sfx.success();
      toast.success("Jazakallah khair!");
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const invest = async (dir: "in" | "out", amount: number) => {
    if (!code) return;
    try {
      if (dir === "in") await edgeKidInvestDeposit({ code, amount });
      else await edgeKidInvestWithdraw({ code, amount });
      sfx.success();
      toast.success(dir === "in" ? "Invested!" : "Moved back to wallet");
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const changeRisk = async (riskKey: string) => {
    if (!code) return;
    try {
      await edgeKidSetInvestRisk({ code, riskAppetite: riskKey });
      toast.success("Risk level updated!");
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "deposit", label: "Deposit", icon: "deposit" },
    { key: "withdraw", label: "Withdraw", icon: "withdraw" },
    { key: "invest", label: "Invest", icon: "invest" },
    { key: "sadaqah", label: "Sadaqah", icon: "sadaqah" },
    { key: "loan", label: "Loan", icon: "loan" },
  ];

  const currentRisk = (k.risk_appetite as string) || "low";
  const totalBalance = balance + invested;
  const activeLoans = data.loans.filter(
    (l: (typeof data.loans)[number]) => l.status === "active",
  );
  const outstanding = activeLoans.reduce(
    (sum: number, l: (typeof data.loans)[number]) =>
      sum + (Number(l.amount) - Number(l.repaid)),
    0,
  );

  const scrollToHistory = () => {
    sfx.tap();
    document.getElementById("wallet-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5 pb-8">
      {/* AEON Deposit-style total balance hero */}
      <section className="deposit-hero" aria-label="Total balance">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Total balance</p>
          <p className="deposit-hero__amount tabular-nums">RM{totalBalance.toFixed(2)}</p>
          <button
            type="button"
            className="deposit-hero__link"
            onClick={() => {
              sfx.tap();
              setTab("deposit");
            }}
          >
            View balance info →
          </button>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="penny" size={40} color="#fff" />
        </div>
      </section>

      {/* History / Goals / Insights quick tiles */}
      <div className="deposit-quick-row" role="navigation" aria-label="Deposit shortcuts">
        <button type="button" className="deposit-quick-tile" onClick={scrollToHistory}>
          <AppIcon name="history" size={22} />
          <span>History</span>
        </button>
        <Link to="/kid/goals" className="deposit-quick-tile" onClick={() => sfx.tap()}>
          <AppIcon name="goal" size={22} />
          <span>Goals</span>
        </Link>
        <Link
          to="/kid/insights"
          className="deposit-quick-tile"
          onClick={() => sfx.tap()}
        >
          <AppIcon name="trend" size={22} />
          <span>Insights</span>
        </Link>
      </div>

      {/* Stacked account cards */}
      <div className="deposit-account-stack">
        <button
          type="button"
          className="deposit-account-card deposit-account-card--pink"
          onClick={() => {
            sfx.tap();
            setTab("deposit");
          }}
        >
          <div className="deposit-account-card__top">
            <div>
              <strong>Main Wallet</strong>
              <p>Spending · Hibah {(Number(k.hibah_rate) * 100).toFixed(0)}%</p>
            </div>
            <span className="deposit-account-card__badge">0% fee</span>
          </div>
          <div className="deposit-account-card__bottom">
            <span>Account balance</span>
            <strong className="tabular-nums">RM{balance.toFixed(2)}</strong>
          </div>
        </button>

        <button
          type="button"
          className="deposit-account-card deposit-account-card--magenta"
          onClick={() => {
            sfx.tap();
            setTab("invest");
          }}
        >
          <div className="deposit-account-card__top">
            <div>
              <strong>Growth Pot</strong>
              <p>{riskLabel(k.risk_appetite as string)} · Halal</p>
            </div>
            <span className="deposit-account-card__badge">Invest</span>
          </div>
          <div className="deposit-account-card__bottom">
            <span>Account balance</span>
            <strong className="tabular-nums">RM{invested.toFixed(2)}</strong>
          </div>
        </button>

        <Link
          to="/kid/loans"
          className="deposit-account-card deposit-account-card--navy"
          onClick={() => sfx.tap()}
        >
          <div className="deposit-account-card__top">
            <div>
              <strong>Qard Hasan</strong>
              <p>{activeLoans.length} active placement(s)</p>
            </div>
            <span className="deposit-account-card__badge">0% interest</span>
          </div>
          <div className="deposit-account-card__bottom">
            <span>Outstanding</span>
            <strong className="tabular-nums">RM{outstanding.toFixed(2)}</strong>
          </div>
        </Link>
      </div>

      {/* Action Tabs with Scrollable Pill Container */}
      <div
        className="tab-pills-container no-scrollbar"
        role="tablist"
        aria-label="Wallet actions"
      >
        {tabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setTab(t.key);
                sfx.tap();
              }}
              className={`tab-pill ${isActive ? "is-active" : ""}`}
            >
              <AppIcon name={t.icon} size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {tab === "deposit" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <AppIcon name="deposit" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">Request Money</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Ask parent to deposit money into your digital savings.
              </p>
            </div>
          </div>
          <MoneyKeypad
            min={0.5}
            max={10000}
            showReference
            confirmLabel="Transmit Request"
            onConfirm={(amt, ref) => ask("DEPOSIT", amt, ref)}
          />
        </Card>
      )}

      {tab === "withdraw" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <AppIcon name="withdraw" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">Withdraw Cash</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Ask parent to convert your digital balance into physical cash.
              </p>
            </div>
          </div>
          <MoneyKeypad
            min={0.5}
            max={balance}
            showReference
            confirmLabel="Transmit Request"
            onConfirm={(amt, ref) => ask("WITHDRAWAL", amt, ref)}
          />
        </Card>
      )}

      {tab === "invest" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <AppIcon name="invest" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">Halal Investment</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Put your money to work with Shariah-compliant growth funds.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block mb-2">
              Risk Appetite
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { key: "very_low", label: "V.Low" },
                { key: "low", label: "Low" },
                { key: "medium", label: "Med" },
                { key: "high", label: "High" },
                { key: "very_high", label: "Max" },
              ].map((r) => {
                const isSelected = currentRisk === r.key;
                return (
                  <Button
                    key={r.key}
                    type="button"
                    variant={isSelected ? "primary" : "secondary"}
                    size="sm"
                    className="w-full text-xs font-bold px-1"
                    onClick={() => changeRisk(r.key)}
                  >
                    {r.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <StatCard
              label="Wallet Balance"
              value={`RM ${balance.toFixed(2)}`}
              icon="wallet"
            />
            <StatCard
              label="Currently Invested"
              value={`RM ${invested.toFixed(2)}`}
              icon="invest"
              subtitle={k.invest_balance && Number(k.invest_balance) > 0 ? "Growing" : undefined}
            />
          </div>

          <InvestKeypad balance={balance} invested={invested} onInvest={invest} />
        </Card>
      )}

      {tab === "sadaqah" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <AppIcon name="sadaqah" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">Give Sadaqah</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                &ldquo;Sadaqah extinguishes sin as water extinguishes fire.&rdquo;
              </p>
            </div>
          </div>
          <MoneyKeypad
            min={0.5}
            max={balance}
            confirmLabel="Give Sadaqah"
            onConfirm={(amt) => sadaqah(amt)}
          />
        </Card>
      )}

      {tab === "loan" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <AppIcon name="loan" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">Qard Hasan (Benevolent Loan)</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Interest-free financial assistance with digital agreement and repayment scheduling.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Trust Score"
              value={String(k.trust_score ?? 100)}
              icon="shield"
            />
            <StatCard
              label="Active Loans"
              value={String(data.loans.filter((l: (typeof data.loans)[number]) => l.status === "active").length)}
              icon="loan"
            />
          </div>

          <Link to="/kid/loans" className="block mt-2">
            <Button variant="outline" className="w-full justify-center">
              Enter Loan Agreement Center →
            </Button>
          </Link>
        </Card>
      )}

      {/* Transaction History Section */}
      <div id="wallet-history" className="space-y-3 scroll-mt-4">
        <SectionTitle>Recent Activity</SectionTitle>
        <Card variant="default" className="p-2 sm:p-3 divide-y divide-[var(--border)]">
          {data.txs.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              No transactions yet. Start by requesting a deposit!
            </div>
          ) : (
            data.txs.map((t: (typeof data.txs)[number]) => {
              const isDebit =
                formatTransactionSign(t.type, t.label) === "-" ||
                ["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type);

              const iconName = t.type.toLowerCase().includes("deposit")
                ? "deposit"
                : t.type.toLowerCase().includes("invest")
                  ? "invest"
                  : t.type.toLowerCase().includes("sadaqah")
                    ? "sadaqah"
                    : t.type.toLowerCase().includes("loan")
                      ? "loan"
                      : "wallet";

              return (
                <TransactionRow
                  key={t.id}
                  title={t.label}
                  subtitle={new Date(t.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  amount={Number(t.amount)}
                  isIncome={!isDebit}
                  icon={iconName}
                />
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}

function InvestKeypad({
  balance,
  invested,
  onInvest,
}: {
  balance: number;
  invested: number;
  onInvest: (dir: "in" | "out", amount: number) => Promise<void>;
}) {
  const [dir, setDir] = useState<"in" | "out">("in");

  return (
    <div className="space-y-3 pt-3 border-t border-[var(--border)]">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={dir === "in" ? "primary" : "secondary"}
          onClick={() => setDir("in")}
          className="w-full justify-center"
        >
          <AppIcon name="plus" size={14} />
          Invest Funds
        </Button>
        <Button
          type="button"
          variant={dir === "out" ? "primary" : "secondary"}
          onClick={() => setDir("out")}
          className="w-full justify-center"
        >
          <AppIcon name="recall" size={14} />
          Recall Funds
        </Button>
      </div>
      <MoneyKeypad
        key={dir}
        min={0.5}
        max={dir === "in" ? balance : invested}
        confirmLabel={dir === "in" ? "Confirm Investment" : "Recall Investment"}
        onConfirm={(amt) => onInvest(dir, amt)}
      />
    </div>
  );
}
