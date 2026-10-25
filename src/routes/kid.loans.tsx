import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { edgeKidRepayLoan, edgeKidRequestLoan } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { SignaturePad } from "@/features/loans/components/SignaturePad";
import { exportLoanPdf } from "@/features/loans/utils/loan-pdf";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDate, formatRM } from "@/lib/format";
import { computeQardPayout } from "@/lib/qard";
import { useMoneyAction } from "@/hooks/use-money-action";
import { Money } from "@/features/privacy";

export const Route = createFileRoute("/kid/loans")({
  head: () => ({ meta: [{ title: "My Loans | Centsibility" }] }),
  component: KidLoans,
});

function KidLoans() {
  const { data, loading, error, refresh } = useKidData();
  const [active, setActive] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"active" | "closed">("active");

  const [requesting, setRequesting] = useState(false);
  const [reqAmt, setReqAmt] = useState<number | null>(null);
  const [reqReason, setReqReason] = useState("");
  const [dueDays, setDueDays] = useState(14);
  const [signature, setSignature] = useState<string | null>(null);
  const [signStep, setSignStep] = useState(false);

  const { busy, run } = useMoneyAction();

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "8rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
      </div>
    );
  }
  const code = getKidSession()?.code;
  const kidBalance = Number(data.kid.balance);

  const activeLoans = data.loans.filter(
    (l: (typeof data.loans)[number]) => l.status === "active",
  );
  const closedLoans = data.loans.filter(
    (l: (typeof data.loans)[number]) => l.status === "repaid",
  );
  const totalOutstanding = activeLoans.reduce(
    (acc: number, l: (typeof data.loans)[number]) =>
      acc + (Number(l.amount) - Number(l.repaid)),
    0,
  );

  const repay = async (loanId: string, amount: number) => {
    if (!code) return;
    const currentLoan = data.loans.find(
      (l: (typeof data.loans)[number]) => l.id === loanId,
    );
    const prevRemaining = currentLoan
      ? Math.max(0, Number(currentLoan.amount) - Number(currentLoan.repaid))
      : amount;
    await run(() => edgeKidRepayLoan({ code, loanId, amount }), {
      success: (res) => {
        const remaining = Math.max(0, prevRemaining - Number(res.paid));
        return res.fullyRepaid
          ? "Loan fully repaid!"
          : `${formatRM(res.paid)} paid back. ${formatRM(remaining)} left`; // privacy-ok: toast
      },
      failure: "Repayment didn't go through",
      onSuccess: () => {
        setActive(null);
      },
      refresh,
    });
  };

  const submitRequest = async () => {
    if (!code || !reqAmt) return;
    if (!reqReason.trim()) {
      toast.error("Why do you need this loan?");
      return;
    }
    if (!signature) {
      toast.error("Please sign the agreement");
      return;
    }
    await run(
      () =>
        edgeKidRequestLoan({
          code,
          amount: reqAmt,
          reason: reqReason.trim(),
          signature,
          dueDays,
        }),
      {
        success: "Loan request sent for approval",
        failure: "Loan request didn't go through",
        onSuccess: () => {
          setRequesting(false);
          setSignStep(false);
          setReqReason("");
          setSignature(null);
          setReqAmt(null);
        },
        refresh,
      },
    );
  };

  return (
    <div className="space-y-4 pb-12">
      <section className="deposit-hero" aria-label="Loan balance">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Loan balance</p>
          <p className="deposit-hero__amount tabular-nums">
            <Money amount={totalOutstanding} />
          </p>
          <p
            className="deposit-hero__link"
            style={{ cursor: "default", textDecoration: "none" }}
          >
            Trust {data.kid.trust_score} · 0% interest (Halal)
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="loan" size={32} color="#fff" />
        </div>
      </section>

      <div className="segment-tabs" role="tablist" aria-label="Loan status">
        <button
          type="button"
          role="tab"
          id="tab-loans-active"
          aria-selected={selectedTab === "active"}
          aria-controls="panel-loans-active"
          className="segment-tab"
          onClick={() => setSelectedTab("active")}
        >
          Active ({activeLoans.length})
        </button>
        <button
          type="button"
          role="tab"
          id="tab-loans-closed"
          aria-selected={selectedTab === "closed"}
          aria-controls="panel-loans-closed"
          className="segment-tab"
          onClick={() => setSelectedTab("closed")}
        >
          Closed ({closedLoans.length})
        </button>
      </div>

      {selectedTab === "active" && !requesting && (
        <article className="financing-promo">
          <div className="financing-promo__art">
            <span className="inline-flex h-6 items-center rounded-full bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--action-text)]">
              Interest free
            </span>
            <AppIcon name="handshake" size={36} strokeWidth={1.5} color="var(--action)" />
          </div>
          <div className="financing-promo__body">
            <h2 className="text-base font-bold text-[var(--ink)] m-0">
              Qard Hasan loan
            </h2>
            <p className="text-sm text-[var(--text-2)] mt-1 mb-4 leading-relaxed">Interest-free support anytime.</p><details className="short-details text-xs"><summary>Details</summary><p className="text-sm text-[var(--text-2)] mt-1 mb-4 leading-relaxed">Repay on schedule to grow your trust score.</p></details>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setRequesting(true);
                setSignStep(false);
                setReqAmt(null);
              }}
              className="text-xs font-bold"
            >
              <AppIcon name="plus" size={14} /> Ask for a loan
            </Button>
          </div>
        </article>
      )}

      {/* Loan Application Flow */}
      {requesting && (
        <Card
          variant="default"
          className="p-5 sm:p-6 space-y-4 border-2 border-[var(--primary)]/20 shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center shrink-0">
              <AppIcon name="agreement" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--ink)]">
                Qard Hasan Agreement
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">Signing promises to repay your interest-free loan.</p>
            </div>
          </div>

          {!signStep ? (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                Select loan amount (Min. RM10.00 to Max RM500.00)
              </div>
              <MoneyKeypad
                min={10.0}
                max={500}
                confirmLabel="Next: add details"
                onConfirm={(amt) => {
                  setReqAmt(amt);
                  setSignStep(true);
                }}
              />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Summary Card */}
              {(() => {
                const qard = computeQardPayout(reqAmt!);
                return (
                  <Card
                    variant="soft"
                    className="p-4 space-y-2 border border-[var(--border)]"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Requested Amount
                      </span>
                      <strong className="text-sm font-bold text-[var(--ink)] tabular-nums">
                        {formatRM(reqAmt!)} {/* privacy-ok: typing */}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Interest
                      </span>
                      <strong className="text-sm font-bold text-[var(--success-text)]">
                        RM0.00 (Halal)
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Admin fee
                      </span>
                      <strong className="text-sm font-semibold text-[var(--ink)] tabular-nums">
                        {formatRM(qard.adminFee)} {/* privacy-ok: typing */}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-[var(--border)]">
                      <span className="font-semibold text-[var(--ink)]">
                        You receive
                      </span>
                      <strong className="text-base font-extrabold text-[var(--success-text)] tabular-nums">
                        {formatRM(qard.payout)} {/* privacy-ok: typing */}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[var(--ink)]">
                        You repay
                      </span>
                      <strong className="text-sm font-bold text-[var(--primary-text)] tabular-nums">
                        {formatRM(reqAmt!)} {/* privacy-ok: typing */}
                      </strong>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSignStep(false)}
                      className="mt-1 text-xs"
                    >
                      <AppIcon name="back" size={14} /> Change Amount
                    </Button>
                  </Card>
                );
              })()}

              {/* Purpose Input */}
              <Input
                label="Reason for loan"
                id="loan-reason"
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                maxLength={200}
                placeholder="E.g. School project supplies, art notebook"
              />

              {/* Repay Duration Selector */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-2">
                  Repayment Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[7, 14, 30, 60].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={dueDays === d ? "selected" : "secondary"}
                      size="sm"
                      onClick={() => setDueDays(d)}
                      className="justify-center"
                    >
                      {d} days
                    </Button>
                  ))}
                </div>
              </div>

              {/* Signature Capture */}
              <div>
                <label className="block text-xs font-semibold text-[var(--ink)] mb-2">
                  Sign Digitally Below
                </label>
                <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--surface)] p-2">
                  <SignaturePad onChange={setSignature} />
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={submitRequest}
                disabled={busy}
                className="w-full justify-center text-sm font-bold"
              >
                {busy ? "Submitting..." : "Sign Agreement & Submit to Parent"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Active & Past Loans filtered by tab */}
      <div
        className="space-y-3"
        role="tabpanel"
        id={
          selectedTab === "active" ? "panel-loans-active" : "panel-loans-closed"
        }
        aria-labelledby={
          selectedTab === "active" ? "tab-loans-active" : "tab-loans-closed"
        }
      >
        <SectionTitle>
          {selectedTab === "active" ? "Active loans" : "Settled loans"}
        </SectionTitle>
        {(selectedTab === "active" ? activeLoans : closedLoans).length === 0 ? (
          <Card
            variant="soft"
            className="p-8 text-center text-sm text-[var(--text-muted)]"
          >
            {selectedTab === "active"
              ? "No active loans. Tap 'Ask for a loan' above to request interest-free support."
              : "No closed loans yet. Fully repaid loans will be recorded here."}
          </Card>
        ) : (
          <div className="space-y-3">
            {(selectedTab === "active" ? activeLoans : closedLoans).map(
              (l: (typeof data.loans)[number]) => {
                const remaining = Number(l.amount) - Number(l.repaid);
                const overdue =
                  l.status === "active" && new Date(l.due_date) < new Date();
                return (
                  <Card
                    key={l.id}
                    variant="default"
                    className={`p-5 rounded-2xl border transition-all duration-150 ${
                      overdue
                        ? "border-[var(--error)]/40 bg-[var(--error-soft)]/20"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-[var(--ink)]">
                            {l.reason || "Qard Hasan Loan"}
                          </h4>
                          {l.status === "repaid" ? (
                            <Badge variant="success">Repaid</Badge>
                          ) : overdue ? (
                            <Badge variant="error">Overdue</Badge>
                          ) : (
                            <Badge variant="warning">Active</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          Due {formatDate(l.due_date)}
                        </p>
                      </div>

                      <div className="text-right shrink-0 whitespace-nowrap">
                        <span className="text-base font-bold tabular-nums text-[var(--ink)] block">
                          <Money amount={remaining} />
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {" "}
                          of <Money amount={Number(l.amount)} />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[var(--border)]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportLoanPdf({ ...l, kidName: data.kid.name })
                        }
                        className="flex-1 justify-center text-xs"
                        aria-label={`Download loan ${l.status === "repaid" ? "receipt" : "agreement"} PDF for ${l.reason || "Qard loan"}`}
                      >
                        <AppIcon name="pdf" size={14} />
                        {l.status === "repaid"
                          ? "Receipt (PDF)"
                          : "Agreement (PDF)"}
                      </Button>

                      {l.status === "active" && (
                        <Button
                          type="button"
                          variant={active === l.id ? "secondary" : "primary"}
                          size="sm"
                          onClick={() =>
                            setActive(active === l.id ? null : l.id)
                          }
                          className="flex-1 justify-center text-xs"
                        >
                          {active === l.id ? "Cancel" : "Repay Now"}
                        </Button>
                      )}
                    </div>

                    {l.status === "active" && active === l.id && (
                      <div className="pt-3 mt-3 border-t border-dashed border-[var(--border)] space-y-3">
                        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <span>
                            Wallet Balance:{" "}
                            <strong><Money amount={kidBalance} /></strong>
                          </span>
                          <span>
                            Outstanding: <strong><Money amount={remaining} /></strong>
                          </span>
                        </div>
                        <MoneyKeypad
                          key={l.id}
                          min={0.5}
                          max={Math.min(remaining, kidBalance)}
                          confirmLabel="Confirm Repayment"
                          busy={busy}
                          onConfirm={(amt) => repay(l.id, amt)}
                          onCancel={() => setActive(null)}
                        />
                      </div>
                    )}
                  </Card>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
