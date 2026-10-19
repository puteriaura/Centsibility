import { edgeKidRequestApproval } from "@/lib/edge";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { StatCard, TransactionRow } from "@/components/banking";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { getKidSession } from "@/lib/kid-session";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { getBalanceSummary, isWalletTransaction } from "@/lib/finance";
import { PennyMascot } from "@/components/PennyMascot";
import { AppIcon } from "@/components/ui/app-icon";
import { formatDate, formatRM } from "@/lib/format";
import { transactionTitle, transactionTypeLabel } from "@/lib/labels";
import { useMoneyAction } from "@/hooks/use-money-action";
import { Money } from "@/features/privacy";

export const Route = createFileRoute("/kid/wallet")({
  head: () => ({ meta: [{ title: "Wallet | Centsibility" }] }),
  component: KidWallet,
});

type Tab = "deposit" | "withdraw" | "loan";

function KidWallet() {
  const { data, loading, error, refresh } = useKidData();
  const { busy, run } = useMoneyAction();
  const [tab, setTab] = useState<Tab | null>(null);

  if (!data && error) return <KidLoadError onRetry={refresh} />;
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

  const ask = async (
    kind: "DEPOSIT" | "WITHDRAWAL",
    amount: number,
    reference?: string,
  ) => {
    if (!code) return;
    const actionWord = kind === "DEPOSIT" ? "Deposit" : "Withdrawal";
    await run(
      () =>
        edgeKidRequestApproval({
          code,
          kind,
          amount,
          reason:
            reference ||
            (kind === "DEPOSIT" ? "Deposit request" : "Withdrawal request"),
        }),
      {
        success: `${actionWord} request for ${formatRM(amount)} sent for approval`, // privacy-ok: toast
        failure: `${actionWord} request didn't go through`,
        refresh,
      },
    );
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "deposit", label: "Add money", icon: "deposit" },
    { key: "withdraw", label: "Cash out", icon: "withdraw" },
    { key: "loan", label: "Borrow", icon: "loan" },
  ];

  const balanceSummary = getBalanceSummary(k, data.goals, data.loans);

  const activeLoans = data.loans.filter(
    (l: (typeof data.loans)[number]) => l.status === "active",
  );
  const outstanding = activeLoans.reduce(
    (sum: number, l: (typeof data.loans)[number]) =>
      sum + (Number(l.amount) - Number(l.repaid)),
    0,
  );

  return (
    <div className="space-y-5 pb-8">
      <div className="deposit-account-stack">
        <button
          type="button"
          className="deposit-account-card"
          onClick={() => {
            setTab("deposit");
            document
              .getElementById("wallet-actions")
              ?.scrollIntoView({ block: "start" });
          }}
        >
          <span className="account-icon">
            <AppIcon name="wallet" size={24} />
          </span>
          <span className="account-copy">
            <span>Spending</span>
            <strong>
              <Money amount={balance} />
            </strong>
            <small>
              Available to spend · Hibah{" "}
              {(Number(k.hibah_rate) * 100).toFixed(0)}%
            </small>
          </span>
          <AppIcon name="chevron" size={20} />
        </button>
        <Link
          to="/kid/goals"
          className="deposit-account-card"
          onClick={() => sfx.tap()}
        >
          <span className="account-icon account-icon--saving">
            <AppIcon name="save" size={24} />
          </span>
          <span className="account-copy">
            <span>Tabung</span>
            <strong>
              <Money amount={balanceSummary.tabung} />
            </strong>
            <small>
              {data.goals.length} savings goal
              {data.goals.length === 1 ? "" : "s"}
            </small>
          </span>
          <AppIcon name="chevron" size={20} />
        </Link>
        {activeLoans.length > 0 && (
          <Link
            to="/kid/loans"
            className="deposit-account-card"
            onClick={() => sfx.tap()}
          >
            <span className="account-icon account-icon--loan">
              <AppIcon name="loan" size={24} />
            </span>
            <span className="account-copy">
              <span>Qard Hasan</span>
              <strong>
                <Money amount={outstanding} />
              </strong>
              <small>
                Outstanding borrowing · {activeLoans.length} active loan
                {activeLoans.length === 1 ? "" : "s"}
              </small>
            </span>
            <AppIcon name="chevron" size={20} />
          </Link>
        )}
      </div>
      <SectionTitle>Explore more</SectionTitle>
      <section className="paper-guidance" aria-label="Savings guidance">
        <div className="paper-guidance__body">
          <h3>Grow your savings</h3>
          <p>Give your next goal a place to grow.</p>
          <Link to="/kid/goals">Explore Tabung →</Link>
        </div>
        <PennyMascot state="encouraging" size={80} />
      </section>
      <nav className="wallet-links" aria-label="Wallet destinations">
        {(
          [
            { to: "/kid/transfer", label: "Transfer", icon: "transfer" },
            { to: "/kid/history", label: "History", icon: "history" },
            { to: "/kid/invest", label: "Investment", icon: "trend" },
            { to: "/kid/card", label: "Card", icon: "card" },
          ] as const
        ).map((item) => (
          <Link key={item.to} to={item.to}>
            <AppIcon name={item.icon} size={20} />
            {item.label}
          </Link>
        ))}
      </nav>
      {/* Action Tabs with Scrollable Pill Container */}
      <div
        id="wallet-actions"
        className="tab-pills-container no-scrollbar"
        role="tablist"
        aria-label="Ask a parent"
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
                setTab((previous) => (previous === t.key ? null : t.key));
                sfx.tap();
              }}
              className={`tab-pill ${isActive ? "is-active" : ""}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {tab === "deposit" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="list-row__icon" aria-hidden="true">
              <AppIcon name="deposit" size={20} />
            </div>
            <div>
              <h3 className="m-0 text-base font-bold text-[var(--ink)]">
                Ask a parent to add money
              </h3>
              <p className="m-0 text-sm text-[var(--text-2)]">
                They approve it before it reaches your wallet.
              </p>
            </div>
          </div>
          <MoneyKeypad
            min={0.5}
            max={10000}
            busy={busy}
            showReference
            confirmLabel="Send request"
            onConfirm={(amt, ref) => ask("DEPOSIT", amt, ref)}
          />
        </Card>
      )}

      {tab === "withdraw" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="list-row__icon" aria-hidden="true">
              <AppIcon name="withdraw" size={20} />
            </div>
            <div>
              <h3 className="m-0 text-base font-bold text-[var(--ink)]">
                Ask a parent for cash
              </h3>
              <p className="m-0 text-sm text-[var(--text-2)]">
                They approve it before any money leaves your wallet.
              </p>
            </div>
          </div>
          <MoneyKeypad
            min={0.5}
            max={balance}
            busy={busy}
            showReference
            confirmLabel="Send request"
            onConfirm={(amt, ref) => ask("WITHDRAWAL", amt, ref)}
          />
        </Card>
      )}

      {tab === "loan" && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="list-row__icon" aria-hidden="true">
              <AppIcon name="loan" size={20} />
            </div>
            <div>
              <h3 className="m-0 text-base font-bold text-[var(--ink)]">
                Qard Hasan loan
              </h3>
              <p className="m-0 text-sm text-[var(--text-2)]">
                Borrow with no interest, sign an agreement, and pay back on a
                schedule.
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
              value={String(
                data.loans.filter(
                  (l: (typeof data.loans)[number]) => l.status === "active",
                ).length,
              )}
              icon="loan"
            />
          </div>

          <Link to="/kid/loans" className="block mt-2">
            <Button variant="secondary" className="w-full justify-center">
              Go to Loans
            </Button>
          </Link>
        </Card>
      )}

      {/* Transaction History Section */}
      <div id="wallet-history" className="space-y-3 scroll-mt-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Recent activity</SectionTitle>
          {data.txs.filter((t: (typeof data.txs)[number]) =>
            isWalletTransaction(t.type),
          ).length > 0 && (
            <Link
              to="/kid/history"
              onClick={() => sfx.tap()}
              className="text-sm font-semibold text-[var(--action-text)] no-underline min-h-[44px] inline-flex items-center"
            >
              See all
            </Link>
          )}
        </div>
        <Card
          variant="default"
          className="p-2 sm:p-3 divide-y divide-[var(--border)]"
        >
          {(() => {
            const walletTxs = data.txs.filter((t: (typeof data.txs)[number]) =>
              isWalletTransaction(t.type),
            );
            if (walletTxs.length === 0) {
              return (
                <div className="py-8 text-center text-sm text-[var(--text-muted)]">
                  No transactions yet. Ask a parent to add money to get started.
                </div>
              );
            }
            return walletTxs.slice(0, 5).map((t: (typeof data.txs)[number]) => {
              const iconName = t.type.toLowerCase().includes("deposit")
                ? "deposit"
                : t.type.toLowerCase().includes("invest")
                  ? "invest"
                  : t.type.toLowerCase().includes("sadaqah")
                    ? "sadaqah"
                    : t.type.toLowerCase().includes("loan")
                      ? "loan"
                      : "wallet";

              const title = transactionTitle(t);
              const typeLabel = transactionTypeLabel(t.type, t.label);
              const subtitle =
                title.trim().toLowerCase() === typeLabel.trim().toLowerCase()
                  ? undefined
                  : typeLabel;

              return (
                <TransactionRow
                  key={t.id}
                  title={title}
                  subtitle={subtitle}
                  date={formatDate(t.created_at)}
                  amount={Number(t.amount)}
                  type={t.type}
                  label={t.label}
                  icon={iconName}
                />
              );
            });
          })()}
        </Card>
      </div>
    </div>
  );
}
