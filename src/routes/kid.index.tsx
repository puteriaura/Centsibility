import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import {
  edgeKidClaimCoins,
  edgeKidRequestReward,
  edgeKidRequestApproval,
  edgeKidUpdateProfile,
  edgeKidUploadAvatar,
} from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { ImageUploadCrop } from "@/components/ImageUploadCrop";
import { toast } from "sonner";
import penny from "@/assets/penny-mascot.png";
import { QuoteCard } from "@/components/QuoteCard";
import { AvatarBubble } from "@/components/AvatarBubble";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import {
  Eye,
  EyeClosed,
  Star,
  ShieldCheck,
  Target,
  Handshake as HandshakeIcon,
  Leaf,
  Users,
  TrendUp,
  Mosque,
  Gift,
  CurrencyCircleDollar,
  HandWithdraw,
  Plus,
  Minus,
  Check,
} from "@phosphor-icons/react";
import {
  StatChip,
  ActionTile,
  RewardCoinPicker,
  txEmoji,
  txEmojiBg,
} from "@/features/kid/components";

export const Route = createFileRoute("/kid/")({
  head: () => ({ meta: [{ title: "Kid Home — Centsibility" }] }),
  component: KidHome,
});

function KidHome() {
  const { data, loading, refresh } = useKidData();
  const [showReward, setShowReward] = useState(false);
  const [rName, setRName] = useState("");
  const [moneyReq, setMoneyReq] = useState<null | "DEPOSIT" | "WITHDRAWAL">(null);

  const [showProfile, setShowProfile] = useState(false);
  const [pBio, setPBio] = useState("");
  const [pBirthDate, setPBirthDate] = useState("");
  const [pBirthYear, setPBirthYear] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  if (loading || !data)
    return (
      <AppShell mode="kid">
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
          </div>
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </AppShell>
    );
  const k = data.kid;
  const code = getKidSession()?.code;

  const claim = async () => {
    if (!code) return;
    const res = await edgeKidClaimCoins({ code });
    sfx.coin();
    toast.success(`Claimed ${res.claimed.toFixed(0)} pts!`);
    refresh();
  };

  const submitRewardWithCost = async (cost: number) => {
    if (!code || !rName.trim()) {
      toast.error("Give the reward a name first!");
      return;
    }
    try {
      await edgeKidRequestReward({ code, name: rName.trim(), cost });
      sfx.success();
      toast.success("Reward request sent!");
      setShowReward(false);
      setRName("");
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const submitMoneyReq = async (amount: number, reference?: string) => {
    if (!code || !moneyReq) return;
    try {
      await edgeKidRequestApproval({
        code, kind: moneyReq, amount, reason: reference ?? moneyReq,
      });
      sfx.success();
      toast.success("Sent to parent for approval");
      setMoneyReq(null);
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const pendingApprovals = data.approvals.filter(
    (a: (typeof data.approvals)[number]) => a.status === "pending",
  );

  const openProfile = () => {
    setPBio(k.bio || "");
    setPBirthDate(k.birth_date || "");
    setPBirthYear(k.birth_year ? String(k.birth_year) : "");
    setShowProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!code) return;
    setSavingProfile(true);
    try {
      await edgeKidUpdateProfile({
        code,
        bio: pBio.trim() || undefined,
        birth_date: pBirthDate || undefined,
        birth_year: pBirthYear ? parseInt(pBirthYear) : undefined,
      });
      toast.success("Profile saved!");
      refresh();
      setShowProfile(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAvatar = async (base64Url: string) => {
    if (!code) return;
    setSavingProfile(true);
    try {
      await edgeKidUploadAvatar({ code, base64Image: base64Url });
      toast.success("Profile picture updated!");
      refresh();
      setShowUpload(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <AppShell mode="kid">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={openProfile}
          aria-label="Open profile settings"
          className="flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition"
        >
          <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={56} ring />
          <div className="min-w-0">
            <p className="font-arabic text-sm text-neon-mint">السلام عليكم</p>
            <h1 className="font-display text-2xl text-starlight truncate">Cmdr. {k.name}!</h1>
          </div>
        </button>
        <div
          className="flex items-center gap-2 rounded-full glass-panel px-3 py-1.5 shrink-0 border border-starlight/30 shadow-neon"
          role="status"
          aria-label={`${k.streak} day streak`}
        >
          <TrendUp weight="bold" className="w-4 h-4 text-neon-mint" />
          <span className="font-kid text-xs font-bold text-starlight">{k.streak}d Orbit</span>
        </div>
      </div>

      <div className="mt-4">
        <QuoteCard variant="kid" />
      </div>

      <div className="mt-4 relative overflow-hidden rounded-3xl glass-panel p-6 text-[color:var(--starlight)] shadow-soft">
        <img
          src={penny}
          alt=""
          width={80}
          height={80}
          className="absolute -right-2 -bottom-2 h-24 w-24 opacity-90 drop-shadow-md animate-float"
        />
        <div className="relative">
          <div className="font-kid text-[10px] uppercase tracking-widest text-neon-mint opacity-90 flex items-center justify-between">
            <span>Hyperdrive Core (RM)</span>
            <button
              onClick={() => setHideBalance(!hideBalance)}
              className="opacity-80 hover:opacity-100 transition"
            >
              {hideBalance ? (
                <EyeClosed weight="bold" className="w-4 h-4" />
              ) : (
                <Eye weight="bold" className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="mt-1 font-mono text-4xl font-bold">
            {hideBalance ? "RM •••" : `RM ${Number(k.balance).toFixed(2)}`}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/20 px-2.5 py-1 font-kid text-[11px] font-bold">
              Hibah {(Number(k.hibah_rate) * 100).toFixed(0)}%
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 font-kid text-[11px] font-bold flex items-center gap-1">
              100% Halal <Check weight="bold" className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Points reward currency — separate from money */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-3xl glass-panel p-4 shadow-neon">
          <div className="font-kid text-[11px] font-bold uppercase tracking-wider text-starlight/70">
            Stardust
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-starlight flex items-center gap-1">
            {Math.round(Number(k.coins)).toLocaleString()}
            <Star weight="fill" className="w-5 h-5 text-starlight drop-shadow-md" />
          </div>
          <div className="font-body text-[10px] text-starlight/60">Fuel for rewards.</div>
        </div>
        <div className="rounded-3xl glass-panel p-4 shadow-soft">
          <div className="font-kid text-[11px] font-bold uppercase tracking-wider text-neon-mint">
            Cosmic Growth
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-neon-mint">
            {hideBalance ? "RM •••" : `RM ${Number(k.invest_balance ?? 0).toFixed(2)}`}
          </div>
          <Link to="/kid/invest" className="font-body text-[10px] text-neon-mint underline">
            Manage →
          </Link>
        </div>
      </div>

      {k.unclaimed_coins > 0 && (
        <button
          onClick={claim}
          aria-label={`Claim ${Math.round(Number(k.unclaimed_coins))} unclaimed points`}
          className="mt-3 w-full rounded-3xl bg-gradient-to-r from-cosmic-blue to-nebula-pink p-4 text-left shadow-neon active:scale-95 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-kid text-sm font-bold text-starlight flex items-center gap-2">
                <Gift weight="duotone" className="w-5 h-5 text-starlight" />
                Unclaimed stardust!
              </div>
              <div className="font-body text-xs text-starlight/80 mt-1">Tap to claim your fuel</div>
            </div>
            <div className="font-mono text-2xl font-bold text-starlight flex items-center gap-1">
              +{Math.round(Number(k.unclaimed_coins))}
              <Star weight="fill" className="w-5 h-5 text-white drop-shadow-md" />
            </div>
          </div>
        </button>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatChip
          icon={<Star weight="duotone" className="w-6 h-6 text-starlight" />}
          label="Level"
          value={k.level.toString()}
          bg="glass-panel"
        />
        <StatChip
          icon={<Target weight="duotone" className="w-6 h-6 text-nebula-pink" />}
          label="XP"
          value={`${k.xp}/100`}
          bg="glass-panel"
        />
        <StatChip
          icon={<ShieldCheck weight="duotone" className="w-6 h-6 text-neon-mint" />}
          label="Trust"
          value={k.trust_score.toString()}
          bg="glass-panel"
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <ActionTile
          to="/kid/goals"
          icon={<Target weight="duotone" className="w-8 h-8 text-starlight" />}
          title="Missions"
          sub="Save for things"
          bg="glass-panel hover:bg-white/10"
          text="text-starlight"
        />
        <ActionTile
          to="/kid/quiz"
          icon={<TrendUp weight="duotone" className="w-8 h-8 text-neon-mint" />}
          title="Daily Quest"
          sub="Earn stardust"
          bg="glass-panel hover:bg-white/10"
          text="text-starlight"
        />
        <ActionTile
          to="/kid/invest"
          icon={<Leaf weight="duotone" className="w-8 h-8 text-nebula-pink" />}
          title="Invest"
          sub="Grow your money"
          bg="glass-panel hover:bg-white/10"
          text="text-starlight"
        />
        <ActionTile
          to="/kid/loans"
          icon={<HandshakeIcon weight="duotone" className="w-8 h-8 text-cosmic-blue" />}
          title="Qard Loan"
          sub="Borrow with sign"
          bg="glass-panel hover:bg-white/10"
          text="text-starlight"
        />
        <ActionTile
          to="/kid/sadaqah"
          icon={<Users weight="duotone" className="w-8 h-8 text-nova-red" />}
          title="Sadaqah"
          sub="Help others"
          bg="glass-panel hover:bg-white/10"
          text="text-starlight"
        />
        <ActionTile
          to="/kid/zakat"
          icon={<Mosque weight="duotone" className="w-8 h-8 text-starlight" />}
          title="Zakat Calc"
          sub="2.5% calculator"
          bg="glass-panel hover:bg-white/10"
          text="text-starlight"
        />
        <button
          onClick={() => setShowReward(true)}
          className="btn-press rounded-[2rem] glass-panel hover:bg-white/10 p-5 text-left text-starlight shadow-soft active:scale-95 transition"
        >
          <Gift weight="duotone" className="w-8 h-8 mb-2 text-starlight" />
          <div className="mt-1 font-kid font-bold text-sm tracking-wide">Reward</div>
          <div className="font-body text-[11px] opacity-70">Spend stardust</div>
        </button>
      </div>

      <SectionTitle>Transmission Requests</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            setMoneyReq("DEPOSIT");
          }}
          className="btn-press rounded-[2rem] bg-emerald-halal py-4 flex items-center justify-center gap-2 font-kid font-bold text-white shadow-soft"
        >
          <Plus weight="bold" className="w-5 h-5" /> Ask Deposit
        </button>
        <button
          onClick={() => {
            setMoneyReq("WITHDRAWAL");
          }}
          className="btn-press rounded-[2rem] bg-coral py-4 flex items-center justify-center gap-2 font-kid font-bold text-white shadow-soft"
        >
          <Minus weight="bold" className="w-5 h-5" /> Ask Withdraw
        </button>
      </div>

      {moneyReq && (
        <Card className="mt-3 border-2 border-emerald-halal">
          <h3 className="font-kid font-bold text-starlight mb-3 flex items-center gap-2">
            {moneyReq === "DEPOSIT" ? (
              <CurrencyCircleDollar weight="duotone" className="w-6 h-6 text-emerald-halal" />
            ) : (
              <HandWithdraw weight="duotone" className="w-6 h-6 text-coral" />
            )}
            {moneyReq === "DEPOSIT" ? "Ask parent to deposit" : "Ask parent to withdraw"}
          </h3>
          <MoneyKeypad
            min={0.5}
            max={moneyReq === "WITHDRAWAL" ? Number(k.balance) : 10000}
            showReference
            confirmLabel={
              moneyReq === "DEPOSIT" ? "Send Deposit Request" : "Send Withdrawal Request"
            }
            confirmBg={moneyReq === "DEPOSIT" ? "bg-emerald-halal" : "bg-coral"}
            onConfirm={submitMoneyReq}
            onCancel={() => setMoneyReq(null)}
          />
        </Card>
      )}

      {showReward && (
        <Card className="mt-4 border-2 border-bubblegum bg-void/50">
          <h3 className="font-kid font-bold text-starlight flex items-center gap-2">
            <Gift weight="duotone" className="w-6 h-6 text-bubblegum" />
            Request a custom reward
          </h3>
          <div className="mt-1 font-body text-[11px] text-starlight/70 mb-3">
            You have{" "}
            <span className="font-mono font-bold text-starlight flex items-center gap-1 inline-flex">
              {Math.round(Number(k.coins)).toLocaleString()}{" "}
              <Star weight="fill" className="w-4 h-4 text-gold-nur" />
            </span>
          </div>
          <input
            value={rName}
            onChange={(e) => setRName(e.target.value)}
            placeholder="e.g. New book, day trip, ice cream"
            className="mb-3 w-full rounded-2xl border border-border bg-cream px-4 py-3 font-body text-sm"
            maxLength={100}
          />
          <RewardCoinPicker
            maxPoints={Math.max(1, Math.floor(k.coins))}
            onConfirm={(cost) => {
              void submitRewardWithCost(cost);
            }}
            onCancel={() => setShowReward(false)}
            rewardName={rName}
          />
        </Card>
      )}

      {pendingApprovals.length > 0 && (
        <>
          <SectionTitle>Waiting for parent</SectionTitle>
          <div className="space-y-2">
            {pendingApprovals.map((a: (typeof pendingApprovals)[number]) => (
              <Card key={a.id} className="bg-sunny/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-kid text-sm font-bold text-starlight">{a.kind}</div>
                    <div className="font-body text-xs text-starlight/70">
                      {(a.reason || "").split(" :: SIG::")[0]}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-starlight">RM {a.amount}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {data.loans.filter((l: (typeof data.loans)[number]) => l.status === "active").length > 0 && (
        <>
          <SectionTitle>My Loans (Qard)</SectionTitle>
          <div className="space-y-2">
            {data.loans
              .filter((l: (typeof data.loans)[number]) => l.status === "active")
              .map((l: (typeof data.loans)[number]) => {
                const remaining = Number(l.amount) - Number(l.repaid);
                const overdue = new Date(l.due_date) < new Date();
                return (
                  <Card key={l.id} className={overdue ? "border-2 border-coral" : ""}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-kid font-bold text-sm text-starlight">
                          {l.reason || "Qard loan"}
                        </div>
                        <div className="font-body text-[11px] text-starlight/70">
                          Due {l.due_date}{" "}
                          {overdue && <span className="text-coral font-bold">· OVERDUE</span>}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-starlight">
                        RM {remaining.toFixed(2)}
                      </div>
                    </div>
                    <Link
                      to="/kid/loans"
                      className="mt-3 block w-full rounded-2xl bg-charcoal py-2 text-center font-kid text-xs font-bold text-white"
                    >
                      Repay →
                    </Link>
                  </Card>
                );
              })}
          </div>
        </>
      )}

      <SectionTitle>Transaction History</SectionTitle>
      <div className="space-y-2">
        {data.txs.map((t: (typeof data.txs)[number]) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${txEmojiBg(t.type)}`}>
                {txEmoji(t.type)}
              </div>
              <div>
                <div className="font-kid font-bold text-sm text-starlight">{t.label}</div>
                <div className="font-body text-[11px] text-starlight/70">
                  {new Date(t.created_at).toLocaleDateString()} · {t.type}
                </div>
              </div>
            </div>
            <div
              className={`font-mono font-bold text-sm ${["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) || (t.type === "QARD" && t.label === "Loan repayment") ? "text-coral" : "text-emerald-halal"}`}
            >
              {["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) ||
              (t.type === "QARD" && t.label === "Loan repayment")
                ? "-"
                : "+"}
              RM {Number(t.amount).toFixed(2)}
            </div>
          </div>
        ))}
        {data.txs.length === 0 && (
          <Card className="text-center font-body text-sm text-pewter">No activity yet.</Card>
        )}
      </div>

      {showProfile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-cream/95 backdrop-blur-md overflow-y-auto">
          <div className="flex items-center justify-between p-4 sticky top-0 bg-void/95 backdrop-blur-sm border-b border-white/10">
            <h2 className="font-display text-xl text-starlight">My Profile</h2>
            <button
              onClick={() => setShowProfile(false)}
              className="rounded-full bg-white/10 px-4 py-1.5 font-bold text-sm text-starlight hover:bg-white/20"
            >
              Close
            </button>
          </div>

          <div className="p-6 max-w-md mx-auto w-full space-y-6">
            {showUpload ? (
              <ImageUploadCrop
                busy={savingProfile}
                onSave={handleSaveAvatar}
                onCancel={() => setShowUpload(false)}
              />
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={96} ring />
                  <button
                    onClick={() => setShowUpload(true)}
                    className="mt-3 font-kid text-sm font-bold text-emerald-halal underline"
                  >
                    Change Picture
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-starlight ml-2">Name</label>
                    <input
                      value={k.name}
                      disabled
                      className="mt-1 w-full rounded-2xl bg-white/5 px-4 py-3 font-parent text-sm text-starlight/50 cursor-not-allowed border border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-starlight ml-2">
                      Username (Parent only)
                    </label>
                    <input
                      value={k.username || ""}
                      disabled
                      className="mt-1 w-full rounded-2xl bg-white/5 px-4 py-3 font-parent text-sm text-starlight/50 cursor-not-allowed border border-white/10"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-starlight ml-2">Short Bio</label>
                    <textarea
                      value={pBio}
                      onChange={(e) => setPBio(e.target.value)}
                      maxLength={150}
                      rows={3}
                      placeholder="I love to learn and save money!"
                      className="mt-1 w-full rounded-2xl border-2 border-white/10 bg-void/50 px-4 py-3 font-body text-sm resize-none text-starlight"
                    />
                    <div className="text-right text-[10px] text-starlight/50 mr-2 mt-1">
                      {pBio.length}/150
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-starlight ml-2">Birth Date</label>
                      <input
                        type="date"
                        value={pBirthDate}
                        onChange={(e) => setPBirthDate(e.target.value)}
                        className="mt-1 w-full rounded-2xl border-2 border-white/10 bg-void/50 px-4 py-3 font-parent text-sm text-starlight"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-starlight ml-2">Birth Year</label>
                      <input
                        type="number"
                        placeholder="YYYY"
                        value={pBirthYear}
                        onChange={(e) => setPBirthYear(e.target.value)}
                        className="mt-1 w-full rounded-2xl border-2 border-white/10 bg-void/50 px-4 py-3 font-parent text-sm text-starlight"
                      />
                    </div>
                  </div>

                  {data.parent && (
                    <div className="rounded-2xl bg-mint/20 p-4 border border-mint/40">
                      <div className="text-[10px] uppercase font-bold text-pewter mb-1">
                        Linked to Parent
                      </div>
                      <div className="font-parent font-bold text-charcoal">
                        {data.parent.display_name || "Parent"}
                      </div>
                      <div className="font-body text-xs text-pewter">{data.parent.email}</div>
                    </div>
                  )}

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full rounded-2xl bg-emerald-halal py-3 font-kid font-bold text-white shadow-soft disabled:opacity-50 mt-4"
                  >
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
