import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
  KidLoadError,
  StatChip,
  RewardCoinPicker,
  TX_ICON_MAP,
} from "@/features/kid/components";
import { AppIcon } from "@/components/ui/app-icon";
import { startOfMonth } from "date-fns";
import { formatDate, formatRM } from "@/lib/format";
import {
  getBalanceSummary,
  isDebitTransaction,
  isSpendingTransaction,
  isWalletTransaction,
} from "@/lib/finance";
import { transactionTitle, transactionTypeLabel, approvalKindLabel } from "@/lib/labels";
import { useMoneyAction } from "@/hooks/use-money-action";

export const Route = createFileRoute("/kid/")({
  head: () => ({ meta: [{ title: "Kid Home — Centsibility" }] }),
  component: KidHome,
});

function KidHome() {
  const nav = useNavigate();
  const { data, loading, error, refresh } = useKidData();
  const { busy, run } = useMoneyAction();
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
  const [balanceSlide, setBalanceSlide] = useState(0);
  // Mouse drag-to-scroll for the balance carousel (touch already scrolls natively).
  const carouselRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const onCarouselPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = carouselRef.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const onCarouselPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = carouselRef.current;
    if (!drag.current.down || !el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };
  const onCarouselPointerUp = () => {
    drag.current.down = false;
  };

  if (!data && error) return <KidLoadError onRetry={refresh} />;
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
  const walletTxs = data.txs.filter((t: (typeof data.txs)[number]) => isWalletTransaction(t.type));

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
    const rewardName = rName.trim();
    await run(
      () => edgeKidRequestReward({ code, name: rewardName, cost }),
      {
        success: `Reward request sent: ${rewardName}`,
        failure: "Reward request didn't go through",
        onSuccess: () => {
          setShowReward(false);
          setRName("");
        },
        refresh,
      }
    );
  };

  const submitMoneyReq = async (amount: number, reference?: string) => {
    if (!code || !moneyReq) return;
    const actionWord = moneyReq === "DEPOSIT" ? "Deposit" : "Withdrawal";
    await run(
      () =>
        edgeKidRequestApproval({
          code,
          kind: moneyReq,
          amount,
          reason: reference || (moneyReq === "DEPOSIT" ? "Deposit request" : "Withdrawal request"),
        }),
      {
        success: `${actionWord} request for ${formatRM(amount)} sent for approval`,
        failure: `${actionWord} request didn't go through`,
        onSuccess: () => {
          setMoneyReq(null);
        },
        refresh,
      }
    );
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
      // Only send birthday when it has not been persisted yet to avoid server guard errors.
      const birthdayAlreadySet = !!(k.birth_date || k.birth_year);
      await edgeKidUpdateProfile({
        code,
        bio: pBio.trim() || undefined,
        birth_date: birthdayAlreadySet ? undefined : (pBirthDate || undefined),
        birth_year: birthdayAlreadySet ? undefined : (pBirthYear ? parseInt(pBirthYear) : undefined),
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
      <div className="kid-greeting">
        <button
          type="button"
          onClick={openProfile}
          aria-label="Open profile settings"
          className="kid-greeting__profile"
        >
          <AvatarBubble emoji={k.avatar ?? "phosphor:Smiley"} size={48} ring />
          <div>
            <h1 className="kid-greeting__name">{k.comfort_name ?? k.name}!</h1>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <div className="kid-streak" role="status" aria-label={`${k.streak} day streak`}>
            <AppIcon name="trend" size={16} color="var(--indigo-velvet)" />
            {k.streak}-day streak
          </div>
          <Link
            to="/kid/notifications"
            className="relative p-2 rounded-full hover:bg-[var(--surface-soft)] text-[var(--ink)] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            aria-label={`Notifications${(data.unreadNotifications ?? 0) > 0 ? `, ${data.unreadNotifications} unread` : ""}`}
            onClick={() => sfx.tap()}
          >
            <AppIcon name="bell" size={20} />
            {(data.unreadNotifications ?? 0) > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-extrabold flex items-center justify-center leading-none">
                {(data.unreadNotifications ?? 0) > 9 ? "9+" : data.unreadNotifications}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Balance carousel: the next card peeks in, so the dots mean something */}
      <div
        ref={carouselRef}
        className="balance-carousel"
        role="region"
        aria-label="Balances"
        onScroll={(e) => {
          const el = e.currentTarget;
          const first = el.firstElementChild as HTMLElement | null;
          const step = first ? first.offsetWidth + 12 : el.clientWidth;
          setBalanceSlide(Math.round(el.scrollLeft / step));
        }}
        onPointerDown={onCarouselPointerDown}
        onPointerMove={onCarouselPointerMove}
        onPointerUp={onCarouselPointerUp}
        onPointerLeave={onCarouselPointerUp}
        onPointerCancel={onCarouselPointerUp}
      >
        <div className="balance-carousel__slide">
          {(() => {
            const summary = getBalanceSummary(k, data.goals, data.loans);
            return (
              <BalanceCard
                title="Spending balance"
                balance={summary.spending}
                secondaryBalance={{
                  label: "Total balance",
                  amount: summary.total,
                }}
                breakdown={[
                  { label: "Spending", amount: summary.spending },
                  { label: "Tabung", amount: summary.tabung },
                  { label: "Growth Tabung", amount: summary.growth },
                ]}
                footnote={
                  summary.owed > 0
                    ? `Owed on loans: ${formatRM(summary.owed)} (not taken off your total)`
                    : undefined
                }
                hideBalance={hideBalance}
                onToggleHide={() => setHideBalance(!hideBalance)}
                onArrowClick={() => nav({ to: "/kid/wallet" })}
                metadata={[
                  { label: "Hibah", value: `${(Number(k.hibah_rate) * 100).toFixed(0)}%` },
                  { label: "100% Halal" },
                ]}
              />
            );
          })()}
        </div>
        <Link
          to="/kid/missions"
          onClick={(e) => {
            if (drag.current.moved) {
              e.preventDefault();
              return;
            }
            sfx.tap();
          }}
          className="balance-carousel__slide points-card"
          aria-label={`${Math.round(Number(k.coins))} reward points, open missions`}
        >
          <span className="points-card__label">Reward points</span>
          <strong className="points-card__value tabular-nums">
            {hideBalance ? "******" : Math.round(Number(k.coins)).toLocaleString("en-MY")}
          </strong>
          <span className="points-card__meta">
            Level {k.level} · {k.xp} XP
          </span>
        </Link>
      </div>
      <div className="pager-dots" aria-hidden="true">
        {[0, 1].map((i) => (
          <span key={i} className={i === balanceSlide ? "pager-dot--active" : "pager-dot"} />
        ))}
      </div>

      {/* 4 x 2 quick actions: white circles on the canvas */}
      <div className="quick-grid">
        {/* Row 1 */}
        <Link
          to="/kid/transfer"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle">
            <AppIcon name="transfer" size={24} />
          </span>
          <span className="quick-label">Transfer</span>
        </Link>

        <Link
          to="/kid/history"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle">
            <AppIcon name="history" size={22} />
          </span>
          <span className="quick-label">History</span>
        </Link>

        <Link
          to="/kid/goals"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle quick-circle--aqua">
            <AppIcon name="save" size={24} />
          </span>
          <span className="quick-label">Tabung</span>
        </Link>

        <Link
          to="/kid/zakat"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle quick-circle--amber">
            <span className="quick-circle__dot" aria-hidden="true" />
            <AppIcon name="mosque" size={22} />
          </span>
          <span className="quick-label">Zakat</span>
        </Link>

        {/* Row 2 */}
        <Link
          to="/kid/loans"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle">
            <AppIcon name="loan" size={22} />
          </span>
          <span className="quick-label">Loans</span>
        </Link>

        <Link
          to="/kid/missions"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle quick-circle--amber">
            <AppIcon name="missions" size={22} />
          </span>
          <span className="quick-label">Missions</span>
        </Link>


        <Link
          to="/kid/sadaqah"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle quick-circle--aqua">
            <span className="quick-circle__dot" aria-hidden="true" />
            <AppIcon name="sadaqah" size={22} />
          </span>
          <span className="quick-label">Sadaqah</span>
        </Link>

        <Link
          to="/kid/chat"
          onClick={() => sfx.tap()}
          className="quick-btn"
        >
          <span className="quick-circle quick-circle--coral">
            <AppIcon name="penny" size={24} />
          </span>
          <span className="quick-label">Penny</span>
        </Link>
      </div>

      {/* One promotion, text left and art right */}
      <div className="promo-banner promo-banner--aqua">
        <div className="max-w-[70%]">
          <h3 className="text-base font-bold text-[var(--ink)] leading-snug m-0">
            Give sadaqah and earn points. Start with RM1.
          </h3>
          <button
            type="button"
            onClick={() => {
              sfx.pop();
              nav({ to: "/kid/sadaqah" });
            }}
            className="promo-banner__btn promo-banner__btn--aqua"
          >
            Give now
          </button>
        </div>
        <div className="w-16 h-16 rounded-full bg-white/60 flex items-center justify-center text-[var(--secondary-text)] shrink-0">
          <AppIcon name="sadaqah" size={30} />
        </div>
      </div>

      <div className="section-tag">
        <span>Insights</span>
      </div>

      <button
        type="button"
        className="insights-recap"
        onClick={() => {
          sfx.tap();
          nav({ to: "/kid/insights" });
        }}
      >
        <span className="insights-recap__avatar" aria-hidden="true">
          <AppIcon name="star" size={20} color="#fff" />
        </span>
        <span className="insights-recap__text">
          Big week! You made {walletTxs.length} transactions and earned{" "}
          {Math.round(Number(k.coins))} points.
        </span>
      </button>

      <div className="section-tag">
        <span>Missions</span>
      </div>

      <div className="bg-white rounded-2xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--surface-pink)] flex items-center justify-center text-[var(--primary-text)] shrink-0">
          <AppIcon name="quest" size={24} />
        </div>
        <div className="min-w-0">
          <h4 className="text-base font-bold text-[var(--ink)] m-0">Missions</h4>
          <p className="text-sm text-[var(--text-muted)] mt-0.5 mb-0">
            Learn money skills and earn points
          </p>
          <Link
            to="/kid/missions"
            onClick={() => sfx.tap()}
            className="text-sm font-bold text-[var(--ink)] hover:text-[var(--primary-text)] inline-flex items-center gap-1 mt-2"
          >
            <span>Open Missions</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className="section-tag">
        <span>Spending summary</span>
      </div>

      <div className="bg-white rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <span className="text-sm text-[var(--text-secondary)] font-medium">This month's spending</span>
          <div className="text-2xl font-extrabold text-[var(--ink)] mt-1 tabular-nums">
            {formatRM(
              walletTxs
                .filter(
                  (t) =>
                    isSpendingTransaction(t.type, t.label) &&
                    new Date(t.created_at) >= startOfMonth(new Date()),
                )
                .reduce((acc, t) => acc + Number(t.amount), 0),
            )}
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

        <div className="w-16 h-16 rounded-full border-2 border-[var(--primary)] flex items-center justify-center shrink-0">
          <AppIcon name="trend" size={22} color="var(--primary)" />
        </div>
      </div>

      <div className="mt-6">
        <QuoteCard variant="kid" />
      </div>

      {/* Unclaimed Coins banner if present */}
      {k.unclaimed_coins > 0 && (
        <button
          type="button"
          onClick={claim}
          aria-label={`Claim ${Math.round(Number(k.unclaimed_coins))} unclaimed points`}
          className="block w-full text-left mt-4 transition-transform active:scale-[0.98] cursor-pointer"
        >
          <Card variant="soft" className="p-4 border border-[var(--success)]/30 bg-[var(--success-soft)]/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--success-soft)] text-[var(--success-text)] flex items-center justify-center shrink-0">
                <AppIcon name="gift" size={20} />
              </div>
              <div>
                <strong className="text-sm font-bold text-[var(--ink)] block">
                  Unclaimed Points Available!
                </strong>
                <small className="text-xs text-[var(--text-secondary)]">Tap here to add to your balance</small>
              </div>
            </div>
            <div className="text-base font-extrabold text-[var(--success-text)] tabular-nums shrink-0">
              +{Math.round(Number(k.unclaimed_coins))}
            </div>
          </Card>
        </button>
      )}

      {/* Stats Chips */}
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <StatChip icon="star" label="Level" value={k.level.toString()} />
        <StatChip icon="target" label="XP" value={k.xp.toString()} />
        <StatChip icon="trust" label="Trust" value={k.trust_score.toString()} />
      </div>

      <SectionTitle>Money requests</SectionTitle>
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
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center shrink-0">
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
            busy={busy}
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
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center shrink-0">
                <AppIcon name="gift" size={18} />
              </div>
              <h3 className="text-sm font-bold text-[var(--ink)]">Custom Wishlist Request</h3>
            </div>
            <span className="text-xs font-bold text-[var(--primary-text)] flex items-center gap-1">
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
          <SectionTitle>Waiting for approval</SectionTitle>
          <div className="space-y-2.5">
            {pendingApprovals.map((a: (typeof pendingApprovals)[number]) => (
              <Card key={a.id} variant="default" className="p-4 border border-[var(--border)] flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.kind === "QARD" ? "warning" : "brand"}>{approvalKindLabel(a.kind)}</Badge>
                    <span className="text-xs font-semibold text-[var(--ink)]">{cleanApprovalReason(a.reason)}</span>
                  </div>
                  <small className="text-[11px] text-[var(--text-muted)] mt-1 block">Sent to parent for review</small>
                </div>
                <div className="text-base font-bold text-[var(--ink)] tabular-nums shrink-0">
                  {formatRM(Number(a.amount))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {data.loans.filter((l: (typeof data.loans)[number]) => l.status === "active").length > 0 && (
        <div className="space-y-3">
          <SectionTitle>My Qard loans</SectionTitle>
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
                        Due {formatDate(l.due_date)}
                      </small>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold text-[var(--ink)] tabular-nums">
                        {formatRM(remaining)}
                      </div>
                      <Link to="/kid/loans" className="text-xs font-bold text-[var(--primary-text)] hover:underline inline-block mt-0.5">
                        Repay →
                      </Link>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}


      <div className="flex items-center justify-between">
        <SectionTitle>Transaction History</SectionTitle>
        {walletTxs.length > 0 && (
          <Link
            to="/kid/history"
            onClick={() => sfx.tap()}
            className="text-xs font-semibold text-[var(--primary-text)] hover:underline min-h-[44px] inline-flex items-center"
          >
            See all →
          </Link>
        )}
      </div>
      <Card variant="default" className="p-2 divide-y divide-[var(--border)] overflow-hidden">
        {walletTxs.slice(0, 5).map((t: (typeof walletTxs)[number]) => {
          const title = transactionTitle(t);
          const typeLabel = transactionTypeLabel(t.type, t.label);
          const subtitle = title.trim().toLowerCase() === typeLabel.trim().toLowerCase() ? undefined : typeLabel;
          return (
            <TransactionRow
              key={t.id}
              title={title}
              subtitle={subtitle}
              date={formatDate(t.created_at)}
              amount={Number(t.amount)}
              isIncome={!isDebitTransaction(t.type, t.label)}
              icon={TX_ICON_MAP[t.type] || "transaction"}
            />
          );
        })}
        {walletTxs.length === 0 && (
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

                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Birth Date"
                        type="date"
                        value={pBirthDate}
                        disabled={Boolean(k.birth_date || k.birth_year)}
                        onChange={(e) => setPBirthDate(e.target.value)}
                      />
                      <Input
                        label="Birth Year"
                        type="number"
                        placeholder="YYYY"
                        value={pBirthYear}
                        disabled={Boolean(k.birth_date || k.birth_year)}
                        onChange={(e) => setPBirthYear(e.target.value)}
                      />
                    </div>
                    {Boolean(k.birth_date || k.birth_year) && (
                      <p className="-mt-1 mb-2 text-xs text-[var(--text-muted)]">
                        Ask your parent to change it
                      </p>
                    )}
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
