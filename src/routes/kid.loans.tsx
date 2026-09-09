import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidRepayLoan, edgeKidRequestLoan } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { SignaturePad } from "@/components/SignaturePad";
import { exportLoanPdf } from "@/lib/loan-pdf";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { toast } from "sonner";
import {
  Handshake,
  Scroll,
  CheckCircle,
  FilePdf,
  ShieldCheck,
  Plus,
  CaretLeft,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/kid/loans")({
  head: () => ({ meta: [{ title: "My Loans — Centsibility" }] }),
  component: KidLoans,
});

/** Fees charged on every approved loan */
const SERVICE_FEE = 0.0;
const PROCESSING_FEE = 0.0;
const TOTAL_FEES = 0.0;

function KidLoans() {
  const { data, loading, refresh } = useKidData();
  const [active, setActive] = useState<string | null>(null);

  // Request flow
  const [requesting, setRequesting] = useState(false);
  const [reqAmt, setReqAmt] = useState<number | null>(null);
  const [reqReason, setReqReason] = useState("");
  const [dueDays, setDueDays] = useState(14);
  const [signature, setSignature] = useState<string | null>(null);
  const [signStep, setSignStep] = useState(false); // true = show signature after amount entry

  if (loading || !data)
    return (
      <AppShell mode="kid">
        <Card>Loading…</Card>
      </AppShell>
    );
  const code = getKidSession()?.code;
  const kidBalance = Number(data.kid.balance);

  const repay = async (loanId: string, amount: number) => {
    if (!code) return;
    try {
      const res = await edgeKidRepayLoan({ code, loanId, amount });
      if (res.fullyRepaid)
        toast.success(
          res.trustDelta > 0
            ? `Alhamdulillah! Trust +${res.trustDelta}`
            : `Repaid late. Trust ${res.trustDelta}`,
        );
      else toast.success("Partial repayment recorded");
      setActive(null);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
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
    try {
      await edgeKidRequestLoan({
        code, amount: reqAmt, reason: reqReason.trim(), signature, dueDays,
      });
      toast.success("Loan request signed & sent to parent");
      setRequesting(false);
      setSignStep(false);
      setReqReason("");
      setSignature(null);
      setReqAmt(null);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  return (
    <AppShell mode="kid">
      <h1 className="font-display text-2xl text-charcoal flex items-center gap-2">
        <Handshake weight="duotone" className="w-8 h-8 text-charcoal" />
        My Loans
      </h1>
      <p className="font-body text-sm text-slate-parent">
        Qard = interest-free. Pay on time to grow your trust score.
      </p>

      <Card className="mt-4 bg-cream border border-border shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-kid text-xs font-bold text-pewter uppercase flex items-center gap-1.5">
              <ShieldCheck weight="duotone" className="w-4 h-4 text-emerald-halal" /> Trust Score
            </div>
            <div className="font-mono text-3xl font-bold text-charcoal mt-0.5">
              {data.kid.trust_score}
            </div>
          </div>
          <button
            onClick={() => {
              setRequesting(!requesting);
              setSignStep(false);
              setReqAmt(null);
            }}
            aria-label={requesting ? "Cancel loan request" : "Request a new loan"}
            className="btn-press rounded-2xl bg-emerald-halal px-4 py-2.5 font-kid font-bold text-white shadow-soft flex items-center gap-1.5"
          >
            {requesting ? (
              "Cancel"
            ) : (
              <>
                <Plus weight="bold" className="w-4 h-4" /> New loan
              </>
            )}
          </button>
        </div>
      </Card>

      {requesting && (
        <Card className="mt-4 border border-emerald-halal shadow-soft">
          <h3 className="font-kid font-bold text-charcoal flex items-center gap-2">
            <Scroll weight="duotone" className="w-5 h-5 text-emerald-halal" />
            Qard Hasan Loan Agreement
          </h3>
          <p className="font-body text-[11px] text-pewter mt-1">
            An interest-free loan. By signing below, you promise to repay the full amount by the due
            date.
          </p>

          {!signStep ? (
            /* ── Step 1: Amount entry ─────────────────────────── */
            <div className="mt-4">
              <p className="font-kid text-xs font-bold uppercase text-pewter mb-1">Loan amount</p>
              <p className="font-body text-[10px] text-slate-parent mb-2">
                Min. RM 1.00 — Qard Hasan (interest-free and fee-free) loan.
              </p>
              <MoneyKeypad
                min={1.0}
                max={500}
                confirmLabel="Next: Details →"
                confirmBg="bg-emerald-halal"
                onConfirm={(amt) => {
                  setReqAmt(amt);
                  setSignStep(true);
                }}
              />
            </div>
          ) : (
            /* ── Step 2: Details + signature ─────────────────── */
            <div className="mt-4 space-y-3">
              {/* Amount recap */}
              <div className="rounded-2xl bg-cream p-3 space-y-1">
                <div className="flex justify-between font-body text-xs text-pewter">
                  <span>Loan requested (Qard Hasan)</span>
                  <span className="font-mono font-bold text-charcoal">RM {reqAmt!.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-1 mt-1 flex justify-between font-kid text-sm font-bold text-charcoal">
                  <span>No admin fees</span>
                  <span className="font-mono text-emerald-halal">RM 0.00</span>
                </div>
                <div className="flex justify-between font-body text-[10px] text-pewter">
                  <span>You repay (total)</span>
                  <span className="font-mono">RM {reqAmt!.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => setSignStep(false)}
                  className="btn-press mt-2 flex items-center gap-1 text-[11px] font-bold text-pewter"
                >
                  <CaretLeft weight="bold" className="w-3.5 h-3.5" /> Change amount
                </button>
              </div>

              <div>
                <label className="font-kid text-xs font-bold uppercase text-pewter">
                  Reason for loan
                </label>
                <input
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. To buy a book"
                  className="mt-1 w-full rounded-2xl border border-border bg-cream px-4 py-3 font-body text-sm"
                />
              </div>
              <div>
                <label className="font-kid text-xs font-bold uppercase text-pewter">Repay in</label>
                <div className="mt-1 flex gap-2">
                  {[7, 14, 30, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDueDays(d)}
                      className={`btn-press flex-1 rounded-[1.25rem] py-2.5 font-kid text-xs font-bold transition ${dueDays === d ? "bg-charcoal text-white shadow-soft" : "bg-cream text-charcoal border border-border shadow-sm"}`}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-kid text-xs font-bold uppercase text-pewter">
                  Your signature
                </label>
                <div className="mt-1">
                  <SignaturePad onChange={setSignature} />
                </div>
              </div>
              <button
                onClick={submitRequest}
                className="btn-press w-full rounded-[1.25rem] bg-emerald-halal py-3.5 font-kid font-bold text-white shadow-soft"
              >
                Sign & send to parent
              </button>
            </div>
          )}
        </Card>
      )}

      <SectionTitle>My Loans</SectionTitle>
      <div className="space-y-3">
        {data.loans.length === 0 && <Card className="text-center text-pewter">No loans yet.</Card>}
        {data.loans.map((l: (typeof data.loans)[number]) => {
          const remaining = Number(l.amount) - Number(l.repaid);
          const overdue = l.status === "active" && new Date(l.due_date) < new Date();
          return (
            <Card key={l.id} className={overdue ? "border-2 border-coral" : ""}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-kid font-bold text-charcoal text-sm">
                    {l.reason || "Qard loan"}
                  </div>
                  <div className="font-body text-[11px] text-pewter mt-1 flex items-center gap-1">
                    Due {l.due_date} ·{" "}
                    {l.status === "repaid" ? (
                      <span className="flex items-center gap-1 text-emerald-halal font-bold">
                        <CheckCircle weight="bold" className="w-3.5 h-3.5" /> Repaid
                      </span>
                    ) : overdue ? (
                      <span className="text-coral font-bold">OVERDUE</span>
                    ) : (
                      "On track"
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-charcoal">RM {remaining.toFixed(2)}</div>
                  <div className="font-body text-[10px] text-pewter">
                    of RM {Number(l.amount).toFixed(2)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => exportLoanPdf({ ...l, kidName: data.kid.name })}
                aria-label={`Download loan ${l.status === "repaid" ? "receipt" : "agreement"} PDF for ${l.reason || "Qard loan"}`}
                className={`btn-press mt-3 flex items-center justify-center gap-1.5 w-full rounded-[1.25rem] py-2 font-kid text-xs font-bold transition ${l.status === "repaid" ? "border border-emerald-halal bg-emerald-halal/10 text-emerald-halal" : "border border-border bg-card text-charcoal shadow-sm"}`}
              >
                {l.status === "repaid" ? (
                  <>
                    <CheckCircle weight="fill" className="w-4 h-4" /> Download receipt (PDF)
                  </>
                ) : (
                  <>
                    <FilePdf weight="duotone" className="w-4 h-4" /> Download agreement (PDF)
                  </>
                )}
              </button>

              {l.status === "active" && (
                <>
                  <button
                    onClick={() => setActive(active === l.id ? null : l.id)}
                    className="btn-press mt-2 w-full rounded-[1.25rem] bg-emerald-halal py-3 font-kid font-bold text-white shadow-soft"
                  >
                    Repay
                  </button>
                  {active === l.id && (
                    <div className="mt-3 rounded-2xl bg-cream p-3">
                      <p className="font-body text-xs text-pewter mb-3">
                        Available balance:{" "}
                        <span className="font-mono font-bold text-charcoal">
                          RM {kidBalance.toFixed(2)}
                        </span>
                      </p>
                      <MoneyKeypad
                        key={l.id}
                        min={0.5}
                        max={Math.min(remaining, kidBalance)}
                        confirmLabel={`Confirm Repayment`}
                        confirmBg="bg-charcoal"
                        onConfirm={(amt) => repay(l.id, amt)}
                        onCancel={() => setActive(null)}
                      />
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
