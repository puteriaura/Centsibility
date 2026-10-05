import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useParentData } from "@/hooks/use-parent-data";
import { useAuth } from "@/providers/auth";
import { usePenny } from "@/features/penny";
import {
  edgeParentCreateKid,
  edgeParentDeleteKid,
  edgeParentMarkNotificationsRead,
  edgeParentGetSelfAvatar,
} from "@/lib/edge";
import { CrewMemberCard } from "@/features/parent/components";
import { ParentLoadError } from "@/features/parent/components/ParentLoadError";
import { toast } from "sonner";
import { QuoteCard } from "@/components/QuoteCard";
import { AvatarBubble } from "@/components/AvatarBubble";
import { resolveAvatar, DEFAULT_PARENT_AVATAR } from "@/lib/avatar";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/ui/section-title";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { AppIcon } from "@/components/ui/app-icon";
import { cleanApprovalReason } from "@/lib/qard";
import { formatRM } from "@/lib/format";
import { parentDisplayName } from "@/lib/display-name";
import { approvalKindLabel, sanitizeDisplayText } from "@/lib/labels";
import { getBalanceSummary } from "@/lib/finance";

import { Money, EyeToggle } from "@/features/privacy";

export const Route = createFileRoute("/parent/")({
  head: () => ({ meta: [{ title: "Parent Dashboard — Centsibility" }] }),
  component: ParentHome,
});

function ParentHome() {
  const { user } = useAuth();
  const {
    kids,
    goals,
    approvals,
    rewards,
    loans,
    txs,
    notifications,
    scheduledHibahs,
    loading,
    error,
    hasLoaded,
    lastLoadedAt,
    refresh,
  } = useParentData();
  const { openPenny } = usePenny();
  const [deletingKidId, setDeletingKidId] = useState<string | null>(null);
  const [parentAvatar, setParentAvatar] = useState(DEFAULT_PARENT_AVATAR);
  const [kidQuery, setKidQuery] = useState("");

  const [showRecruit, setShowRecruit] = useState(false);
  const [newKidName, setNewKidName] = useState("");
  const [newKidUsername, setNewKidUsername] = useState("");
  const [newKidBirthDate, setNewKidBirthDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [setupCode, setSetupCode] = useState<string | null>(null);

  useEffect(() => {
    edgeParentGetSelfAvatar().then((res) => {
      if (res.avatar) setParentAvatar(resolveAvatar(res.avatar, "parent"));
    });
  }, []);

  const filteredKids = useMemo(() => {
    const q = kidQuery.trim().toLowerCase();
    const sorted = [...kids].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        (k.username ?? "").toLowerCase().includes(q) ||
        String((k as { login_code?: string }).login_code ?? "").includes(q),
    );
  }, [kids, kidQuery]);

  const openRecruit = () => {
    setNewKidName("");
    setNewKidUsername("");
    setNewKidBirthDate("");
    setSetupCode(null);
    setShowRecruit(true);
  };

  const closeRecruit = () => {
    setShowRecruit(false);
    setSetupCode(null);
    setNewKidName("");
    setNewKidUsername("");
    setNewKidBirthDate("");
  };

  const createKid = async () => {
    if (!newKidName.trim() || !newKidUsername.trim()) return;
    const nameTaken = kids.some(
      (k) => k.name.trim().toLowerCase() === newKidName.trim().toLowerCase(),
    );
    if (nameTaken) {
      sfx.error();
      toast.error(`A child named "${newKidName.trim()}" already exists.`);
      return;
    }
    setGenerating(true);
    try {
      const res = await edgeParentCreateKid({
        name: newKidName.trim(),
        username: newKidUsername.trim(),
        birth_date: newKidBirthDate.trim() || undefined,
      });
      setSetupCode(res.kid.login_code);
      setNewKidName("");
      setNewKidUsername("");
      setNewKidBirthDate("");
      sfx.success();
      toast.success("Child account created!");
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      sfx.coin();
      toast.success("Login code copied!");
    } catch {
      sfx.error();
      toast.error("Copy failed");
    }
  };

  const handleDeleteKid = async (kidId: string) => {
    try {
      await edgeParentDeleteKid({ kidId });
      toast.success("Child account deleted");
      setDeletingKidId(null);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const unread = notifications.filter((n) => !n.read);
  const markRead = async () => {
    await edgeParentMarkNotificationsRead();
    refresh();
  };

  if (loading && !hasLoaded && !error) {
    return (
      <div className="parent-page space-y-4">
        <Skeleton style={{ height: "6rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "12rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
      </div>
    );
  }

  if (error && !hasLoaded) {
    return (
      <div className="parent-page">
        <ParentLoadError variant="page" onRetry={refresh} message={error} />
      </div>
    );
  }

  const pendingCount = approvals.length + rewards.length;
  const familyTotal = kids.reduce((sum, k) => {
    const kGoals = goals.filter((g) => g.kid_id === k.id);
    const kLoans = loans.filter((l) => l.kid_id === k.id);
    const summary = getBalanceSummary(k, kGoals, kLoans);
    return sum + summary.total;
  }, 0);

  return (
    <div className="parent-page mobile-stack pb-4">
      {error && hasLoaded && (
        <ParentLoadError
          variant="banner"
          onRetry={refresh}
          lastLoadedAt={lastLoadedAt}
        />
      )}
      <section className="deposit-hero" aria-label="Family total balance">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Family total balance</p>
          <div className="deposit-hero__amount tabular-nums flex items-center gap-2">
            <Money amount={familyTotal} />
            <EyeToggle variant="dark" />
          </div>
          <Link
            to="/parent/insights"
            className="deposit-hero__link"
            onClick={() => sfx.tap()}
          >
            View Insights →
          </Link>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AvatarBubble emoji={parentAvatar} size={56} kind="parent" />
        </div>
      </section>

      <div
        className="deposit-quick-row"
        role="navigation"
        aria-label="Parent shortcuts"
      >
        <Link
          to="/parent/approvals"
          className="deposit-quick-tile"
          onClick={() => sfx.tap()}
        >
          <AppIcon name="approve" size={22} />
          <span>Approvals{pendingCount > 0 ? ` (${pendingCount})` : ""}</span>
        </Link>
        <Link
          to="/parent/transfer"
          className="deposit-quick-tile"
          onClick={() => sfx.tap()}
        >
          <AppIcon name="transfer" size={22} />
          <span>Transfer</span>
        </Link>
        <button
          type="button"
          className="deposit-quick-tile bg-transparent border-none cursor-pointer"
          onClick={() => {
            sfx.tap();
            openPenny({ context: { page: "Home" } });
          }}
        >
          <AppIcon name="penny" size={22} />
          <span>Ask Penny</span>
        </button>
        <Link
          to="/parent/insights"
          className="deposit-quick-tile"
          onClick={() => sfx.tap()}
        >
          <AppIcon name="reports" size={22} />
          <span>Insights</span>
        </Link>
        <button
          type="button"
          className="deposit-quick-tile"
          onClick={openRecruit}
        >
          <AppIcon name="userplus" size={22} />
          <span>Add Child</span>
        </button>
      </div>

      {!(user?.user_metadata as { comfort_name?: string } | undefined)
        ?.comfort_name && (
        <div className="flex items-center justify-between gap-3 p-3 bg-[var(--surface-pink)] border border-[var(--primary-soft)] rounded-2xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 text-[var(--primary)] shadow-xs">
              <AppIcon name="penny" size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--ink)] m-0">
                Set your Comfort Name
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] m-0 truncate">
                Tell Penny and your kids what to call you (e.g. Mama, Papa)
              </p>
            </div>
          </div>
          <Link
            to="/parent/settings"
            className="text-xs font-bold text-[var(--primary)] bg-white px-3 py-1.5 rounded-full border border-[var(--primary-soft)] hover:bg-[var(--primary-soft)] shrink-0 transition-colors"
          >
            Set Name
          </Link>
        </div>
      )}

      <div className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-[var(--border)]">
        <AvatarBubble emoji={parentAvatar} size={44} ring kind="parent" />
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
            Family Guardian
          </span>
          <h1 className="text-base font-extrabold text-[var(--ink)] leading-tight truncate m-0">
            {parentDisplayName(user)}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
            {kids.length} {kids.length === 1 ? "child" : "children"}
            {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
          </p>
        </div>
      </div>

      {unread.length > 0 && (
        <Card
          variant="soft"
          className="p-4 border border-[var(--primary-soft)] space-y-2 m-0"
        >
          <div className="flex items-center justify-between">
            <strong className="text-xs sm:text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              <AppIcon name="bell" size={16} color="var(--primary)" />
              {unread.length} New {unread.length === 1 ? "Alert" : "Alerts"}
            </strong>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                sfx.tap();
                markRead();
              }}
              className="text-xs"
            >
              Mark Read
            </Button>
          </div>
          <ul className="space-y-1 text-xs text-[var(--text-secondary)] m-0 pl-0 list-none">
            {unread.slice(0, 4).map((n) => (
              <li key={n.id} className="truncate">
                <Link
                  to={n.link ?? "/parent/approvals"}
                  className="hover:underline"
                >
                  {sanitizeDisplayText(n.message)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Children Accounts</SectionTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openRecruit}
            className="text-xs text-[var(--primary-text)] shrink-0"
          >
            <AppIcon name="plus" size={14} /> Add
          </Button>
        </div>

        {hasLoaded && !error && kids.length === 0 ? (
          <Card variant="soft" className="p-8 text-center space-y-3 m-0">
            <div className="w-14 h-14 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary-text)] flex items-center justify-center mx-auto">
              <AppIcon name="userplus" size={28} />
            </div>
            <h3 className="text-base font-bold text-[var(--ink)]">
              No Children Enrolled Yet
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
              Create an account for your child to help them learn saving,
              budgeting, and Islamic finance.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={openRecruit}
              className="mx-auto"
            >
              <AppIcon name="plus" size={16} /> Add First Child
            </Button>
          </Card>
        ) : (
          <>
            <div className="kid-search">
              <AppIcon name="users" size={16} />
              <input
                type="search"
                value={kidQuery}
                onChange={(e) => setKidQuery(e.target.value)}
                placeholder={`Search ${kids.length} children…`}
                aria-label="Search children"
              />
            </div>
            {filteredKids.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-6 m-0">
                No match for “{kidQuery}”.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredKids.map((c) => (
                  <CrewMemberCard
                    key={c.id}
                    kid={c}
                    kidGoals={goals.filter((g) => g.kid_id === c.id)}
                    kidLoans={loans.filter((l) => l.kid_id === c.id)}
                    kidTxs={txs.filter((t) => t.kid_id === c.id)}
                    scheduledHibahs={
                      scheduledHibahs?.filter((h) => h.kid_id === c.id) || []
                    }
                    onDeleteInitiate={setDeletingKidId}
                    onRefresh={refresh}
                    defaultOpen={kids.length === 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Pending Requests ({pendingCount})</SectionTitle>
          <Link
            to="/parent/approvals"
            className="text-xs font-semibold text-[var(--primary-text)] hover:underline"
          >
            View all →
          </Link>
        </div>

        {pendingCount === 0 ? (
          <Card
            variant="soft"
            className="p-4 text-center text-xs sm:text-sm text-[var(--text-muted)] flex items-center justify-center gap-2 m-0"
          >
            <AppIcon name="approve" size={16} color="var(--success)" />
            All requests reviewed and clear!
          </Card>
        ) : (
          <div className="space-y-2">
            {approvals.slice(0, 2).map((a) => (
              <Card
                key={a.id}
                variant="default"
                className="p-3.5 border border-[var(--border)] flex items-center justify-between gap-3 m-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.kind === "QARD" ? "warning" : "brand"}>
                      {a.kind === "QARD" ? "Loan" : approvalKindLabel(a.kind)}
                    </Badge>
                    <strong className="text-sm font-bold text-[var(--ink)]">
                      {a.kids?.name}
                    </strong>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
                    {cleanApprovalReason(a.reason)}
                  </p>
                </div>
                <span className="text-base font-extrabold text-[var(--ink)] tabular-nums shrink-0">
                  {formatRM(Number(a.amount))}
                </span>
              </Card>
            ))}

            {rewards.slice(0, 2).map((r) => (
              <Card
                key={r.id}
                variant="default"
                className="p-3.5 border border-[var(--border)] flex items-center justify-between gap-3 m-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="soft">Reward</Badge>
                    <strong className="text-sm font-bold text-[var(--ink)]">
                      {r.kids?.name}
                    </strong>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
                    {r.name}
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--primary-text)] flex items-center gap-1 shrink-0">
                  {r.cost} <AppIcon name="star" size={12} />
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <SectionTitle>Daily Reflection</SectionTitle>
        <QuoteCard variant="parent" />
      </div>

      <Modal
        isOpen={Boolean(deletingKidId)}
        onClose={() => setDeletingKidId(null)}
        title="Remove Child Account?"
        description="This action cannot be undone. All savings history, goals, and records will be deleted."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setDeletingKidId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deletingKidId) handleDeleteKid(deletingKidId);
              }}
            >
              Delete Account
            </Button>
          </div>
        }
      >
        <p className="py-2 text-xs text-[var(--text-secondary)]">
          Are you sure you want to permanently delete this profile?
        </p>
      </Modal>

      <Modal
        isOpen={showRecruit}
        onClose={closeRecruit}
        title={setupCode ? "Child Login Setup" : "Add Child Account"}
        description={
          setupCode
            ? "Your child can log in immediately using this unique 6-digit code."
            : "Create an account for your child with a unique name and username."
        }
      >
        {setupCode ? (
          <div className="space-y-4 py-2 text-center">
            <div className="p-5 rounded-2xl bg-[var(--surface-pink)] border border-[var(--primary-soft)] inline-block mx-auto">
              <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest block font-semibold mb-1">
                6-Digit Login Code
              </span>
              <div className="text-4xl font-extrabold text-[var(--primary-text)] tracking-widest tabular-nums">
                {setupCode}
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
              Save or share this code. Your child can use it on the kid login
              screen anytime.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => copyCode(setupCode)}
              >
                <AppIcon name="copy" size={16} /> Copy Code
              </Button>
              <Button type="button" variant="secondary" onClick={closeRecruit}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Input
              label="Child's Full Name"
              id="recruit-name"
              autoFocus
              value={newKidName}
              onChange={(e) => setNewKidName(e.target.value)}
              placeholder="E.g. Aiman"
              maxLength={40}
              error={
                kids.some(
                  (k) =>
                    k.name.trim().toLowerCase() ===
                    newKidName.trim().toLowerCase(),
                ) && newKidName.trim()
                  ? "A child with this name already exists"
                  : undefined
              }
            />

            <Input
              label="Username (@handle)"
              id="recruit-username"
              value={newKidUsername}
              onChange={(e) =>
                setNewKidUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                )
              }
              placeholder="e.g. aiman123"
              maxLength={20}
              helperText="Lowercase letters, numbers, and underscores only."
            />

            <Input
              label="Birth Date (Optional)"
              id="recruit-birthdate"
              type="date"
              value={newKidBirthDate}
              onChange={(e) => setNewKidBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              helperText="Used to recommend age-appropriate missions and quests."
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="secondary" onClick={closeRecruit}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={createKid}
                loading={generating}
                disabled={
                  generating ||
                  !newKidName.trim() ||
                  !newKidUsername.trim() ||
                  kids.some(
                    (k) =>
                      k.name.trim().toLowerCase() ===
                      newKidName.trim().toLowerCase(),
                  )
                }
              >
                Create Account
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
