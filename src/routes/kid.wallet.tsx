import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidSadaqah, edgeKidInvestSettle, edgeKidInvestDeposit, edgeKidInvestWithdraw, edgeKidRequestApproval, edgeKidSetInvestRisk } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { formatTransactionSign } from "@/lib/finance";

export const Route = createFileRoute("/kid/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Centsibility" }] }),
  component: KidWallet,
});

type Tab = "deposit" | "withdraw" | "invest" | "sadaqah" | "loan";

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
      <div className="wireframe-col">
        <Skeleton style={{ height: "8rem" }} />
        <Skeleton style={{ height: "6rem" }} />
        <Skeleton style={{ height: "10rem" }} />
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

  const tabs: { key: Tab; label: string; iconLabel: string }[] = [
    { key: "deposit", label: "Deposit", iconLabel: "[icon: deposit]" },
    { key: "withdraw", label: "Withdraw", iconLabel: "[icon: withdraw]" },
    { key: "invest", label: "Invest", iconLabel: "[icon: invest]" },
    { key: "sadaqah", label: "Sadaqah", iconLabel: "[icon: sadaqah]" },
    { key: "loan", label: "Loan", iconLabel: "[icon: loan]" },
  ];

  return (
    <>
      <h1>[icon: wallet] Hyperdrive Core</h1>

      <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
        <small>Core Energy</small>
        <div style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.25rem 0" }}>
          RM {balance.toFixed(2)}
        </div>
        <div className="wireframe-row">
          <small>Invested RM {invested.toFixed(2)}</small>
          <small>
            {(k.risk_appetite as string) === "very_low" ? "Very Low Risk"
              : (k.risk_appetite as string) === "low" ? "Low Risk"
              : (k.risk_appetite as string) === "medium" ? "Medium Risk"
              : (k.risk_appetite as string) === "high" ? "High Risk"
              : (k.risk_appetite as string) === "very_high" ? "Very High Risk"
              : "Growth"}
          </small>
        </div>
      </Card>

      <div className="wireframe-row" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              sfx.tap();
            }}
            style={{
              border: tab === t.key ? "2px solid #000" : "1px solid #ccc",
              fontWeight: tab === t.key ? "bold" : "normal",
            }}
          >
            {t.iconLabel} {t.label}
          </button>
        ))}
      </div>

      {tab === "deposit" && (
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: deposit] Request Energy</h3>
          <p><small>Ask mission control (parent) to transmit energy to your core.</small></p>
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
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: withdraw] Eject Energy</h3>
          <p><small>Ask mission control to convert energy into physical cash.</small></p>
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
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: invest] Cosmic Growth</h3>
          <p><small>Choose your risk appetite. Higher risk means potential for bigger gains, but also bigger losses!</small></p>

          <div className="wireframe-grid-4" style={{ marginBottom: "1rem" }}>
            {[
              { key: "very_low", label: "V.Low" },
              { key: "low", label: "Low" },
              { key: "medium", label: "Med" },
              { key: "high", label: "High" },
              { key: "very_high", label: "Max" },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => changeRisk(r.key)}
                style={{
                  border: (k.risk_appetite as string || "low") === r.key ? "2px solid #000" : "1px solid #ccc",
                  fontWeight: (k.risk_appetite as string || "low") === r.key ? "bold" : "normal",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="wireframe-grid-2" style={{ textAlign: "center", marginBottom: "1rem" }}>
            <div className="wireframe-box">
              <small>Core</small>
              <div><strong>RM {balance.toFixed(2)}</strong></div>
            </div>
            <div className="wireframe-box">
              <small>Generating</small>
              <div><strong>RM {invested.toFixed(2)}</strong></div>
            </div>
          </div>
          <InvestKeypad balance={balance} invested={invested} onInvest={invest} />
        </Card>
      )}

      {tab === "sadaqah" && (
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: sadaqah] Transmit Sadaqah</h3>
          <p><small>"Sadaqah extinguishes sin." Share your energy to help others in the galaxy.</small></p>
          <MoneyKeypad
            min={0.5}
            max={balance}
            confirmLabel="Give Sadaqah"
            onConfirm={(amt) => sadaqah(amt)}
          />
        </Card>
      )}

      {tab === "loan" && (
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: loan] Qard Hasan</h3>
          <p><small>Interest-free loan — sign a digital agreement, parent approves, repay on time to grow trust score.</small></p>
          <div className="wireframe-grid-2" style={{ textAlign: "center", margin: "1rem 0" }}>
            <div className="wireframe-box">
              <small>Trust Score</small>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{k.trust_score}</div>
            </div>
            <div className="wireframe-box">
              <small>Active Loans</small>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
                {data.loans.filter((l: (typeof data.loans)[number]) => l.status === "active").length}
              </div>
            </div>
          </div>
          <Link
            to="/kid/loans"
            style={{ display: "block", textAlign: "center", padding: "0.5rem" }}
          >
            Enter Loan Center
          </Link>
        </Card>
      )}

      <SectionTitle>Flight Log</SectionTitle>
      <div className="wireframe-col">
        {data.txs.length === 0 && (
          <Card className="wireframe-box" style={{ textAlign: "center" }}>
            No transmissions yet.
          </Card>
        )}
        {data.txs.map((t: (typeof data.txs)[number]) => (
          <div key={t.id} className="wireframe-space-between wireframe-box">
            <div className="wireframe-row">
              <span>{txIconLabel(t.type)}</span>
              <div>
                <strong>{t.label}</strong>
                <div><small>{new Date(t.created_at).toLocaleDateString()}</small></div>
              </div>
            </div>
            <div>
              <strong>
                {formatTransactionSign(t.type, t.label)}
                RM {Number(t.amount).toFixed(2)}
              </strong>
            </div>
          </div>
        ))}
      </div>
    </>
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
    <div className="wireframe-col" style={{ marginTop: "1rem" }}>
      <div className="wireframe-grid-2">
        <button
          type="button"
          onClick={() => setDir("in")}
          style={{
            border: dir === "in" ? "2px solid #000" : "1px solid #ccc",
            fontWeight: dir === "in" ? "bold" : "normal",
          }}
        >
          [icon: plus] Grow
        </button>
        <button
          type="button"
          onClick={() => setDir("out")}
          style={{
            border: dir === "out" ? "2px solid #000" : "1px solid #ccc",
            fontWeight: dir === "out" ? "bold" : "normal",
          }}
        >
          [icon: recall] Recall
        </button>
      </div>
      <MoneyKeypad
        key={dir}
        min={0.5}
        max={dir === "in" ? balance : invested}
        confirmLabel={dir === "in" ? "Lock Energy" : "Recall Energy"}
        onConfirm={(amt) => onInvest(dir, amt)}
      />
    </div>
  );
}

function txIconLabel(t: string): string {
  const map: Record<string, string> = {
    DEPOSIT: "[icon: deposit]",
    WITHDRAWAL: "[icon: withdrawal]",
    HIBAH: "[icon: hibah]",
    SADAQAH: "[icon: sadaqah]",
    QARD: "[icon: loan]",
    INVEST_IN: "[icon: invest in]",
    INVEST_OUT: "[icon: invest return]",
  };
  return map[t] ?? "[icon: transaction]";
}
