import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
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
  ActionTile,
  RewardCoinPicker,
  txEmoji,
} from "@/features/kid/components";
import { AppIcon } from "@/components/ui/app-icon";

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
      <div className="wireframe-col">
        <Skeleton style={{ height: "4rem" }} />
        <Skeleton style={{ height: "8rem" }} />
        <div className="wireframe-grid-2">
          <Skeleton style={{ height: "6rem" }} />
          <Skeleton style={{ height: "6rem" }} />
        </div>
        <Skeleton style={{ height: "10rem" }} />
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

      <Card variant="brand" className="balance-card">
        <div className="wireframe-space-between">
          <span className="balance-card__label">Hyperdrive Core (RM)</span>
          <button
            type="button"
            className="balance-card__toggle"
            onClick={() => setHideBalance(!hideBalance)}
            aria-label={hideBalance ? "Show balance" : "Hide balance"}
          >
            <AppIcon name={hideBalance ? "show" : "hide"} size={18} color="#fff" />
          </button>
        </div>
        <div className="text-balance" style={{ color: "#fff", margin: "0.5rem 0" }}>
          {hideBalance ? "RM •••" : `RM ${Number(k.balance).toFixed(2)}`}
        </div>
        <div className="balance-card__meta">
          <small>Hibah {(Number(k.hibah_rate) * 100).toFixed(0)}%</small>
          <small>100% Halal</small>
        </div>
      </Card>

      <div className="wireframe-grid-2" style={{ marginTop: "0.75rem" }}>
        <div className="metric-card">
          <small className="text-secondary">Stardust</small>
          <div className="metric-card__value">
            {Math.round(Number(k.coins)).toLocaleString()}
            <AppIcon name="star" size={18} color="var(--lavender-purple)" />
          </div>
          <small className="text-muted">Fuel for rewards.</small>
        </div>
        <div className="metric-card">
          <small className="text-secondary">Cosmic Growth</small>
          <div className="metric-card__value">
            {hideBalance ? "RM •••" : `RM ${Number(k.invest_balance ?? 0).toFixed(2)}`}
          </div>
          <Link to="/kid/invest">Manage →</Link>
        </div>
      </div>

      {k.unclaimed_coins > 0 && (
        <button
          type="button"
          onClick={claim}
          aria-label={`Claim ${Math.round(Number(k.unclaimed_coins))} unclaimed points`}
          className="claim-banner"
        >
          <div className="wireframe-space-between">
            <div>
              <strong className="wireframe-row">
                <AppIcon name="gift" size={18} color="var(--success)" />
                Unclaimed stardust!
              </strong>
              <div>
                <small className="text-secondary">Tap to claim your fuel</small>
              </div>
            </div>
            <div className="text-amount" style={{ color: "var(--success)" }}>
              +{Math.round(Number(k.unclaimed_coins))}
            </div>
          </div>
        </button>
      )}

      <div className="wireframe-grid-3" style={{ marginTop: "0.75rem" }}>
        <StatChip icon="star" label="Level" value={k.level.toString()} />
        <StatChip icon="target" label="XP" value={`${k.xp}/100`} />
        <StatChip icon="trust" label="Trust" value={k.trust_score.toString()} />
      </div>

      <div className="wireframe-grid-2" style={{ marginTop: "1rem" }}>
        <ActionTile to="/kid/goals" icon="target" title="Missions" sub="Save for things" />
        <ActionTile to="/kid/quiz" icon="trend" title="Daily Quest" sub="Earn stardust" />
        <ActionTile to="/kid/invest" icon="leaf" title="Invest" sub="Grow your money" />
        <ActionTile to="/kid/loans" icon="loan" title="Qard Loan" sub="Borrow with sign" />
        <ActionTile to="/kid/sadaqah" icon="users" title="Sadaqah" sub="Help others" />
        <ActionTile to="/kid/zakat" icon="mosque" title="Zakat Calc" sub="2.5% calculator" />
        <button
          type="button"
          data-variant="secondary"
          onClick={() => setShowReward(true)}
          className="action-tile"
          style={{ width: "100%" }}
        >
          <span className="action-tile__icon" aria-hidden>
            <AppIcon name="gift" size={22} color="var(--indigo-velvet)" />
          </span>
          <strong className="action-tile__title">Reward</strong>
          <small className="action-tile__sub">Spend stardust</small>
        </button>
      </div>

      <SectionTitle>Transmission Requests</SectionTitle>
      <div className="wireframe-grid-2">
        <button type="button" onClick={() => setMoneyReq("DEPOSIT")}>
          <AppIcon name="plus" size={16} />
          Ask Deposit
        </button>
        <button type="button" data-variant="secondary" onClick={() => setMoneyReq("WITHDRAWAL")}>
          <AppIcon name="minus" size={16} />
          Ask Withdraw
        </button>
      </div>

      {moneyReq && (
        <Card style={{ marginTop: "1rem" }}>
          <h3 className="wireframe-row">
            <AppIcon name={moneyReq === "DEPOSIT" ? "deposit" : "withdrawal"} size={20} />
            {moneyReq === "DEPOSIT" ? "Ask parent to deposit" : "Ask parent to withdraw"}
          </h3>
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
        <Card style={{ marginTop: "1rem" }}>
          <h3 className="wireframe-row">
            <AppIcon name="gift" size={20} />
            Request a custom reward
          </h3>
          <p className="wireframe-row">
            You have {Math.round(Number(k.coins)).toLocaleString()}
            <AppIcon name="star" size={16} color="var(--lavender-purple)" />
          </p>
          <input
            value={rName}
            onChange={(e) => setRName(e.target.value)}
            placeholder="e.g. New book, day trip, ice cream"
            maxLength={100}
            style={{ marginBottom: "0.5rem" }}
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
          <div className="wireframe-col">
            {pendingApprovals.map((a: (typeof pendingApprovals)[number]) => (
              <Card key={a.id} variant="soft">
                <div className="wireframe-space-between">
                  <div>
                    <strong>{a.kind}</strong>
                    <div>
                      <small className="text-secondary">{cleanApprovalReason(a.reason)}</small>
                    </div>
                  </div>
                  <div className="text-amount">RM {a.amount}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {data.loans.filter((l: (typeof data.loans)[number]) => l.status === "active").length > 0 && (
        <>
          <SectionTitle>My Loans (Qard)</SectionTitle>
          <div className="wireframe-col">
            {data.loans
              .filter((l: (typeof data.loans)[number]) => l.status === "active")
              .map((l: (typeof data.loans)[number]) => {
                const remaining = Number(l.amount) - Number(l.repaid);
                const overdue = new Date(l.due_date) < new Date();
                return (
                  <Card key={l.id}>
                    <div className="wireframe-space-between">
                      <div>
                        <strong>{l.reason || "Qard loan"}</strong>
                        <div>
                          <small className="text-secondary">
                            Due {l.due_date}{" "}
                            {overdue && <span style={{ color: "var(--error)" }}>· OVERDUE</span>}
                          </small>
                        </div>
                      </div>
                      <div className="text-amount">RM {remaining.toFixed(2)}</div>
                    </div>
                    <Link to="/kid/loans" style={{ marginTop: "0.5rem", display: "inline-block" }}>
                      Repay →
                    </Link>
                  </Card>
                );
              })}
          </div>
        </>
      )}

      <SectionTitle>Transaction History</SectionTitle>
      <div className="wireframe-col">
        {data.txs.map((t: (typeof data.txs)[number]) => (
          <div key={t.id} className="tx-row">
            <div className="wireframe-row">
              {txEmoji(t.type)}
              <div>
                <strong>{t.label}</strong>
                <div>
                  <small className="text-muted">
                    {new Date(t.created_at).toLocaleDateString()} · {t.type}
                  </small>
                </div>
              </div>
            </div>
            <div
              className={`tx-row__amount ${isOutflow(t) ? "amount-out" : "amount-in"}`}
            >
              {isOutflow(t) ? "-" : "+"}RM {Number(t.amount).toFixed(2)}
            </div>
          </div>
        ))}
        {data.txs.length === 0 && (
          <Card variant="soft">No activity yet.</Card>
        )}
      </div>

      {showProfile && (
        <div className="profile-sheet">
          <div className="profile-sheet__header">
            <h2>My Profile</h2>
            <button type="button" data-variant="secondary" onClick={() => setShowProfile(false)}>
              Close
            </button>
          </div>

          <div style={{ maxWidth: "500px", margin: "0 auto" }}>
            {showUpload ? (
              <ImageUploadCrop
                busy={savingProfile}
                onSave={handleSaveAvatar}
                onCancel={() => setShowUpload(false)}
              />
            ) : (
              <div className="wireframe-col">
                <div style={{ textAlign: "center" }}>
                  <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={96} ring />
                  <div>
                    <button
                      type="button"
                      data-variant="secondary"
                      onClick={() => setShowUpload(true)}
                      style={{ marginTop: "0.5rem" }}
                    >
                      Change Picture
                    </button>
                  </div>
                </div>

                <div className="wireframe-col">
                  <div>
                    <label>Name</label>
                    <input value={k.name} disabled />
                  </div>
                  <div>
                    <label>Username (Parent only)</label>
                    <input value={k.username || ""} disabled />
                  </div>

                  <div>
                    <label>Short Bio</label>
                    <textarea
                      value={pBio}
                      onChange={(e) => setPBio(e.target.value)}
                      maxLength={150}
                      rows={3}
                      placeholder="I love to learn and save money!"
                    />
                    <small className="text-muted">{pBio.length}/150</small>
                  </div>

                  <div className="wireframe-grid-2">
                    <div>
                      <label>Birth Date</label>
                      <input
                        type="date"
                        value={pBirthDate}
                        onChange={(e) => setPBirthDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>Birth Year</label>
                      <input
                        type="number"
                        placeholder="YYYY"
                        value={pBirthYear}
                        onChange={(e) => setPBirthYear(e.target.value)}
                      />
                    </div>
                  </div>

                  {data.parent && (
                    <Card variant="soft">
                      <small className="text-secondary">Linked to Parent</small>
                      <div>
                        <strong>{data.parent.display_name || "Parent"}</strong>
                      </div>
                      <small className="text-muted">{data.parent.email}</small>
                    </Card>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    style={{ marginTop: "1rem" }}
                  >
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
