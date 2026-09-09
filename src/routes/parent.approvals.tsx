import { Skeleton } from "@/components/ui/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useParentData } from "@/hooks/use-parent-data";
import {
  edgeParentApproveRequest,
  edgeParentResolveReward,
  edgeParentMarkNotificationsRead,
} from "@/lib/edge";
import { toast } from "sonner";

export const Route = createFileRoute("/parent/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Centsibility" }] }),
  component: Approvals,
});

function parseQard(reason: string) {
  const [main, sig] = (reason || "").split(" :: SIG::");
  const dueMatch = main.match(/\(due (\d+)d\)/);
  const dueDays = dueMatch ? parseInt(dueMatch[1]) : 14;
  const cleanReason = main.replace(/\(due \d+d\)$/, "").trim();
  return { reason: cleanReason, dueDays, signature: sig || null };
}

function Approvals() {
  const { approvals, rewards, loading, refresh } = useParentData();
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    edgeParentMarkNotificationsRead();
  }, []);

  const decide = async (id: string, decision: "approve" | "decline") => {
    setBusyId(id);

    try {
      await edgeParentApproveRequest({ approvalId: id, decision });
      toast.success(decision === "approve" ? "Transmission Approved" : "Declined");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusyId(null);
    }
  };

  const decideReward = async (id: string, decision: "approve" | "decline") => {
    setBusyId(id);

    try {
      await edgeParentResolveReward({ rewardId: id, decision });
      toast.success(decision === "approve" ? "Reward granted" : "Declined");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setBusyId(null);
    }
  };

  if (loading)
    return (
      <AppShell mode="parent">
        <div>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </AppShell>
    );

  return (
    <AppShell mode="parent">
      <h1>Pending Transmissions</h1>
      <p>Review and confirm requests from your astronauts.</p>

      {approvals.length + rewards.length === 0 && (
        <section>No pending signals.</section>
      )}

      {approvals.length > 0 && <h2>Money Requests</h2>}
      <div>
        {approvals.map((a) => {
          const isQard = a.kind === "QARD";
          const parsed = isQard ? parseQard(a.reason) : null;

          return (
            <section key={a.id}>
              <div>
                <div>
                  <span>[{a.kind}]</span>
                  <div>
                    <strong>{a.kids?.name}</strong>
                  </div>
                  <div>
                    {parsed?.reason ?? a.reason}
                  </div>
                  {isQard && (
                    <div>Due in {parsed?.dueDays} days</div>
                  )}
                </div>
                <div>
                  RM {a.amount}
                </div>
              </div>

              {isQard && parsed?.signature && (
                <div>
                  <div>Astronaut's signature:</div>
                  <img
                    src={parsed.signature}
                    alt="signature"
                    style={{ maxWidth: "200px", border: "1px solid #777" }}
                  />
                </div>
              )}

              {isQard && (
                <>
                  {/* Fee breakdown */}
                  <div>
                    <div><strong>[icon: money] Loan breakdown</strong></div>
                    <div>
                      <span>Requested</span>
                      <span>RM {Number(a.amount).toFixed(2)}</span>
                    </div>
                    <div>
                      <span>− Fuel fee</span>
                      <span>− RM 3.00</span>
                    </div>
                    <div>
                      <span>− Oxygen fee</span>
                      <span>− RM 2.50</span>
                    </div>
                    <div>
                      <span>Astronaut receives</span>
                      <span>RM {Math.max(0, Number(a.amount) - 5.5).toFixed(2)}</span>
                    </div>
                    <div>
                      <span>Astronaut repays</span>
                      <span>RM {Number(a.amount).toFixed(2)}</span>
                    </div>
                  </div>
                  <div>
                    Qard agreement: 0% interest loan. Late repayment lowers trust score (100% Halal).
                  </div>
                </>
              )}

              <div>
                <button
                  onClick={() => decide(a.id, "approve")}
                  disabled={busyId === a.id}
                >
                  {busyId === a.id ? "Launching…" : "[icon: check] Approve"}
                </button>
                <button
                  onClick={() => decide(a.id, "decline")}
                  disabled={busyId === a.id}
                >
                  [icon: close] Decline
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {rewards.length > 0 && <h2>Reward Transmissions</h2>}
      <div>
        {rewards.map((r) => {
          return (
            <section key={r.id}>
              <div>
                <div>
                  <span>[icon: gift] REWARD</span>
                  <div>{r.kids?.name} requested:</div>
                  <div><strong>"{r.name}"</strong></div>
                </div>
                <div>
                  {r.cost} [icon: star]
                </div>
              </div>
              <div>
                <button
                  onClick={() => decideReward(r.id, "approve")}
                  disabled={busyId === r.id}
                >
                  {busyId === r.id ? "Launching…" : `[icon: check] Grant (-${r.cost})`}
                </button>
                <button
                  onClick={() => decideReward(r.id, "decline")}
                  disabled={busyId === r.id}
                >
                  [icon: close] Decline
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
