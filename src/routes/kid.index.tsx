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

  return (
    <>
      <div className="wireframe-space-between">
        <button
          type="button"
          onClick={openProfile}
          aria-label="Open profile settings"
          className="wireframe-row"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={56} />
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0 }}>السلام عليكم</p>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Cmdr. {k.name}!</h1>
          </div>
        </button>
        <div className="wireframe-box" role="status" aria-label={`${k.streak} day streak`}>
          [icon: trend] <strong>{k.streak}d Orbit</strong>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <QuoteCard variant="kid" />
      </div>

      <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
        <div className="wireframe-space-between">
          <small>Hyperdrive Core (RM)</small>
          <button
            type="button"
            onClick={() => setHideBalance(!hideBalance)}
            aria-label={hideBalance ? "Show balance" : "Hide balance"}
          >
            {hideBalance ? "[icon: show]" : "[icon: hide]"}
          </button>
        </div>
        <div style={{ fontSize: "2rem", fontWeight: "bold", margin: "0.5rem 0" }}>
          {hideBalance ? "RM •••" : `RM ${Number(k.balance).toFixed(2)}`}
        </div>
        <div className="wireframe-row">
          <small>Hibah {(Number(k.hibah_rate) * 100).toFixed(0)}%</small>
          <small>100% Halal [✓]</small>
        </div>
      </Card>

      {/* Points reward currency — separate from money */}
      <div className="wireframe-grid-2" style={{ marginTop: "0.75rem" }}>
        <div className="wireframe-box">
          <small>Stardust</small>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {Math.round(Number(k.coins)).toLocaleString()} [icon: star]
          </div>
          <small>Fuel for rewards.</small>
        </div>
        <div className="wireframe-box">
          <small>Cosmic Growth</small>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
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
          className="wireframe-card"
          style={{ width: "100%", marginTop: "0.75rem", textAlign: "left" }}
        >
          <div className="wireframe-space-between">
            <div>
              <strong>[icon: gift] Unclaimed stardust!</strong>
              <div><small>Tap to claim your fuel</small></div>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
              +{Math.round(Number(k.unclaimed_coins))} [icon: star]
            </div>
          </div>
        </button>
      )}

      <div className="wireframe-grid-3" style={{ marginTop: "0.75rem" }}>
        <StatChip
          icon="[icon: star]"
          label="Level"
          value={k.level.toString()}
          bg=""
        />
        <StatChip
          icon="[icon: target]"
          label="XP"
          value={`${k.xp}/100`}
          bg=""
        />
        <StatChip
          icon="[icon: trust]"
          label="Trust"
          value={k.trust_score.toString()}
          bg=""
        />
      </div>

      <div className="wireframe-grid-2" style={{ marginTop: "1rem" }}>
        <ActionTile
          to="/kid/goals"
          icon="[icon: target]"
          title="Missions"
          sub="Save for things"
          bg=""
          text=""
        />
        <ActionTile
          to="/kid/quiz"
          icon="[icon: trend]"
          title="Daily Quest"
          sub="Earn stardust"
          bg=""
          text=""
        />
        <ActionTile
          to="/kid/invest"
          icon="[icon: leaf]"
          title="Invest"
          sub="Grow your money"
          bg=""
          text=""
        />
        <ActionTile
          to="/kid/loans"
          icon="[icon: loan]"
          title="Qard Loan"
          sub="Borrow with sign"
          bg=""
          text=""
        />
        <ActionTile
          to="/kid/sadaqah"
          icon="[icon: users]"
          title="Sadaqah"
          sub="Help others"
          bg=""
          text=""
        />
        <ActionTile
          to="/kid/zakat"
          icon="[icon: mosque]"
          title="Zakat Calc"
          sub="2.5% calculator"
          bg=""
          text=""
        />
        <button
          type="button"
          onClick={() => setShowReward(true)}
          className="wireframe-card"
          style={{ textAlign: "left" }}
        >
          <div>[icon: gift]</div>
          <strong>Reward</strong>
          <div><small>Spend stardust</small></div>
        </button>
      </div>

      <SectionTitle>Transmission Requests</SectionTitle>
      <div className="wireframe-grid-2">
        <button
          type="button"
          onClick={() => setMoneyReq("DEPOSIT")}
        >
          [icon: plus] Ask Deposit
        </button>
        <button
          type="button"
          onClick={() => setMoneyReq("WITHDRAWAL")}
        >
          [icon: minus] Ask Withdraw
        </button>
      </div>

      {moneyReq && (
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>
            {moneyReq === "DEPOSIT" ? "[icon: deposit] Ask parent to deposit" : "[icon: withdrawal] Ask parent to withdraw"}
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
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: gift] Request a custom reward</h3>
          <p>
            You have {Math.round(Number(k.coins)).toLocaleString()} [icon: star]
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
              <Card key={a.id} className="wireframe-box">
                <div className="wireframe-space-between">
                  <div>
                    <strong>{a.kind}</strong>
                    <div><small>{cleanApprovalReason(a.reason)}</small></div>
                  </div>
                  <div><strong>RM {a.amount}</strong></div>
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
                  <Card key={l.id} className="wireframe-box">
                    <div className="wireframe-space-between">
                      <div>
                        <strong>{l.reason || "Qard loan"}</strong>
                        <div>
                          <small>
                            Due {l.due_date} {overdue && <span>· OVERDUE</span>}
                          </small>
                        </div>
                      </div>
                      <div><strong>RM {remaining.toFixed(2)}</strong></div>
                    </div>
                    <Link
                      to="/kid/loans"
                      style={{ marginTop: "0.5rem", display: "inline-block" }}
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
      <div className="wireframe-col">
        {data.txs.map((t: (typeof data.txs)[number]) => (
          <div key={t.id} className="wireframe-space-between wireframe-box">
            <div className="wireframe-row">
              {txEmoji(t.type)}
              <div>
                <strong>{t.label}</strong>
                <div>
                  <small>{new Date(t.created_at).toLocaleDateString()} · {t.type}</small>
                </div>
              </div>
            </div>
            <div>
              <strong>
                {["WITHDRAWAL", "SADAQAH", "INVEST_IN"].includes(t.type) ||
                (t.type === "QARD" && t.label === "Loan repayment")
                  ? "-"
                  : "+"}
                RM {Number(t.amount).toFixed(2)}
              </strong>
            </div>
          </div>
        ))}
        {data.txs.length === 0 && (
          <Card className="wireframe-box">No activity yet.</Card>
        )}
      </div>

      {showProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "#fff",
            padding: "1rem",
            overflowY: "auto",
          }}
        >
          <div className="wireframe-space-between" style={{ borderBottom: "1px solid #ccc", paddingBottom: "0.5rem" }}>
            <h2>My Profile</h2>
            <button type="button" onClick={() => setShowProfile(false)}>
              Close
            </button>
          </div>

          <div style={{ maxWidth: "500px", margin: "1rem auto" }}>
            {showUpload ? (
              <ImageUploadCrop
                busy={savingProfile}
                onSave={handleSaveAvatar}
                onCancel={() => setShowUpload(false)}
              />
            ) : (
              <div className="wireframe-col">
                <div style={{ textAlign: "center" }}>
                  <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={96} />
                  <div>
                    <button type="button" onClick={() => setShowUpload(true)} style={{ marginTop: "0.5rem" }}>
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
                    <small>{pBio.length}/150</small>
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
                    <div className="wireframe-box">
                      <small>Linked to Parent</small>
                      <div><strong>{data.parent.display_name || "Parent"}</strong></div>
                      <small>{data.parent.email}</small>
                    </div>
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
