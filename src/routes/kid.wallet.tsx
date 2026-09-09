import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidSadaqah, edgeKidInvestSettle, edgeKidInvestDeposit, edgeKidInvestWithdraw, edgeKidRequestApproval, edgeKidSetInvestRisk } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import {
  Wallet,
  CurrencyCircleDollar,
  HandWithdraw,
  Leaf,
  Heart,
  Handshake as HandshakeIcon,
  Gift as GiftIcon,
  Plant,
  ArrowUUpLeft,
  Plus,
  Minus,
} from "@phosphor-icons/react";

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
          toast.success(`🌱 Investment grew by RM${r.paid.toFixed(2)}!`);
        }
        refresh();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return (
      <AppShell mode="kid">
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </AppShell>
    );
  }
  const k = data.kid;
  const code = getKidSession()?.code;
  const balance = Number(k.balance);
  const invested = Number(k.invest_balance ?? 0);
  const rate = Number(k.invest_rate ?? 0.02);
  const hibahRate = Number(k.hibah_rate ?? 0.01);

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
      toast.success("Jazakallah khair! ✨");
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

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "deposit",
      label: "Deposit",
      icon: <CurrencyCircleDollar weight="duotone" className="w-4 h-4" />,
    },
    {
      key: "withdraw",
      label: "Withdraw",
      icon: <HandWithdraw weight="duotone" className="w-4 h-4" />,
    },
    { key: "invest", label: "Invest", icon: <Leaf weight="duotone" className="w-4 h-4" /> },
    { key: "sadaqah", label: "Sadaqah", icon: <Heart weight="duotone" className="w-4 h-4" /> },
    { key: "loan", label: "Loan", icon: <HandshakeIcon weight="duotone" className="w-4 h-4" /> },
  ];

  return (
    <AppShell mode="kid">
      <h1 className="font-display text-2xl text-starlight flex items-center gap-2 drop-shadow-sm">
        <Wallet
          weight="duotone"
          className="w-8 h-8 text-neon-mint drop-shadow-[0_0_8px_var(--neon-mint)]"
        />
        Hyperdrive Core
      </h1>

      <Card className="mt-4 glass-panel bg-gradient-to-br from-neon-mint/20 to-cosmic-blue/20 border-neon-mint/50 shadow-neon relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-neon-mint/30 rounded-full blur-3xl pointer-events-none" />

        <div className="text-xs font-kid uppercase tracking-widest text-starlight/70 relative z-10">
          Core Energy
        </div>
        <div className="mt-1 font-mono text-4xl font-bold text-white drop-shadow-[0_0_10px_var(--neon-mint)] relative z-10">
          RM {balance.toFixed(2)}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 relative z-10">
          <span className="rounded-full bg-void/40 border border-starlight/20 px-3 py-1 font-kid text-[11px] font-bold text-starlight uppercase tracking-wider">
            Invested RM {invested.toFixed(2)}
          </span>
          <span className="rounded-full bg-void/40 border border-starlight/20 px-3 py-1 font-kid text-[11px] font-bold text-nebula-pink uppercase tracking-wider">
            {(k.risk_appetite as string) === "very_low" ? "Very Low Risk"
              : (k.risk_appetite as string) === "low" ? "Low Risk"
              : (k.risk_appetite as string) === "medium" ? "Medium Risk"
              : (k.risk_appetite as string) === "high" ? "High Risk"
              : (k.risk_appetite as string) === "very_high" ? "Very High Risk"
              : "Growth"}
          </span>
        </div>
      </Card>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              sfx.tap();
            }}
            className={`btn-press shrink-0 rounded-2xl px-5 py-3 font-kid text-xs font-bold transition flex items-center gap-2 uppercase tracking-wider border ${tab === t.key ? "bg-cosmic-blue border-cosmic-blue text-white shadow-[0_0_15px_var(--cosmic-blue)]" : "glass-panel bg-void/50 border-starlight/20 text-starlight/80 hover:bg-white/10"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "deposit" && (
        <Card className="glass-panel bg-void/50 border-starlight/20 mt-2">
          <h3 className="font-kid font-bold text-starlight text-lg mb-1 flex items-center gap-2">
            <CurrencyCircleDollar weight="duotone" className="w-6 h-6 text-neon-mint" />
            Request Energy
          </h3>
          <p className="font-body text-xs text-starlight/60 mb-5">
            Ask mission control (parent) to transmit energy to your core.
          </p>
          <MoneyKeypad
            min={0.5}
            max={10000}
            showReference
            confirmLabel="Transmit Request"
            confirmBg="bg-neon-mint"
            onConfirm={(amt, ref) => ask("DEPOSIT", amt, ref)}
          />
        </Card>
      )}

      {tab === "withdraw" && (
        <Card className="glass-panel bg-void/50 border-starlight/20 mt-2">
          <h3 className="font-kid font-bold text-starlight text-lg mb-1 flex items-center gap-2">
            <HandWithdraw weight="duotone" className="w-6 h-6 text-nova-red" />
            Eject Energy
          </h3>
          <p className="font-body text-xs text-starlight/60 mb-5">
            Ask mission control to convert energy into physical cash.
          </p>
          <MoneyKeypad
            min={0.5}
            max={balance}
            showReference
            confirmLabel="Transmit Request"
            confirmBg="bg-nova-red shadow-[0_0_15px_var(--nova-red)]"
            onConfirm={(amt, ref) => ask("WITHDRAWAL", amt, ref)}
          />
        </Card>
      )}

      {tab === "invest" && (
        <Card className="glass-panel bg-void/50 border-starlight/20 mt-2">
          <h3 className="font-kid font-bold text-starlight text-lg mb-1 flex items-center gap-2">
            <Leaf
              weight="duotone"
              className="w-6 h-6 text-nebula-pink drop-shadow-[0_0_5px_var(--nebula-pink)]"
            />
            Cosmic Growth
          </h3>
          <p className="font-body text-xs text-starlight/60 mb-4">
            Choose your risk appetite. Higher risk means potential for bigger gains, but also bigger
            losses!
          </p>

          <div className="mb-4 grid grid-cols-4 gap-2">
            {[
              { key: "very_low", label: "V.Low", color: "text-sky-400",   bg: "bg-sky-400"   },
              { key: "low",      label: "Low",   color: "text-neon-mint", bg: "bg-neon-mint" },
              { key: "medium",   label: "Med",   color: "text-sunny",     bg: "bg-sunny"     },
              { key: "high",     label: "High",  color: "text-coral",     bg: "bg-coral"     },
              { key: "very_high",label: "Max",   color: "text-nova-red",  bg: "bg-nova-red"  },
            ].map((r) => (
              <button
                key={r.key}
                onClick={() => changeRisk(r.key)}
                className={`rounded-xl py-2 font-kid text-[10px] font-bold uppercase tracking-wider border transition ${
                  (k.risk_appetite as string || "low") === r.key
                    ? `${r.bg} text-void border-transparent shadow-[0_0_10px_rgba(0,0,0,0.3)]`
                    : `glass-panel bg-void/30 ${r.color} border-starlight/10 hover:border-starlight/30`
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 text-center text-[10px] font-kid font-bold text-starlight/50 uppercase tracking-widest">
            <div className="rounded-2xl glass-panel bg-void/30 p-3 border-starlight/10 shadow-inner">
              Core
              <br />
              <span className="font-mono text-neon-mint text-lg">RM {balance.toFixed(2)}</span>
            </div>
            <div className="rounded-2xl glass-panel bg-nebula-pink/10 border-nebula-pink/30 p-3 shadow-inner">
              Generating
              <br />
              <span className="font-mono text-nebula-pink text-lg">RM {invested.toFixed(2)}</span>
            </div>
          </div>
          {/* Two separate keypads via toggle */}
          <InvestKeypad balance={balance} invested={invested} onInvest={invest} />
        </Card>
      )}

      {tab === "sadaqah" && (
        <Card className="glass-panel bg-void/50 border-starlight/20 mt-2">
          <h3 className="font-kid font-bold text-starlight text-lg mb-1 flex items-center gap-2">
            <Heart
              weight="duotone"
              className="w-6 h-6 text-cosmic-blue drop-shadow-[0_0_5px_var(--cosmic-blue)]"
            />
            Transmit Sadaqah
          </h3>
          <p className="font-body text-xs text-starlight/60 mb-5">
            "Sadaqah extinguishes sin." Share your energy to help others in the galaxy.
          </p>
          <MoneyKeypad
            min={0.5}
            max={balance}
            confirmLabel="Give Sadaqah"
            confirmBg="bg-cosmic-blue shadow-[0_0_15px_var(--cosmic-blue)]"
            onConfirm={(amt) => sadaqah(amt)}
          />
        </Card>
      )}

      {tab === "loan" && (
        <Card className="glass-panel bg-void/50 border-starlight/20 mt-2">
          <h3 className="font-kid font-bold text-starlight text-lg flex items-center gap-2">
            <HandshakeIcon weight="duotone" className="w-6 h-6 text-neon-mint" />
            Qard Hasan
          </h3>
          <p className="mt-2 font-body text-xs text-starlight/60">
            Interest-free loan — sign a digital agreement, parent approves, repay on time to grow
            trust score.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl glass-panel bg-void/30 p-4 border-starlight/10 shadow-inner">
              <div className="font-kid text-[10px] font-bold uppercase text-starlight/50 tracking-widest">
                Trust Score
              </div>
              <div className="font-mono text-3xl font-bold text-neon-mint drop-shadow-[0_0_5px_var(--neon-mint)]">
                {k.trust_score}
              </div>
            </div>
            <div className="rounded-2xl glass-panel bg-void/30 p-4 border-starlight/10 shadow-inner">
              <div className="font-kid text-[10px] font-bold uppercase text-starlight/50 tracking-widest">
                Active Loans
              </div>
              <div className="font-mono text-3xl font-bold text-starlight">
                {
                  data.loans.filter((l: (typeof data.loans)[number]) => l.status === "active")
                    .length
                }
              </div>
            </div>
          </div>
          <Link
            to="/kid/loans"
            className="mt-4 block w-full rounded-2xl bg-cosmic-blue py-4 text-center font-kid text-sm font-bold text-white shadow-[0_0_15px_var(--cosmic-blue)] uppercase tracking-wider hover:scale-[1.02] transition"
          >
            Enter Loan Center
          </Link>
        </Card>
      )}

      <SectionTitle>Flight Log</SectionTitle>
      <div className="space-y-3">
        {data.txs.length === 0 && (
          <Card className="text-center font-kid font-bold text-sm text-starlight/50 glass-panel bg-void/30 border-starlight/10 py-6 uppercase tracking-wider">
            No transmissions yet.
          </Card>
        )}
        {data.txs.map((t: (typeof data.txs)[number]) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-2xl glass-panel bg-void/50 border-starlight/20 p-4 shadow-sm hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-4">
              <div
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-[1.25rem] ${txBg(t.type)} shadow-inner border border-starlight/10`}
              >
                {txEmoji(t.type)}
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <div className="font-kid font-bold text-sm text-starlight truncate tracking-wide">
                  {t.label}
                </div>
                <div className="font-mono text-[10px] text-starlight/50 mt-1 uppercase tracking-widest font-semibold">
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div
              className={`font-mono font-bold text-sm shrink-0 ${["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) || (t.type === "QARD" && t.label === "Loan repayment") ? "text-nova-red drop-shadow-[0_0_5px_var(--nova-red)]" : "text-neon-mint drop-shadow-[0_0_5px_var(--neon-mint)]"}`}
            >
              {["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) ||
              (t.type === "QARD" && t.label === "Loan repayment")
                ? "-"
                : "+"}
              RM {Number(t.amount).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

/** Sub-component for the invest tab — toggles between Invest In / Withdraw Out keypads */
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
    <div className="mt-3">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setDir("in")}
          className={`btn-press rounded-2xl py-3.5 flex items-center justify-center gap-2 font-kid text-xs font-bold transition uppercase tracking-wider border ${dir === "in" ? "bg-nebula-pink border-nebula-pink text-white shadow-[0_0_15px_var(--nebula-pink)]" : "glass-panel bg-void/50 text-starlight/80 border-starlight/20 hover:bg-white/10"}`}
        >
          <Plus weight="bold" className="w-4 h-4" /> Grow
        </button>
        <button
          onClick={() => setDir("out")}
          className={`btn-press rounded-2xl py-3.5 flex items-center justify-center gap-2 font-kid text-xs font-bold transition uppercase tracking-wider border ${dir === "out" ? "bg-nova-red border-nova-red text-white shadow-[0_0_15px_var(--nova-red)]" : "glass-panel bg-void/50 text-starlight/80 border-starlight/20 hover:bg-white/10"}`}
        >
          <ArrowUUpLeft weight="bold" className="w-4 h-4" /> Recall
        </button>
      </div>
      <MoneyKeypad
        key={dir} // reset on direction change
        min={0.5}
        max={dir === "in" ? balance : invested}
        confirmLabel={dir === "in" ? "Lock Energy" : "Recall Energy"}
        confirmBg={dir === "in" ? "bg-nebula-pink" : "bg-nova-red"}
        onConfirm={(amt) => onInvest(dir, amt)}
      />
    </div>
  );
}

function txEmoji(t: string) {
  const map: Record<string, React.ReactNode> = {
    DEPOSIT: <CurrencyCircleDollar weight="duotone" className="w-6 h-6" />,
    WITHDRAWAL: <HandWithdraw weight="duotone" className="w-6 h-6" />,
    HIBAH: <GiftIcon weight="duotone" className="w-6 h-6" />,
    SADAQAH: <Heart weight="duotone" className="w-6 h-6" />,
    QARD: <HandshakeIcon weight="duotone" className="w-6 h-6" />,
    INVEST_IN: <Plant weight="duotone" className="w-6 h-6" />,
    INVEST_OUT: <ArrowUUpLeft weight="duotone" className="w-6 h-6" />,
  };
  return map[t] ?? <div className="w-2 h-2 rounded-full bg-charcoal" />;
}
function txBg(t: string) {
  const map: Record<string, string> = {
    DEPOSIT: "bg-neon-mint/20 text-neon-mint",
    WITHDRAWAL: "bg-nova-red/20 text-nova-red",
    HIBAH: "bg-sunny/20 text-sunny",
    SADAQAH: "bg-cosmic-blue/20 text-cosmic-blue",
    QARD: "bg-sky-500/20 text-sky-500",
    INVEST_IN: "bg-nebula-pink/20 text-nebula-pink",
    INVEST_OUT: "bg-void/50 text-starlight/80",
  };
  return map[t] ?? "bg-void/50 text-starlight/50";
}
