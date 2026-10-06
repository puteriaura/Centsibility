import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StreakBadge } from "@/components/StreakBadge";
import { useMoney, Money } from "@/features/privacy";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { BalanceCard, TransactionRow } from "@/components/banking";
import { useKidData } from "@/hooks/use-kid-data";
import {
  edgeKidClaimCoins,
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
import { cleanApprovalReason } from "@/lib/qard";
import { KidLoadError, TX_ICON_MAP } from "@/features/kid/components";
import { AppIcon } from "@/components/ui/app-icon";
import { startOfMonth } from "date-fns";
import { formatDate } from "@/lib/format";
import {
  getBalanceSummary,
  isSpendingTransaction,
  isWalletTransaction,
} from "@/lib/finance";
import {
  transactionTitle,
  transactionTypeLabel,
  approvalKindLabel,
} from "@/lib/labels";

// Home order follows the AEON pattern: balance first, then shortcuts, then
// anything waiting on the kid, one promotion, the month, recent activity.
// Dock items (Wallet, Loans, Card) and Penny (header) are not repeated here.
const SHORTCUTS: Array<{ to: string; label: string; icon: string }> = [
  { to: "/kid/transfer", label: "Transfer", icon: "transfer" },
  { to: "/kid/wallet", label: "Request", icon: "deposit" },
  { to: "/kid/goals", label: "Tabung", icon: "save" },
  { to: "/kid/invest", label: "Investment", icon: "trending" },
  { to: "/kid/sadaqah", label: "Sadaqah", icon: "sadaqah" },
  { to: "/kid/missions", label: "Missions", icon: "missions" },
  { to: "/kid/history", label: "History", icon: "history" },
  { to: "/kid/insights", label: "Insights", icon: "reports" },
];

export const Route = createFileRoute("/kid/")({
  head: () => ({ meta: [{ title: "Kid Home | Centsibility" }] }),
  component: KidHome,
});

function KidHome() {
  const nav = useNavigate();
  const { data, loading, error, refresh } = useKidData();

  const [showProfile, setShowProfile] = useState(false);
  const [pBio, setPBio] = useState("");
  const [pBirthDate, setPBirthDate] = useState("");
  const [pBirthYear, setPBirthYear] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const { isMasked, locked, toggleHidden, openUnlockSheet, format } =
    useMoney();
  const [balanceSlide, setBalanceSlide] = useState(0);
  // Mouse drag-to-scroll for the balance carousel (touch already scrolls natively).
  const carouselRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const onCarouselPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if ((e.target as HTMLElement).closest("button")) return;
    const el = carouselRef.current;
    if (!el) return;
    drag.current = {
      down: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
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

  const openProfile = useCallback(() => {
    if (!data?.kid) return;
    setPBio(data.kid.bio || "");
    setPBirthDate(data.kid.birth_date || "");
    setPBirthYear(data.kid.birth_year ? String(data.kid.birth_year) : "");
    setShowProfile(true);
  }, [data?.kid]);

  useEffect(() => {
    if (data?.unreadNotifications !== undefined) {
      window.dispatchEvent(
        new CustomEvent("centsibility:kid-unread", {
          detail: { unread: data.unreadNotifications },
        }),
      );
    }
    if (data?.kid?.avatar) {
      window.dispatchEvent(
        new CustomEvent("centsibility:kid-avatar", {
          detail: { avatar: data.kid.avatar },
        }),
      );
    }
  }, [data]);

  useEffect(() => {
    const handleOpenProfile = () => {
      openProfile();
    };
    window.addEventListener("centsibility:open-profile", handleOpenProfile);
    return () =>
      window.removeEventListener(
        "centsibility:open-profile",
        handleOpenProfile,
      );
  }, [openProfile]);

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
  const walletTxs = data.txs.filter((t: (typeof data.txs)[number]) =>
    isWalletTransaction(t.type),
  );

  const claim = async () => {
    if (!code) return;
    const res = await edgeKidClaimCoins({ code });
    sfx.coin();
    toast.success(`Claimed ${res.claimed.toFixed(0)} pts!`);
    refresh();
  };

  const pendingApprovals = data.approvals.filter(
    (a: (typeof data.approvals)[number]) => a.status === "pending",
  );

  const handleSaveProfile = async () => {
    if (!code) return;
    setSavingProfile(true);
    try {
      // Only send birthday when it has not been persisted yet to avoid server guard errors.
      const birthdayAlreadySet = !!(k.birth_date || k.birth_year);
      await edgeKidUpdateProfile({
        code,
        bio: pBio.trim() || undefined,
        birth_date: birthdayAlreadySet ? undefined : pBirthDate || undefined,
        birth_year: birthdayAlreadySet
          ? undefined
          : pBirthYear
            ? parseInt(pBirthYear)
            : undefined,
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

  const monthStart = startOfMonth(new Date());
  const monthTxs = walletTxs.filter(
    (t: (typeof walletTxs)[number]) => new Date(t.created_at) >= monthStart,
  );
  const monthSpent = monthTxs
    .filter((t) => isSpendingTransaction(t.type, t.label))
    .reduce((acc, t) => acc + Number(t.amount), 0);
  const activeLoans = data.loans.filter(
    (l: (typeof data.loans)[number]) => l.status === "active",
  );
  const unclaimed = Math.round(Number(k.unclaimed_coins) || 0);
  const hasUpdates =
    unclaimed > 0 || pendingApprovals.length > 0 || activeLoans.length > 0;
  const summary = getBalanceSummary(
    k,
    data.goals,
    data.loans,
    (data as { investmentsValue?: number }).investmentsValue,
  );
  const points = Math.round(Number(k.coins)).toLocaleString("en-MY");

  return (
    <>
      <div className="kid-greeting">
        <div className="kid-greeting__profile">
          <span className="kid-greeting__eyebrow">Assalamualaikum</span>
          <h1 className="kid-greeting__name">{k.comfort_name ?? k.name}</h1>
        </div>
        <StreakBadge count={k.streak} />
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
          <BalanceCard
            title="Spending balance"
            balance={summary.spending}
            secondaryBalance={{ label: "Total", amount: summary.total }}
            breakdown={[
              { label: "Spending", amount: summary.spending },
              { label: "Tabung", amount: summary.tabung },
              { label: "Investment", amount: summary.investments },
            ]}
            footnote={
              summary.owed > 0
                ? `Owed on loans: ${format(summary.owed)} (not taken off your total)`
                : undefined
            }
            hideBalance={isMasked}
            onToggleHide={() => {
              if (locked) openUnlockSheet();
              else toggleHidden();
            }}
            onArrowClick={() => nav({ to: "/kid/wallet" })}
            metadata={[
              { label: "Hibah", value: `${(Number(k.hibah_rate) * 100).toFixed(0)}%` },
              { label: "Shariah" },
            ]}
          />
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
          aria-label={`${points} reward points, open missions`}
        >
          <span className="points-card__label">Reward points</span>
          <strong className="points-card__value tabular-nums">{points}</strong>
          <span className="points-card__meta">
            Level {k.level} · {k.xp} XP · Trust {k.trust_score}
          </span>
        </Link>
      </div>
      <div className="pager-dots" aria-hidden="true">
        {[0, 1].map((i) => (
          <span key={i} className={i === balanceSlide ? "pager-dot--active" : "pager-dot"} />
        ))}
      </div>

      <nav className="quick-grid" aria-label="Shortcuts">
        {SHORTCUTS.map((item) => (
          <Link key={item.label} to={item.to} onClick={() => sfx.tap()} className="quick-btn">
            <span className="quick-circle">
              <AppIcon name={item.icon} size={24} strokeWidth={1.75} />
            </span>
            <span className="quick-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Anything waiting on the kid or on a parent, in one list */}
      {hasUpdates && (
        <>
          <SectionTitle>Updates</SectionTitle>
          <div className="list-panel">
            {unclaimed > 0 && (
              <button type="button" onClick={claim} className="list-row">
                <span className="list-row__icon list-row__icon--pos" aria-hidden="true">
                  <AppIcon name="gift" size={20} />
                </span>
                <span className="list-row__body">
                  <span className="list-row__title">{unclaimed} points to collect</span>
                  <span className="list-row__sub">Tap to add them to your points</span>
                </span>
                <span className="list-row__end text-[var(--pos)]">Collect</span>
              </button>
            )}
            {pendingApprovals.map((a: (typeof pendingApprovals)[number]) => (
              <div key={a.id} className="list-row">
                <span className="list-row__icon" aria-hidden="true">
                  <AppIcon name="timer" size={20} />
                </span>
                <span className="list-row__body">
                  <span className="list-row__title">{cleanApprovalReason(a.reason)}</span>
                  <span className="list-row__sub">
                    {approvalKindLabel(a.kind)} · Waiting for a parent
                  </span>
                </span>
                <span className="list-row__end">
                  <Money amount={Number(a.amount)} />
                </span>
              </div>
            ))}
            {activeLoans.map((l: (typeof activeLoans)[number]) => {
              const remaining = Number(l.amount) - Number(l.repaid);
              const overdue = new Date(l.due_date) < new Date();
              return (
                <Link key={l.id} to="/kid/loans" className="list-row" onClick={() => sfx.tap()}>
                  <span className="list-row__icon" aria-hidden="true">
                    <AppIcon name="loan" size={20} />
                  </span>
                  <span className="list-row__body">
                    <span className="list-row__title">{l.reason || "Qard loan"}</span>
                    <span className="list-row__sub">
                      {overdue && (
                        <Badge variant="error" className="mr-1.5 h-5 px-2">
                          Overdue
                        </Badge>
                      )}
                      Due {formatDate(l.due_date)}
                    </span>
                  </span>
                  <span className="list-row__end">
                    <Money amount={remaining} />
                    <span className="block text-xs font-semibold text-[var(--action-text)]">Repay</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* One promotion */}
      <div className="promo-banner mt-7">
        <div className="max-w-[68%]">
          <h3 className="m-0 text-base font-bold leading-snug text-[var(--ink)]">
            Give sadaqah and earn points. Start with RM1.
          </h3>
          <button
            type="button"
            onClick={() => {
              sfx.pop();
              nav({ to: "/kid/sadaqah" });
            }}
            className="promo-banner__btn"
          >
            Give now
          </button>
        </div>
        <span className="promo-banner__art" aria-hidden="true">
          <AppIcon name="sadaqah" size={30} strokeWidth={1.75} />
        </span>
      </div>

      <SectionTitle
        action={
          <Link to="/kid/insights" onClick={() => sfx.tap()}>
            Insights
          </Link>
        }
      >
        This month
      </SectionTitle>
      <Link to="/kid/insights" className="month-panel" onClick={() => sfx.tap()}>
        <span className="month-panel__label">Spent so far</span>
        <span className="month-panel__amount">
          <Money amount={monthSpent} />
        </span>
        <span className="month-panel__note">
          <span className="insights-recap__avatar" aria-hidden="true">
            <AppIcon name="penny" size={18} />
          </span>
          {monthTxs.length === 0
            ? "No transactions yet this month."
            : `${monthTxs.length} ${monthTxs.length === 1 ? "transaction" : "transactions"} this month. You have ${points} points.`}
        </span>
      </Link>

      <SectionTitle
        action={
          walletTxs.length > 0 ? (
            <Link to="/kid/history" onClick={() => sfx.tap()}>
              See all
            </Link>
          ) : undefined
        }
      >
        Recent activity
      </SectionTitle>
      <Card className="px-2 py-1 divide-y divide-[var(--line)]">
        {walletTxs.slice(0, 5).map((t: (typeof walletTxs)[number]) => {
          const title = transactionTitle(t);
          const typeLabel = transactionTypeLabel(t.type, t.label);
          const subtitle =
            title.trim().toLowerCase() === typeLabel.trim().toLowerCase()
              ? undefined
              : typeLabel;
          return (
            <TransactionRow
              key={t.id}
              title={title}
              subtitle={subtitle}
              date={formatDate(t.created_at)}
              amount={Number(t.amount)}
              type={t.type}
              label={t.label}
              icon={TX_ICON_MAP[t.type] || "transaction"}
            />
          );
        })}
        {walletTxs.length === 0 && (
          <p className="m-0 p-6 text-center text-sm text-[var(--text-3)]">No activity yet.</p>
        )}
      </Card>

      <div className="mt-7">
        <QuoteCard variant="kid" />
      </div>

      {showProfile && (
        <div className="profile-sheet">
          <div className="profile-sheet__header">
            <h2 className="text-lg font-bold text-[var(--ink)]">My Profile</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowProfile(false)}
            >
              Close
            </Button>
          </div>

          <div
            style={{ maxWidth: "500px", margin: "0 auto" }}
            className="p-4 space-y-4"
          >
            {showUpload ? (
              <ImageUploadCrop
                busy={savingProfile}
                onSave={handleSaveAvatar}
                onCancel={() => setShowUpload(false)}
              />
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <AvatarBubble
                    emoji={k.avatar ?? "phosphor:Smiley"}
                    size={96}
                    ring
                  />
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
                  <Input
                    label="Username (Parent only)"
                    value={k.username || ""}
                    disabled
                  />

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
                      <small className="text-xs text-[var(--text-secondary)] font-medium">
                        Linked to Parent
                      </small>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {data.parent.display_name || "Parent"}
                      </div>
                      <small className="text-xs text-[var(--text-muted)]">
                        {data.parent.email}
                      </small>
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
