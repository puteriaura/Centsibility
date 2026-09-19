import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { BalanceCard, QuickAction, TransactionRow, StatCard } from "@/components/banking";
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
import { QuoteCard } from "@/components/QuoteCard";
import { AvatarBubble } from "@/components/AvatarBubble";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { cleanApprovalReason } from "@/lib/qard";
import {
  StatChip,
  RewardCoinPicker,
  TX_ICON_MAP,
} from "@/features/kid/components";
import { AppIcon } from "@/components/ui/app-icon";

export const Route = createFileRoute("/kid/")({
  head: () => ({ meta: [{ title: "Kid Home — Centsibility" }] }),
  component: KidHome,
});

function KidHome() {
  const nav = useNavigate();
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
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "8rem", borderRadius: "20px" }} />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton style={{ height: "6rem", borderRadius: "16px" }} />
          <Skeleton style={{ height: "6rem", borderRadius: "16px" }} />
        </div>
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
      </div>
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

  const isOutflow = (t: (typeof data.txs)[number]) =>
    ["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) ||
    (t.type === "QARD" && t.label === "Loan repayment");

  return (
    <>
      <div className="kid-greeting">
        <button
          type="button"
          onClick={openProfile}
          aria-label="Open profile settings"
          className="kid-greeting__profile"
        >
          <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={56} ring />
          <div>
            <p className="kid-greeting__salaam">السلام عليكم</p>
            <h1 className="kid-greeting__name">Cmdr. {k.name}!</h1>
          </div>
        </button>
        <div className="kid-streak" role="status" aria-label={`${k.streak} day streak`}>
          <AppIcon name="trend" size={16} color="var(--indigo-velvet)" />
          {k.streak}d Orbit
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <QuoteCard variant="kid" />
      </div>

      <BalanceCard
        title="Spending balance"
        balance={Number(k.balance)}
        secondaryBalance={{
          label: "Total balance",
          amount: Number(k.balance) + Number(k.invest_balance ?? 0),
        }}
        hideBalance={hideBalance}
        onToggleHide={() => setHideBalance(!hideBalance)}
        onArrowClick={() => nav({ to: "/kid/wallet" })}
        showDots={true}
        metadata={[
          { label: "Hibah", value: `${(Number(k.hibah_rate) * 100).toFixed(0)}%` },
          { label: "100% Halal" },
        ]}
      />

      {/* Benchmark Image 4: 2x4 Circular Quick Action Grid */}
      <div className="aeon-quick-grid">
        {/* Row 1 */}
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setMoneyReq("DEPOSIT");
          }}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="deposit" size={24} />
          </span>
          <span className="aeon-quick-label">Transfer</span>
        </button>

        <Link
          to="/kid/wallet"
          onClick={() => sfx.tap()}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="lock" size={22} />
          </span>
          <span className="aeon-quick-label">Secure</span>
        </Link>

        <Link
          to="/kid/goals"
          onClick={() => sfx.tap()}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="money" size={24} />
          </span>
          <span className="aeon-quick-label">Goals</span>
        </Link>

        <Link
          to="/kid/zakat"
          onClick={() => sfx.tap()}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <span className="aeon-quick-circle__dot" aria-hidden="true" />
            <AppIcon name="mosque" size={22} />
          </span>
          <span className="aeon-quick-label">Zakat</span>
        </Link>

        {/* Row 2 */}
        <Link
          to="/kid/loans"
          onClick={() => sfx.tap()}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="loan" size={22} />
          </span>
          <span className="aeon-quick-label">Loans</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setShowReward(true);
          }}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="trophy" size={22} />
          </span>
          <span className="aeon-quick-label">Rewards</span>
        </button>

        <Link
          to="/kid/sadaqah"
          onClick={() => sfx.tap()}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <span className="aeon-quick-circle__dot" aria-hidden="true" />
            <AppIcon name="sadaqah" size={22} />
          </span>
          <span className="aeon-quick-label">Sadaqah</span>
        </Link>

        <Link
          to="/kid/chat"
          onClick={() => sfx.tap()}
          className="aeon-quick-btn"
        >
          <span className="aeon-quick-circle">
            <AppIcon name="penny" size={24} />
          </span>
          <span className="aeon-quick-label">Penny</span>
        </Link>
      </div>

      {/* Promotional banner — AEON layout, Centsibility copy */}
      <div className="aeon-banner aeon-banner--purple">
        <div className="max-w-[70%]">
          <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug">
            Give sadaqah and earn stardust — start with RM1
          </h3>
          <button
            type="button"
            onClick={() => {
              sfx.pop();
              nav({ to: "/kid/sadaqah" });
            }}
            className="aeon-banner__pill-btn"
          >
            Give now
          </button>
        </div>
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
          <AppIcon name="shieldcheck" size={28} />
        </div>
      </div>

      {/* Carousel Dots */}
      <div className="aeon-dots" aria-hidden="true">
        <span className="aeon-dot-active" />
        <span className="aeon-dot-inactive" />
        <span className="aeon-dot-inactive" />
      </div>

      {/* Benchmark Image 4 & 5: Insights */}
      <div className="aeon-section-tag">
        <span>INSIGHTS</span>
        <span className="opacity-60 text-[10px]" aria-hidden="true">ⓘ</span>
      </div>

      <button
        type="button"
        className="p-4 rounded-2xl text-white flex items-center gap-3.5 shadow-md relative overflow-hidden w-full text-left"
        style={{
          background: "var(--ink)",
          border: "1.5px solid var(--brand-raspberry)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
        }}
        onClick={() => {
          sfx.tap();
          nav({ to: "/kid/insights" });
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--primary)" }}
        >
          <AppIcon name="star" size={20} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-bold tracking-wide leading-tight"
            style={{ color: "#ffffff" }}
          >
            Big week for transfers! You made {data.txs.length} transactions and earned {Math.round(Number(k.coins))} stardust!
          </p>
        </div>
      </button>

      {/* Penny missions — Centsibility equivalent of AEON mission cards */}
      <div className="aeon-section-tag">
        <span>PENNY MISSIONS</span>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[var(--border)] shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface-pink)] flex items-center justify-center font-black text-xs text-[var(--primary)] shrink-0 shadow-inner">
            BOOST
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--ink)]">Give Life a Boost!</h4>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Ends 15 Oct 2026</p>
            <Link
              to="/kid/quiz"
              onClick={() => sfx.tap()}
              className="text-xs font-bold text-[var(--ink)] hover:text-[var(--primary)] inline-flex items-center gap-1 mt-2"
            >
              <span>Explore more</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="aeon-dots" aria-hidden="true">
        <span className="aeon-dot-active" />
        <span className="aeon-dot-inactive" />
      </div>

      {/* Benchmark Image 5: Spending Summary */}
      <div className="aeon-section-tag">
        <span>SPENDING SUMMARY</span>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[var(--border)] shadow-sm flex items-center justify-between gap-4">
        <div>
          <span className="text-xs text-[var(--text-secondary)] font-medium">This month's spending</span>
          <div className="text-2xl font-extrabold text-[var(--ink)] mt-1 tabular-nums">
            RM{data.txs.filter(isOutflow).reduce((acc, t) => acc + Number(t.amount), 0).toFixed(2)}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              sfx.tap();
              nav({ to: "/kid/insights" });
            }}
            className="mt-3 text-xs font-bold"
          >
            View Insights
          </Button>
        </div>

        {/* Circular Donut Graphic */}
        <div className="w-16 h-16 rounded-full border-4 border-[var(--primary)] border-t-[var(--navy-dark)] border-r-[var(--success)] flex items-center justify-center text-[var(--ink)] font-bold text-xs shrink-0 shadow-sm">
          <AppIcon name="trend" size={22} color="var(--primary)" />
        </div>
      </div>

      {/* Unclaimed Coins banner if present */}
      {k.unclaimed_coins > 0 && (
        <button
          type="button"
          onClick={claim}
          aria-label={`Claim ${Math.round(Number(k.unclaimed_coins))} unclaimed points`}
          className="w-full text-left mt-4 transition-transform active:scale-[0.98] cursor-pointer"
        >
          <Card variant="soft" className="p-4 border border-[var(--success)]/30 bg-[var(--success-soft)]/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center shrink-0">
                <AppIcon name="gift" size={20} />
              </div>
              <div>
                <strong className="text-sm font-bold text-[var(--ink)] block">
                  Unclaimed Points Available!
                </strong>
                <small className="text-xs text-[var(--text-secondary)]">Tap here to add to your balance</small>
              </div>
            </div>
            <div className="text-base font-extrabold text-[var(--success)] tabular-nums shrink-0">
              +{Math.round(Number(k.unclaimed_coins))}
            </div>
          </Card>
        </button>
      )}

      {/* Stats Chips */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <StatChip icon="star" label="Level" value={k.level.toString()} />
        <StatChip icon="target" label="XP" value={`${k.xp}/100`} />
        <StatChip icon="trust" label="Trust" value={k.trust_score.toString()} />
      </div>

      <SectionTitle>Quick Money Requests</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="primary" onClick={() => setMoneyReq("DEPOSIT")} className="justify-center">
          <AppIcon name="plus" size={16} />
          Ask Deposit
        </Button>
        <Button variant="secondary" onClick={() => setMoneyReq("WITHDRAWAL")} className="justify-center">
          <AppIcon name="minus" size={16} />
          Ask Withdraw
        </Button>
      </div>

      {moneyReq && (
        <Card variant="default" className="mt-4 p-5 space-y-4 border border-[var(--border)]">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border)]">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
              <AppIcon name={moneyReq === "DEPOSIT" ? "deposit" : "withdrawal"} size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">
                {moneyReq === "DEPOSIT" ? "Ask Parent to Deposit" : "Ask Parent to Withdraw"}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {moneyReq === "DEPOSIT" ? "Add savings to your digital wallet" : "Convert digital balance into cash"}
              </p>
            </div>
          </div>
          <MoneyKeypad
            min={0.5}
            max={moneyReq === "WITHDRAWAL" ? Number(k.balance) : 10000}
            showReference
            confirmLabel={
              moneyReq === "DEPOSIT" ? "Send Deposit Request" : "Send Withdrawal Request"
            }
            onConfirm={submitMoneyReq}
            onCancel={() => setMoneyReq(null)}
          />
        </Card>
      )}

      {showReward && (
        <Card variant="default" className="mt-4 p-5 space-y-4 border border-[var(--border)]">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
                <AppIcon name="gift" size={18} />
              </div>
              <h3 className="text-sm font-bold text-[var(--ink)]">Custom Wishlist Request</h3>
            </div>
            <span className="text-xs font-bold text-[var(--primary)] flex items-center gap-1">
              {Math.round(Number(k.coins)).toLocaleString()} <AppIcon name="star" size={12} />
            </span>
          </div>
          <Input
            label="What would you like to request?"
            value={rName}
            onChange={(e) => setRName(e.target.value)}
            placeholder="e.g. New book, day trip, ice cream treat"
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
        <div className="space-y-3">
          <SectionTitle>Waiting for Parent Authorization</SectionTitle>
          <div className="space-y-2.5">
            {pendingApprovals.map((a: (typeof pendingApprovals)[number]) => (
              <Card key={a.id} variant="default" className="p-4 border border-[var(--border)] flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.kind === "QARD" ? "warning" : "brand"}>{a.kind}</Badge>
                    <span className="text-xs font-semibold text-[var(--ink)]">{cleanApprovalReason(a.reason)}</span>
                  </div>
                  <small className="text-[11px] text-[var(--text-muted)] mt-1 block">Sent to parent for review</small>
                </div>
                <div className="text-base font-bold text-[var(--ink)] tabular-nums shrink-0">
                  RM {Number(a.amount).toFixed(2)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.loans.filter((l: (typeof data.loans)[number]) => l.status === "active").length > 0 && (
        <div className="space-y-3">
          <SectionTitle>My Benevolent Loans (Qard)</SectionTitle>
          <div className="space-y-2.5">
            {data.loans
              .filter((l: (typeof data.loans)[number]) => l.status === "active")
              .map((l: (typeof data.loans)[number]) => {
                const remaining = Number(l.amount) - Number(l.repaid);
                const overdue = new Date(l.due_date) < new Date();
                return (
                  <Card key={l.id} variant="default" className="p-4 border border-[var(--border)] flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={overdue ? "error" : "warning"}>{overdue ? "Overdue" : "Active"}</Badge>
                        <strong className="text-sm font-bold text-[var(--ink)]">{l.reason || "Qard loan"}</strong>
                      </div>
                      <small className="text-xs text-[var(--text-secondary)] mt-0.5 block">
                        Due: {l.due_date}
                      </small>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-[var(--ink)] tabular-nums">
                        RM {remaining.toFixed(2)}
                      </div>
                      <Link to="/kid/loans" className="text-xs font-bold text-[var(--primary)] hover:underline inline-block mt-0.5">
                        Repay →
                      </Link>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}


      <SectionTitle>Transaction History</SectionTitle>
      <Card variant="default" className="p-2 divide-y divide-[var(--border)] overflow-hidden">
        {data.txs.map((t: (typeof data.txs)[number]) => (
          <TransactionRow
            key={t.id}
            title={t.label}
            subtitle={t.type}
            date={new Date(t.created_at).toLocaleDateString()}
            amount={Number(t.amount)}
            isIncome={!isOutflow(t)}
            icon={TX_ICON_MAP[t.type] || "transaction"}
          />
        ))}
        {data.txs.length === 0 && (
          <div className="p-6 text-center text-xs text-[var(--text-muted)]">No activity yet.</div>
        )}
      </Card>

      {showProfile && (
        <div className="profile-sheet">
          <div className="profile-sheet__header">
            <h2 className="text-lg font-bold text-[var(--ink)]">My Profile</h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowProfile(false)}>
              Close
            </Button>
          </div>

          <div style={{ maxWidth: "500px", margin: "0 auto" }} className="p-4 space-y-4">
            {showUpload ? (
              <ImageUploadCrop
                busy={savingProfile}
                onSave={handleSaveAvatar}
                onCancel={() => setShowUpload(false)}
              />
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={96} ring />
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowUpload(true)}
                    >
                      Change Picture
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input label="Name" value={k.name} disabled />
                  <Input label="Username (Parent only)" value={k.username || ""} disabled />

                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                      Short Bio
                    </label>
                    <textarea
                      value={pBio}
                      onChange={(e) => setPBio(e.target.value)}
                      maxLength={150}
                      rows={3}
                      placeholder="I love to learn and save money!"
                      className="w-full px-3.5 py-2.5 text-sm text-[var(--ink)] bg-white border border-[var(--border)] rounded-[var(--radius-sm)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none resize-none"
                    />
                    <small className="text-[11px] text-[var(--text-muted)] block text-right mt-0.5">
                      {pBio.length}/150
                    </small>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Birth Date"
                      type="date"
                      value={pBirthDate}
                      onChange={(e) => setPBirthDate(e.target.value)}
                    />
                    <Input
                      label="Birth Year"
                      type="number"
                      placeholder="YYYY"
                      value={pBirthYear}
                      onChange={(e) => setPBirthYear(e.target.value)}
                    />
                  </div>

                  {data.parent && (
                    <Card variant="soft" className="p-3 space-y-1">
                      <small className="text-xs text-[var(--text-secondary)] font-medium">Linked to Parent</small>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {data.parent.display_name || "Parent"}
                      </div>
                      <small className="text-xs text-[var(--text-muted)]">{data.parent.email}</small>
                    </Card>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    loading={savingProfile}
                    className="w-full justify-center mt-2"
                  >
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}
