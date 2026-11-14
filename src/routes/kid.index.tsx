import { malaysiaDay } from "../../supabase/functions/_shared/final-check-input";
import { DailyWelcome } from "@/components/DailyWelcome";
import { Modal } from "@/components/ui/modal";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMoney, Money } from "@/features/privacy";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { BalanceCard, TransactionRow } from "@/components/banking";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidUpdateProfile, edgeKidUploadAvatar } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { FeatureIcon } from "@/components/FeatureIcon";
import { PennyMascot } from "@/components/PennyMascot";
import { SproutIllustration, getSproutStage } from "@/components/SproutIllustration";
import { useTheme } from "@/lib/theme";
import { getKidCopy } from "@/lib/i18n";
import { SpeakButton } from "@/components/ui/SpeakButton";
import { Term } from "@/components/ui/Term";
import { ImageUploadCrop } from "@/components/ImageUploadCrop";
import { toast } from "sonner";
import { AvatarBubble } from "@/components/AvatarBubble";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { cleanApprovalReason } from "@/lib/qard";
import { KidLoadError } from "@/features/kid/components";
import { AppIcon } from "@/components/ui/app-icon";
import { topUnfinishedGoal, weeklyIncoming } from "@/lib/home-summary";
import { formatDate } from "@/lib/format";
import { getBalanceSummary, isWalletTransaction } from "@/lib/finance";
import {
  transactionTitle,
  transactionTypeLabel,
  approvalKindLabel,
} from "@/lib/labels";

// Home order follows the AEON pattern: balance first, then shortcuts, then
// anything waiting on the kid, one promotion, the month, recent activity.
// Dock items (Wallet, Loans, Card) and Penny (header) are not repeated here.

export const Route = createFileRoute("/kid/")({
  validateSearch: (search: Record<string, unknown>): { profile?: boolean } => ({ profile: search.profile === true || search.profile === "true" ? true : undefined }),
  head: () => ({ meta: [{ title: "Kid Home | Centsibility" }] }),
  component: KidHome,
});

function KidHome() {
  const nav = useNavigate();
  const { profile } = Route.useSearch();
  const { lang } = useTheme();
  const { data, loading, error, refresh, pennyMood } = useKidData();

  const [showProfile, setShowProfile] = useState(false);
  const [pBio, setPBio] = useState("");
  const [pBirthDate, setPBirthDate] = useState("");
  const [pBirthYear, setPBirthYear] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const { isMasked, locked, toggleHidden, openUnlockSheet, format } =
    useMoney();
  const openProfile = useCallback(() => {
    if (!data?.kid) return;
    setPBio(data.kid.bio || "");
    setPBirthDate(data.kid.birth_date || "");
    setPBirthYear(data.kid.birth_year ? String(data.kid.birth_year) : "");
    setShowProfile(true);
  }, [data?.kid]);


  useEffect(() => {
    if (profile && data?.kid) {
      openProfile();
      void nav({ to: "/kid", search: { profile: undefined }, replace: true });
    }
  }, [profile, data?.kid, openProfile, nav]);

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

  const ageGroup = data.ageGroup ?? "10-12";
  const copy = getKidCopy(lang, ageGroup);
  const shortcuts = [
    { to: "/kid/transfer", label: copy.send, key: "send" },
    { to: "/kid/goals", label: copy.goals, key: "tabung" },
    { to: "/kid/wallet", label: copy.askForMoney, key: "request" },
    { to: "/kid/more", label: copy.more, key: "more" },
  ];

  const activeLoans = data.loans.filter(
    (l: (typeof data.loans)[number]) => l.status === "active",
  );
  const incoming = weeklyIncoming(data.txs);
  const topGoal = topUnfinishedGoal(data.goals);
  const goalPercent = topGoal ? Math.round(Number(topGoal.saved) / Number(topGoal.target) * 100) : 0;
  const hasUpdates = pendingApprovals.length > 0 || activeLoans.length > 0;
  const summary = getBalanceSummary(
    k,
    data.goals,
    data.loans,
    (data as { investmentsValue?: number }).investmentsValue,
  );

  return (
    <>
      <h1 className="sr-only">{copy.home}</h1>
      <div className="page-split">
      <div className="page-split__summary">
      <DailyWelcome kidId={k.id} streak={Number(k.streak) || 0} incoming={incoming} />
      <div className="mb-2 flex items-center justify-between gap-2">
        <Badge variant="default">Ages {ageGroup}</Badge>
        <div className="flex items-center gap-2">
          <PennyMascot state={pennyMood} size={44} />
          <SpeakButton text={`${copy.myBalance} RM${(summary.total ?? 0).toFixed(2)}. ${copy.spendLabel} RM${summary.spending.toFixed(2)}.`} />
        </div>
      </div>
      <BalanceCard
        className={`home-balance ${ageGroup === "6-9" ? "home-balance--young" : ""}`}
        title={copy.myBalance}
        balance={summary.total}
        confirmed={!loading && !error}
        subtitle={
          ageGroup === "13-17" ? (
            <>
              {copy.spendLabel} <Money amount={summary.spending} /> · {copy.tabungLabel} <Money amount={summary.tabung} />
            </>
          ) : (
            <><Money amount={summary.spending} /> to spend</>
          )
        }
        tag={
          ageGroup === "6-9"
            ? undefined
            : incoming > 0
              ? <><Money amount={incoming} sign /> this week</>
              : undefined
        }
        hideBalance={isMasked}
        onToggleHide={() => {
          if (locked) openUnlockSheet();
          else toggleHidden();
        }}
      />

      {ageGroup === "6-9" ? (
        <div className="space-y-2 mt-3">
          <nav className="grid grid-cols-2 gap-2.5" aria-label="Shortcuts">
            {shortcuts.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                onClick={() => sfx.tap()}
                className="flex min-h-[72px] items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 font-display text-base font-bold text-[var(--ink)] shadow-sm"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-[var(--text-2)]">{copy.tapSpeakerHint}</p>
        </div>
      ) : (
        <nav className="quick-grid" aria-label="Shortcuts">
          {shortcuts.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              onClick={() => sfx.tap()}
              className="quick-btn"
            >
              <span className="quick-circle">
                <FeatureIcon
                  feature={
                    item.key as React.ComponentProps<
                      typeof FeatureIcon
                    >["feature"]
                  }
                />
              </span>
              <span className="quick-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {ageGroup === "13-17" && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-xs">
          <span className="font-semibold text-[var(--text-2)]">
            {copy.insights}: {copy.spendLabel} <Money amount={summary.spending} /> · {copy.tabungLabel} <Money amount={summary.tabung} />
          </span>
          <Link to="/kid/insights" className="font-bold text-[var(--action-text)] underline">
            View
          </Link>
        </div>
      )}

      <div className="home-tiles">
        <Card className="home-tile">
          <small>Streak</small>
          <strong>{k.streak} {k.streak === 1 ? "day" : "days"}</strong>
          <span className="home-streak-badge"><AppIcon name="flame" size={28} /></span>
        </Card>
        <Link to="/kid/goals" className="home-tile home-goal" onClick={() => sfx.tap()}>
          {topGoal ? <>
            <small>{topGoal.name} · {getSproutStage(goalPercent).label}</small>
            <strong><Money amount={Number(topGoal.saved)} /> / <Money amount={Number(topGoal.target)} /></strong>
            <div className="mt-1 flex items-center justify-center">
              <SproutIllustration pct={goalPercent} size={56} />
            </div>
          </> : <><small><Term termKey="tabung" /></small><strong>{copy.saveForGoal}</strong><SproutIllustration pct={0} size={52} /></>}
        </Link>
      </div>

      </div>
      <div className="page-split__details">
      {/* Anything waiting on the kid or on a parent, in one list */}
      {hasUpdates && (
        <details className="home-alert">
          <summary>
            <AppIcon name="bell" size={20} />
            <span>
              {pendingApprovals.length > 0
                ? `${pendingApprovals.length} request${pendingApprovals.length === 1 ? "" : "s"} awaiting approval`
                : `${activeLoans.length} repayment schedule${activeLoans.length === 1 ? "" : "s"} to review`}
            </span>
            <AppIcon name="chevron" size={18} />
          </summary>
          <div className="list-panel">
            {pendingApprovals.map((a: (typeof pendingApprovals)[number]) => (
              <div key={a.id} className="list-row">
                <span className="list-row__icon" aria-hidden="true">
                  <AppIcon name="timer" size={20} />
                </span>
                <span className="list-row__body">
                  <span className="list-row__title">
                    {cleanApprovalReason(a.reason)}
                  </span>
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
              const overdue = l.due_date < malaysiaDay();
              return (
                <Link
                  key={l.id}
                  to="/kid/loans"
                  className="list-row"
                  aria-label={`${l.reason || "Qard loan"}, due ${formatDate(l.due_date)}, repay`}
                  onClick={() => sfx.tap()}
                >
                  <span className="list-row__icon" aria-hidden="true">
                    <AppIcon name="loan" size={20} />
                  </span>
                  <span className="list-row__body">
                    <span className="list-row__title">
                      {l.reason || "Qard loan"}
                    </span>
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
                    <span className="block text-xs font-semibold text-[var(--action-text)]">
                      Repay
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </details>
      )}

      <SectionTitle
        action={
          walletTxs.length > 0 ? (
            <Link to="/kid/history" onClick={() => sfx.tap()}>
              See all
            </Link>
          ) : undefined
        }
      >
        Recent
      </SectionTitle>
      <Card className="px-2 py-1 divide-y divide-[var(--line)]">
        {walletTxs.slice(0, 3).map((t: (typeof walletTxs)[number]) => {
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
            />
          );
        })}
        {walletTxs.length === 0 && (
          <div className="home-empty">
            <PennyMascot size={64} state="guide" />
            <p>Your first coins land here!</p>
            <Link to="/kid/wallet" className="home-secondary-link">Ask for pocket money</Link>
          </div>
        )}
      </Card>

      </div>
      </div>
      {showProfile && (
        <Modal
          isOpen={showProfile}
          onClose={() => {
            setShowProfile(false);
            setShowUpload(false);
          }}
          title="My profile"
          variant="sheet"
        >
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
                    <label
                      htmlFor="kid-profile-bio"
                      className="block text-xs font-semibold text-[var(--ink)] mb-1"
                    >
                      Short Bio
                    </label>
                    <textarea
                      id="kid-profile-bio"
                      value={pBio}
                      onChange={(e) => setPBio(e.target.value)}
                      maxLength={150}
                      rows={3}
                      placeholder="I love to learn and save money!"
                      className="w-full px-3.5 py-2.5 text-sm text-[var(--ink)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 outline-none resize-none"
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
                        Linked to parent
                      </small>
                      <div className="text-sm font-bold text-[var(--ink)]">
                        {data.parent.display_name || "Parent"}
                      </div>
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
                    {savingProfile ? "Saving..." : "Save profile"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
