import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import {
  edgeKidContributeGoal,
  edgeKidCreateGoal,
  edgeKidUpdateGoal,
  edgeKidDeleteGoal,
} from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRM } from "@/lib/format";
import { getBalanceSummary } from "@/lib/finance";
import { Money } from "@/features/privacy";

import { useMoneyAction } from "@/hooks/use-money-action";

export const Route = createFileRoute("/kid/goals")({
  head: () => ({ meta: [{ title: "Tabung | Centsibility" }] }),
  component: KidGoals,
});

const ICON_KEYS = [
  "Target",
  "Trophy",
  "GameController",
  "Sparkles",
  "Star",
  "Gift",
  "House",
  "BookOpen",
  "MusicNote",
  "Bicycle",
  "Globe",
  "Heart",
];

const SOFT_TINTS = [
  "var(--primary-soft)",
  "var(--secondary-soft)",
  "var(--accent-amber-soft)",
  "var(--accent-coral-soft)",
];

const RISK_LABELS: Record<string, string> = {
  very_low: "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
};

function iconName(key: string) {
  return key.replace(/[\s_-]+/g, "").toLowerCase();
}

function KidGoals() {
  const { data, loading, error, refresh } = useKidData();
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showHeroInfo, setShowHeroInfo] = useState(false);

  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newEmoji, setNewEmoji] = useState("Target");

  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editEmoji, setEditEmoji] = useState("Target");

  const { busy, run } = useMoneyAction();

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const summary = getBalanceSummary(data.kid, data.goals, data.loans);
  const balance = summary.spending;
  const totalInTabung = summary.tabung;
  const code = getKidSession()?.code;

  const save = async (goalId: string, goalName: string, amount: number) => {
    if (!code) return;
    await run(() => edgeKidContributeGoal({ code, goalId, amount }), {
      success: (res) => `${formatRM(res.added)} saved to ${goalName}`, // privacy-ok: toast
      failure: "Could not save to Tabung",
      onSuccess: () => {
        setActiveGoal(null);
      },
      refresh,
    });
  };

  const addGoal = async () => {
    const target = parseFloat(newTarget);
    if (!newName.trim() || isNaN(target) || target <= 0) {
      toast.error("Enter a valid name and target amount");
      return;
    }
    if (!code) return;
    const name = newName.trim();
    await run(
      () =>
        edgeKidCreateGoal({
          code,
          name,
          emoji: newEmoji,
          target,
        }),
      {
        success: `${name} Tabung created`,
        failure: "Failed to create Tabung",
        onSuccess: () => {
          setNewName("");
          setNewTarget("");
          setNewEmoji("Target");
          setShowAdd(false);
        },
        refresh,
      },
    );
  };

  const saveEdit = async (goalId: string) => {
    const target = parseFloat(editTarget);
    if (!editName.trim() || isNaN(target) || target <= 0) {
      toast.error("Enter a valid name and target amount");
      return;
    }
    if (!code) return;
    const name = editName.trim();
    await run(
      () =>
        edgeKidUpdateGoal({
          code,
          goalId,
          name,
          emoji: editEmoji,
          target,
        }),
      {
        success: (res) => {
          const refunded = res.refunded || 0;
          return refunded > 0
            ? `${name} updated. ${formatRM(refunded)} back in your wallet` // privacy-ok: toast
            : `${name} updated`;
        },
        failure: "Failed to update Tabung",
        onSuccess: () => {
          setEditingId(null);
        },
        refresh,
      },
    );
  };

  const deleteGoal = async (goalId: string, goalName: string) => {
    if (!code) return;
    await run(() => edgeKidDeleteGoal({ code, goalId }), {
      success: (res) => {
        const refunded = res.refunded || 0;
        return refunded > 0
          ? `${goalName} removed. ${formatRM(refunded)} back in your wallet` // privacy-ok: toast
          : `${goalName} removed`;
      },
      failure: "Failed to delete Tabung",
      onSuccess: () => {
        setDeletingId(null);
      },
      refresh,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Hero: Total in Tabung */}
      <section className="deposit-hero" aria-label="Tabung summary">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Total in Tabung</p>
          <p className="deposit-hero__amount tabular-nums">
            <Money amount={totalInTabung} />
          </p>
          <button
            type="button"
            className="deposit-hero__link"
            onClick={() => setShowHeroInfo(!showHeroInfo)}
            aria-expanded={showHeroInfo}
            aria-controls="tabung-hero-info"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              color: "inherit",
              font: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              minHeight: "44px",
            }}
          >
            <span>{data.goals.length} Tabung</span>
            <AppIcon name="info" size={14} color="#fff" />
          </button>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="save" size={32} color="#fff" />
        </div>
      </section>

      {showHeroInfo && (
        <div
          id="tabung-hero-info"
          className="p-3.5 rounded-xl text-xs leading-relaxed text-[var(--ink)] bg-[var(--surface-soft)] border border-[var(--border)]"
        >
          Money you've put aside in savings goals. Your spending balance is
          separate.
        </div>
      )}

      {/* 2. Section Label: Active Tabung */}
      <div className="section-tag">
        <span>ACTIVE TABUNG</span>
      </div>

      {/* Tabung List */}
      <div className="space-y-3">
        {/* Investment link note */}
        <Link
          to="/kid/invest"
          onClick={() => sfx.tap()}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--primary-text)] text-xs font-medium no-underline hover:border-[var(--primary)] transition-all"
        >
          <AppIcon name="invest" size={16} />
          <span>Investments are on the Investment page</span>
          <AppIcon
            name="chevron"
            size={14}
            className="ml-auto text-[var(--text-muted)]"
          />
        </Link>

        {/* Empty state if 0 goals */}
        {data.goals.length === 0 && (
          <Card variant="soft" className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-text)] flex items-center justify-center mx-auto">
              <AppIcon name="save" size={32} />
            </div>
            <h3 className="text-base font-bold text-[var(--ink)] m-0">
              No Tabung yet
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
              Start putting money aside for games, books, or family gifts to
              reach your milestones.
            </p>
            {!showAdd && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  sfx.pop();
                  setShowAdd(true);
                }}
                className="mx-auto min-h-[44px]"
              >
                <AppIcon name="plus" size={16} />
                Create your first Tabung
              </Button>
            )}
          </Card>
        )}

        {/* 3. One card per Tabung */}
        {data.goals.map((g: (typeof data.goals)[number], index: number) => {
          const pct = Math.min(
            100,
            Math.round((Number(g.saved) / Number(g.target)) * 100),
          );
          const remaining = Math.max(0, Number(g.target) - Number(g.saved));
          const complete = pct >= 100;
          const isEditing = editingId === g.id;
          const isExpanded = activeGoal === g.id;

          return (
            <Card
              key={g.id}
              variant="default"
              className={`p-4 rounded-2xl border transition-all ${
                complete
                  ? "border-[var(--success-soft)] bg-[var(--surface-soft)]"
                  : "border-[var(--border)]"
              }`}
            >
              <button
                type="button"
                className="w-full text-left bg-transparent border-0 p-0 cursor-pointer flex items-center gap-3"
                onClick={() => {
                  sfx.tap();
                  setActiveGoal(isExpanded ? null : g.id);
                  if (isEditing) setEditingId(null);
                }}
                aria-expanded={isExpanded}
                aria-controls={`tabung-actions-${g.id}`}
              >
                {/* Left: 64px rounded square with soft tint */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: SOFT_TINTS[index % SOFT_TINTS.length] }}
                >
                  <AppIcon name={iconName(g.emoji || "Target")} size={28} />
                </div>

                {/* Right: name, RM saved/target, 6px progress bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-[var(--ink)] leading-snug truncate m-0">
                      {g.name}
                    </h3>
                    {complete && <Badge variant="success">Full</Badge>}
                  </div>

                  <div className="mt-1">
                    <span className="text-sm font-bold text-[var(--ink)] tabular-nums">
                      <Money amount={Number(g.saved)} />
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-normal">
                      {" "}
                      / <Money amount={Number(g.target)} />
                    </span>
                  </div>

                  <div className="mt-2">
                    <Progress
                      value={Number(g.saved)}
                      max={Number(g.target)}
                      height={6}
                    />
                  </div>
                </div>
              </button>

              {/* 5. Tapping opens actions under it */}
              {isExpanded && (
                <div
                  id={`tabung-actions-${g.id}`}
                  className="mt-4 pt-4 border-t border-[var(--border)] space-y-4"
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                          Edit Tabung
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <IconPicker value={editEmoji} onChange={setEditEmoji} />
                      <Input
                        label="Tabung name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="E.g. New Bicycle"
                        maxLength={40}
                      />
                      <Input
                        label="Target amount (RM)"
                        type="number"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        placeholder="0.00"
                        min={1}
                      />
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => saveEdit(g.id)}
                          disabled={busy}
                          className="flex-1 justify-center min-h-[44px]"
                        >
                          {busy ? "Saving…" : "Save Tabung"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setEditingId(null)}
                          className="min-h-[44px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        {!complete ? (
                          <span className="text-xs text-[var(--text-secondary)]">
                            Wallet <Money amount={balance} /> · Remaining:{" "}
                            <Money amount={remaining} />
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-[var(--success-text)] flex items-center gap-1">
                            <AppIcon name="approve" size={14} />
                            Tabung complete!
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(g.id);
                              setEditName(g.name);
                              setEditTarget(String(g.target));
                              setEditEmoji(g.emoji ?? "Target");
                            }}
                            title="Edit Tabung"
                            aria-label={`Edit ${g.name}`}
                            className="px-2.5 min-h-[44px] min-w-[44px] text-[var(--text-secondary)] hover:text-[var(--ink)]"
                          >
                            <AppIcon name="edit" size={16} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(g.id)}
                            title="Delete Tabung"
                            aria-label={`Delete ${g.name}`}
                            className="px-2.5 min-h-[44px] min-w-[44px] text-[var(--error-text)] hover:text-[var(--error-text)] hover:bg-[var(--error-soft)]"
                          >
                            <AppIcon
                              name="delete"
                              size={16}
                              color="var(--error)"
                            />
                          </Button>
                        </div>
                      </div>

                      {!complete && (
                        <MoneyKeypad
                          key={g.id}
                          min={0.5}
                          max={Math.min(balance, remaining)}
                          confirmLabel={`Save to "${g.name}"`}
                          busy={busy}
                          onConfirm={(amt) => save(g.id, g.name, amt)}
                          onCancel={() => setActiveGoal(null)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add New Tabung Form */}
      {showAdd && (
        <Card
          variant="default"
          className="p-5 space-y-4 border-2 border-[var(--primary)]/20 shadow-md"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 m-0">
              <AppIcon name="save" size={20} color="var(--primary)" />
              Create Tabung
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAdd(false);
                setNewName("");
                setNewTarget("");
                setNewEmoji("Target");
              }}
            >
              Cancel
            </Button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-2">
              Pick Tabung icon
            </label>
            <IconPicker value={newEmoji} onChange={setNewEmoji} />
          </div>

          <Input
            label="Tabung name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="E.g. Gaming Headset, Birthday Gift"
            maxLength={40}
          />

          <Input
            label="Target amount (RM)"
            type="number"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="0.00"
            min={1}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="primary"
              onClick={addGoal}
              disabled={busy}
              className="flex-1 justify-center min-h-[44px]"
            >
              {busy ? "Saving…" : "Save Tabung"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAdd(false);
                setNewName("");
                setNewTarget("");
                setNewEmoji("Target");
              }}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* 6. Primary "Create Tabung" button, full width after list */}
      {!showAdd && data.goals.length > 0 && (
        <Button
          id="btn-add-goal"
          type="button"
          variant="primary"
          onClick={() => {
            sfx.pop();
            setShowAdd(true);
          }}
          className="w-full justify-center min-h-[44px]"
        >
          <AppIcon name="plus" size={16} />
          Create Tabung
        </Button>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title="Delete this Tabung?"
        description="Your collected funds will stay in your core wallet balance. This Tabung will be permanently removed."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              onClick={() => setDeletingId(null)}
              className="min-h-[44px]"
            >
              Keep Tabung
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (deletingId) {
                  const targetGoal = data.goals.find(
                    (g: (typeof data.goals)[number]) => g.id === deletingId,
                  );
                  void deleteGoal(deletingId, targetGoal?.name || "Tabung");
                }
              }}
              className="min-h-[44px]"
            >
              {busy ? "Deleting..." : "Delete Tabung"}
            </Button>
          </div>
        }
      >
        <div className="py-2 text-xs text-[var(--text-secondary)]">
          Are you sure you want to delete this Tabung? All previous deposit logs
          remain in your activity log.
        </div>
      </Modal>

      {/* Tabung tips */}
      <div className="space-y-2">
        <SectionTitle>Tabung tips</SectionTitle>
        <Card variant="soft" className="p-4 sm:p-5">
          <ul className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary-text)] font-bold">·</span>
              Transfer money from your spending balance anytime to speed up
              Tabung progress.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary-text)] font-bold">·</span>
              Reach 100% to complete the Tabung and celebrate your milestone.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary-text)] font-bold">·</span>
              You can adjust your target or Tabung name at any point without
              losing saved money.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="grid grid-cols-6 gap-2 p-2 bg-[var(--surface-soft)] rounded-xl border border-[var(--border)]"
      role="listbox"
      aria-label="Tabung icon"
    >
      {ICON_KEYS.map((e) => {
        const selected = value === e;
        return (
          <button
            key={e}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(e)}
            aria-label={e}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer min-h-[44px] ${
              selected
                ? "bg-[var(--primary)] text-white shadow-sm scale-105"
                : "bg-white text-[var(--text-secondary)] hover:text-[var(--primary-text)] hover:bg-[var(--primary-soft)] border border-[var(--border)]"
            }`}
          >
            <AppIcon name={iconName(e)} size={20} />
          </button>
        );
      })}
    </div>
  );
}
