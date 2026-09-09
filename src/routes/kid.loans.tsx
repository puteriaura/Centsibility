import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidRepayLoan, edgeKidRequestLoan } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { SignaturePad } from "@/features/loans/components/SignaturePad";
import { exportLoanPdf } from "@/features/loans/utils/loan-pdf";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { toast } from "sonner";

export const Route = createFileRoute("/kid/loans")({
  head: () => ({ meta: [{ title: "My Loans — Centsibility" }] }),
  component: KidLoans,
});

function KidLoans() {
  const { data, loading, refresh } = useKidData();
  const [active, setActive] = useState<string | null>(null);

  // Request flow
  const [requesting, setRequesting] = useState(false);
  const [reqAmt, setReqAmt] = useState<number | null>(null);
  const [reqReason, setReqReason] = useState("");
  const [dueDays, setDueDays] = useState(14);
  const [signature, setSignature] = useState<string | null>(null);
  const [signStep, setSignStep] = useState(false);

  if (loading || !data)
    return (
      <AppShell mode="kid">
        <Card className="wireframe-card">Loading…</Card>
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
      <h1>[icon: handshake] My Loans</h1>
      <p>Qard = interest-free. Pay on time to grow your trust score.</p>

      <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
        <div className="wireframe-space-between">
          <div>
            <small>[icon: trust] Trust Score</small>
            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
              {data.kid.trust_score}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRequesting(!requesting);
              setSignStep(false);
              setReqAmt(null);
            }}
            aria-label={requesting ? "Cancel loan request" : "Request a new loan"}
          >
            {requesting ? "Cancel" : "[icon: plus] New loan"}
          </button>
        </div>
      </Card>

      {requesting && (
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: agreement] Qard Hasan Loan Agreement</h3>
          <p><small>An interest-free loan. By signing below, you promise to repay the full amount by the due date.</small></p>

          {!signStep ? (
            /* ── Step 1: Amount entry ─────────────────────────── */
            <div className="wireframe-col" style={{ marginTop: "1rem" }}>
              <small>Loan amount (Min. RM 1.00 — Qard Hasan loan)</small>
              <MoneyKeypad
                min={1.0}
                max={500}
                confirmLabel="Next: Details →"
                onConfirm={(amt) => {
                  setReqAmt(amt);
                  setSignStep(true);
                }}
              />
            </div>
          ) : (
            /* ── Step 2: Details + signature ─────────────────── */
            <div className="wireframe-col" style={{ marginTop: "1rem" }}>
              <div className="wireframe-box">
                <div className="wireframe-space-between">
                  <small>Loan requested (Qard Hasan)</small>
                  <strong>RM {reqAmt!.toFixed(2)}</strong>
                </div>
                <div className="wireframe-space-between">
                  <small>Admin fees</small>
                  <strong>RM 0.00</strong>
                </div>
                <div className="wireframe-space-between">
                  <small>You repay (total)</small>
                  <strong>RM {reqAmt!.toFixed(2)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setSignStep(false)}
                  style={{ marginTop: "0.5rem" }}
                >
                  [icon: back] Change amount
                </button>
              </div>

              <div>
                <label>Reason for loan</label>
                <input
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. To buy a book"
                />
              </div>

              <div>
                <label>Repay in</label>
                <div className="wireframe-row">
                  {[7, 14, 30, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDueDays(d)}
                      style={{
                        flex: 1,
                        border: dueDays === d ? "2px solid #000" : "1px solid #ccc",
                        fontWeight: dueDays === d ? "bold" : "normal",
                      }}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label>Your signature</label>
                <div style={{ marginTop: "0.5rem" }}>
                  <SignaturePad onChange={setSignature} />
                </div>
              </div>

              <button
                type="button"
                onClick={submitRequest}
                style={{ marginTop: "1rem" }}
              >
                Sign & send to parent
              </button>
            </div>
          )}
        </Card>
      )}

      <SectionTitle>My Loans</SectionTitle>
      <div className="wireframe-col">
        {data.loans.length === 0 && <Card className="wireframe-card">No loans yet.</Card>}
        {data.loans.map((l: (typeof data.loans)[number]) => {
          const remaining = Number(l.amount) - Number(l.repaid);
          const overdue = l.status === "active" && new Date(l.due_date) < new Date();
          return (
            <Card key={l.id} className="wireframe-card">
              <div className="wireframe-space-between">
                <div>
                  <strong>{l.reason || "Qard loan"}</strong>
                  <div>
                    <small>
                      Due {l.due_date} ·{" "}
                      {l.status === "repaid" ? (
                        <strong>[✓ Repaid]</strong>
                      ) : overdue ? (
                        <strong>[OVERDUE]</strong>
                      ) : (
                        "On track"
                      )}
                    </small>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div><strong>RM {remaining.toFixed(2)}</strong></div>
                  <small>of RM {Number(l.amount).toFixed(2)}</small>
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportLoanPdf({ ...l, kidName: data.kid.name })}
                aria-label={`Download loan ${l.status === "repaid" ? "receipt" : "agreement"} PDF for ${l.reason || "Qard loan"}`}
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                {l.status === "repaid" ? "[icon: pdf] Download receipt (PDF)" : "[icon: pdf] Download agreement (PDF)"}
              </button>

              {l.status === "active" && (
                <>
                  <button
                    type="button"
                    onClick={() => setActive(active === l.id ? null : l.id)}
                    style={{ width: "100%", marginTop: "0.5rem" }}
                  >
                    Repay
                  </button>
                  {active === l.id && (
                    <div className="wireframe-box" style={{ marginTop: "0.5rem" }}>
                      <p><small>Available balance: RM {kidBalance.toFixed(2)}</small></p>
                      <MoneyKeypad
                        key={l.id}
                        min={0.5}
                        max={Math.min(remaining, kidBalance)}
                        confirmLabel="Confirm Repayment"
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
