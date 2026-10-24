import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth";
import { QuoteCard } from "@/components/QuoteCard";
import { useParentData } from "@/hooks/use-parent-data";
import { edgeParentCreateKid, edgeParentDeleteKid } from "@/lib/edge";
import { CrewMemberCard } from "@/features/parent/components";
import { ParentLoadError } from "@/features/parent/components/ParentLoadError";
import { toast } from "sonner";
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
import { approvalKindLabel } from "@/lib/labels";
import { getBalanceSummary } from "@/lib/finance";

import { BalanceCard } from "@/components/banking";
import { Money, useMoney } from "@/features/privacy";

export const Route = createFileRoute("/parent/")({
  head: () => ({ meta: [{ title: "Parent Dashboard | Centsibility" }] }),
  component: ParentHome,
});

function ParentHome() {
  const { user } = useAuth();
  const needsComfortName = !(user?.user_metadata as { comfort_name?: string } | undefined)?.comfort_name;
  const { isMasked, locked, toggleHidden, openUnlockSheet } = useMoney();
  const {
    kids,
    goals,
    approvals,
    rewards,
    loans,
    txs,
    scheduledHibahs,
    investmentsByKid,
    loading,
    error,
    hasLoaded,
    lastLoadedAt,
    refresh,
  } = useParentData();
  const [deletingKidId, setDeletingKidId] = useState<string | null>(null);
  const [kidQuery, setKidQuery] = useState("");

  const [showRecruit, setShowRecruit] = useState(false);
  const [newKidName, setNewKidName] = useState("");
  const [newKidUsername, setNewKidUsername] = useState("");
  const [newKidBirthDate, setNewKidBirthDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [setupCode, setSetupCode] = useState<string | null>(null);

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
        username: newKidUsername.trim().toLowerCase(),
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
    const kInv = investmentsByKid?.[k.id]
      ?.filter((i) => i.status === "active")
      .reduce((s, i) => s === null || i.currentValue === null ? null : s + Number(i.currentValue), 0 as number | null);
    const summary = getBalanceSummary(k, kGoals, kLoans, kInv);
    return sum === null || summary.total === null ? null : sum + summary.total;
  }, 0 as number | null);

  return (
    <div className="parent-page mobile-stack pb-4">
      {error && hasLoaded && (
        <ParentLoadError
          variant="banner"
          onRetry={refresh}
          lastLoadedAt={lastLoadedAt}
        />
      )}
      <BalanceCard className="home-balance" title="Family total" balance={familyTotal}
        subtitle={`${kids.length} ${kids.length === 1 ? "child" : "children"}`}
        hideBalance={isMasked} onToggleHide={() => locked ? openUnlockSheet() : toggleHidden()}
        tag={pendingCount > 0 ? `${pendingCount} to approve` : undefined} />
      <nav className="quick-grid" aria-label="Shortcuts">
        {[{ to: "/parent/transfer", label: "Send", icon: "send" }, { to: "/parent/approvals", label: "Approve", icon: "approve" }, { to: "/parent/reports", label: "Reports", icon: "reports" }].map(item =>
          <Link key={item.label} to={item.to} className="quick-btn" onClick={() => sfx.tap()}><span className="quick-circle"><AppIcon name={item.icon} size={28} /></span><span className="quick-label">{item.label}</span></Link>)}
        <button type="button" className="quick-btn" onClick={openRecruit}><span className="quick-circle"><AppIcon name="userplus" size={28} /></span><span className="quick-label">Add child</span></button>
      </nav>
      {/* Anything waiting on the parent, first */}
      {(pendingCount > 0 || needsComfortName) && (
        <div>
          <SectionTitle
            className="mt-2"
            action={
              pendingCount > 0 ? (
                <Link to="/parent/approvals" onClick={() => sfx.tap()}>
                  See all
                </Link>
              ) : undefined
            }
          >
            Needs you
          </SectionTitle>
          <div className="list-panel">
            {approvals.slice(0, 3).map((a) => (
              <Link key={a.id} to="/parent/approvals" className="list-row" onClick={() => sfx.tap()}>
                <span className="list-row__icon" aria-hidden="true">
                  <AppIcon name={a.kind === "QARD" ? "loan" : a.kind === "TRANSFER" ? "transfer" : "wallet"} size={20} />
                </span>
                <span className="list-row__body">
                  <span className="list-row__title">
                    {a.kids?.name} · {a.kind === "QARD" ? "Loan" : approvalKindLabel(a.kind)}
                  </span>
                  <span className="list-row__sub truncate">{cleanApprovalReason(a.reason)}</span>
                </span>
                <span className="list-row__end">
                  <Money amount={Number(a.amount)} />
                </span>
              </Link>
            ))}
            {rewards.slice(0, Math.max(0, 3 - approvals.length)).map((r) => (
              <Link
                key={r.id}
                to="/parent/approvals"
                search={{ tab: "rewards" }}
                className="list-row"
                onClick={() => sfx.tap()}
              >
                <span className="list-row__icon" aria-hidden="true">
                  <AppIcon name="gift" size={20} />
                </span>
                <span className="list-row__body">
                  <span className="list-row__title">{r.kids?.name} · Reward</span>
                  <span className="list-row__sub truncate">{r.name}</span>
                </span>
                <span className="list-row__end">{r.cost} pts</span>
              </Link>
            ))}
            {needsComfortName && (
              <Link to="/parent/settings" className="list-row" onClick={() => sfx.tap()}>
                <span className="list-row__icon" aria-hidden="true"><AppIcon name="penny" size={20} /></span>
                <span className="list-row__body">
                  <span className="list-row__title">Choose what your children call you</span>
                  <span className="list-row__sub">Mama, Papa, Ummi or your own</span>
                </span>
                <AppIcon name="chevron" size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <SectionTitle
          className="mb-0"
          action={
            <Button type="button" variant="ghost" size="sm" onClick={openRecruit} className="-mr-3">
              <AppIcon name="plus" size={16} /> Add child
            </Button>
          }
        >
          Children
        </SectionTitle>

        {hasLoaded && !error && kids.length === 0 ? (
          <Card variant="soft" className="p-8 text-center space-y-3 m-0">
            <div className="w-14 h-14 rounded-full bg-[var(--surface)] text-[var(--action)] flex items-center justify-center mx-auto">
              <AppIcon name="userplus" size={26} />
            </div>
            <h3 className="m-0 text-base font-bold text-[var(--ink)]">
              No children added yet
            </h3>
            <p className="m-0 text-sm text-[var(--text-2)] max-w-sm mx-auto">
              Create an account for your child to help them learn saving,
              budgeting, and Islamic finance.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={openRecruit}
              className="mx-auto"
            >
              <AppIcon name="plus" size={16} /> Add your first child
            </Button>
          </Card>
        ) : (
          <>
            {/* Search only earns its place once the list gets long */}
            {kids.length > 3 && (
              <div className="kid-search">
                <AppIcon name="search" size={18} />
                <input
                  type="search"
                  value={kidQuery}
                  onChange={(e) => setKidQuery(e.target.value)}
                  placeholder={`Search ${kids.length} children`}
                  aria-label="Search children"
                />
              </div>
            )}
            {filteredKids.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] text-center py-6 m-0">
                No match for “{kidQuery}”.
              </p>
            ) : (
              <div className="home-children">
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
                    investmentsValue={
                      investmentsByKid?.[c.id]
                        ?.filter((i) => i.status === "active")
                        .reduce((sum, i) => sum === null || i.currentValue === null ? null : sum + Number(i.currentValue), 0 as number | null)
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

      <QuoteCard variant="parent" />

      <Modal
        isOpen={Boolean(deletingKidId)}
        onClose={() => setDeletingKidId(null)}
        title="Delete this child account?"
        description="This cannot be undone. Their savings history, Tabung and records will be deleted."
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
              Delete account
            </Button>
          </div>
        }
      >
        <p className="m-0 text-sm text-[var(--text-2)]">
          The child will no longer be able to sign in.
        </p>
      </Modal>

      <Modal
        isOpen={showRecruit}
        onClose={closeRecruit}
        title={setupCode ? "Login code ready" : "Add a child"}
        description={
          setupCode
            ? "Your child can log in immediately using this unique 6-digit code."
            : "Create an account for your child with a unique name and username."
        }
      >
        {setupCode ? (
          <div className="space-y-4 py-2 text-center">
            <div className="p-5 rounded-2xl bg-[var(--action-tint)] inline-block mx-auto">
              <span className="section-title__heading block mb-1">
                6-digit login code
              </span>
              <div className="font-display text-4xl font-bold text-[var(--action-text)] tracking-widest tabular-nums">
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
                <AppIcon name="copy" size={16} /> Copy code
              </Button>
              <Button type="button" variant="secondary" onClick={closeRecruit}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Input
              label="Child's full name"
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={newKidUsername}
              onChange={(e) =>
                setNewKidUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""),
                )
              }
              placeholder="e.g. aiman123"
              maxLength={24}
              helperText="3-24 lowercase letters, numbers, dots, underscores or hyphens."
            />

            <Input
              label="Birth date (optional)"
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
                Create account
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
