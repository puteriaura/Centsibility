import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { SectionTitle } from "@/components/ui/section-title";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidContributeGoal } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";
import { AppIcon } from "@/components/ui/app-icon";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/kid/goals")({
  head: () => ({ meta: [{ title: "My Missions — Centsibility" }] }),
  component: KidGoals,
});

const ICON_KEYS = [
  "Target",
  "Trophy",
  "GameController",
  "Rocket",
  "Star",
  "Gift",
  "House",
  "BookOpen",
  "MusicNote",
  "Bicycle",
  "Globe",
  "Heart",
];

function iconName(key: string) {
  return key.replace(/[\s_-]+/g, "").toLowerCase();
}

function KidGoals() {
  const { data, loading, refresh } = useKidData();
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newEmoji, setNewEmoji] = useState("Target");
  const [addBusy, setAddBusy] = useState(false);

  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editEmoji, setEditEmoji] = useState("Target");
  const [editBusy, setEditBusy] = useState(false);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton style={{ height: "4rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
        <Skeleton style={{ height: "10rem", borderRadius: "20px" }} />
      </div>
    );
  }

  const balance = Number(data.kid.balance);
  const code = getKidSession()?.code;
  const kidId = data.kid.id;

  const save = async (goalId: string, amount: number) => {
    if (!code) return;
    try {
      await edgeKidContributeGoal({ code, goalId, amount });
      sfx.coin();
      toast.success("Saved! Keep it up");
      setActiveGoal(null);
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  const addGoal = async () => {
    const target = parseFloat(newTarget);
    if (!newName.trim() || isNaN(target) || target <= 0) {
      toast.error("Enter a valid name and target amount");
      return;
    }
    setAddBusy(true);
    try {
      const { error } = await supabase
        .from("goals")
        .insert({ kid_id: kidId, name: newName.trim(), emoji: newEmoji, target });
      if (error) throw new Error(error.message);
      sfx.success();
      toast.success("Goal added!");
      setNewName("");
      setNewTarget("");
      setNewEmoji("Target");
      setShowAdd(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add goal");
    } finally {
      setAddBusy(false);
    }
  };

  const saveEdit = async (goalId: string) => {
    const target = parseFloat(editTarget);
    if (!editName.trim() || isNaN(target) || target <= 0) {
      toast.error("Enter a valid name and target amount");
      return;
    }
    setEditBusy(true);
    try {
      const goal = data.goals.find((g: (typeof data.goals)[number]) => g.id === goalId);
      const currentSaved = goal ? Number(goal.saved) : 0;
      const newSaved = Math.min(currentSaved, target);
      const excess = currentSaved - newSaved;

      const { error } = await supabase
        .from("goals")
        .update({ name: editName.trim(), emoji: editEmoji, target, saved: newSaved })
        .eq("id", goalId);
      if (error) throw new Error(error.message);

      if (excess > 0 && code) {
        const kid = data.kid;
        await supabase
          .from("kids")
          .update({ balance: Number(kid.balance) + excess })
          .eq("id", kid.id);
      }

      toast.success(
        excess > 0 ? `Goal updated! RM ${excess.toFixed(2)} refunded.` : "Goal updated!",
      );
      setEditingId(null);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update goal");
    } finally {
      setEditBusy(false);
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw new Error(error.message);
      sfx.tap();
      toast.success("Goal removed");
      setDeletingId(null);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete goal");
    }
  };

  const totalSaved = data.goals.reduce(
    (sum: number, g: (typeof data.goals)[number]) => sum + Number(g.saved),
    0,
  );
  const totalTarget = data.goals.reduce(
    (sum: number, g: (typeof data.goals)[number]) => sum + Number(g.target),
    0,
  );
  const completedCount = data.goals.filter(
    (g: (typeof data.goals)[number]) => Number(g.saved) >= Number(g.target),
  ).length;

  return (
    <div className="space-y-6 pb-12">
      <section className="deposit-hero" aria-label="Savings pots summary">
        <div className="deposit-hero__copy">
          <p className="deposit-hero__label">Saved across pots</p>
          <p className="deposit-hero__amount tabular-nums">RM{totalSaved.toFixed(2)}</p>
          <p className="deposit-hero__link" style={{ cursor: "default", textDecoration: "none" }}>
            {data.goals.length} pot{data.goals.length === 1 ? "" : "s"}
            {totalTarget > 0 ? ` · of RM${totalTarget.toFixed(0)}` : ""}
            {completedCount > 0 ? ` · ${completedCount} done` : ""}
          </p>
        </div>
        <div className="deposit-hero__mascot" aria-hidden="true">
          <AppIcon name="goal" size={32} color="#fff" />
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--ink)] m-0">Savings Pots</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-0">
            Wallet RM{balance.toFixed(2)} ready to allocate
          </p>
        </div>
        {!showAdd && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              sfx.tap();
              setShowAdd(true);
            }}
            className="shrink-0 font-bold"
          >
            <AppIcon name="plus" size={14} /> New pot
          </Button>
        )}
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {data.goals.length === 0 && (
          <Card variant="soft" className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[var(--primary-pale)] text-[var(--primary)] flex items-center justify-center mx-auto">
              <AppIcon name="target" size={32} />
            </div>
            <h3 className="text-base font-bold text-[var(--ink)]">No Active Missions Yet</h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
              Start putting money aside for games, books, or family gifts to reach your milestones.
            </p>
            {!showAdd && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  sfx.pop();
                  setShowAdd(true);
                }}
                className="mx-auto"
              >
                <AppIcon name="plus" size={16} />
                Create First Mission
              </Button>
            )}
          </Card>
        )}

        {data.goals.map((g: (typeof data.goals)[number]) => {
          const pct = Math.min(100, Math.round((Number(g.saved) / Number(g.target)) * 100));
          const remaining = Math.max(0, Number(g.target) - Number(g.saved));
          const complete = pct >= 100;
          const isEditing = editingId === g.id;

          return (
            <Card
              key={g.id}
              variant="default"
              className={`p-5 rounded-2xl border transition-all duration-200 ${
                complete
                  ? "border-[var(--success)]/40 bg-[var(--success-soft)]/20"
                  : "border-[var(--border)]"
              }`}
            >
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                      Edit Mission
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
                    label="Mission Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="E.g. New Bicycle"
                    maxLength={40}
                  />
                  <Input
                    label="Target Amount (RM)"
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
                      disabled={editBusy}
                      className="flex-1 justify-center"
                    >
                      {editBusy ? "Saving…" : "Save Mission"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Top row: Icon, Name, Target, and Completion Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--surface-pink)] text-[var(--primary)] flex items-center justify-center shrink-0">
                        <AppIcon
                          name={iconName(g.emoji || "Target")}
                          size={24}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[var(--ink)] leading-snug">
                            {g.name}
                          </h3>
                          {complete && (
                            <Badge variant="success">Completed</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          Target: RM {Number(g.target).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-bold tabular-nums text-[var(--ink)] block">
                        RM {Number(g.saved).toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-muted)]">
                        {pct}% reached
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <Progress value={Number(g.saved)} max={Number(g.target)} height={10} />
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    {!complete ? (
                      <Button
                        type="button"
                        variant={activeGoal === g.id ? "secondary" : "brand"}
                        size="sm"
                        onClick={() => setActiveGoal(activeGoal === g.id ? null : g.id)}
                      >
                        <AppIcon name={activeGoal === g.id ? "close" : "plus"} size={14} />
                        {activeGoal === g.id ? "Cancel" : "Add Funds"}
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-[var(--success)] flex items-center gap-1">
                        <AppIcon name="approve" size={14} />
                        Ready to claim or enjoy!
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
                          setActiveGoal(null);
                        }}
                        title="Edit Mission"
                        aria-label={`Edit ${g.name}`}
                        className="px-2.5 min-h-[38px] text-[var(--text-secondary)] hover:text-[var(--ink)]"
                      >
                        <AppIcon name="edit" size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(g.id)}
                        title="Delete Mission"
                        aria-label={`Delete ${g.name}`}
                        className="px-2.5 min-h-[38px] text-[var(--error)] hover:text-[var(--error)] hover:bg-[var(--error-soft)]"
                      >
                        <AppIcon name="delete" size={16} color="var(--error)" />
                      </Button>
                    </div>
                  </div>

                  {/* Add Funds Keypad Slide-in */}
                  {activeGoal === g.id && (
                    <div className="pt-3 mt-3 border-t border-dashed border-[var(--border)]">
                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-3">
                        <span>Wallet: <strong>RM {balance.toFixed(2)}</strong></span>
                        <span>Remaining to goal: <strong>RM {remaining.toFixed(2)}</strong></span>
                      </div>
                      <MoneyKeypad
                        key={g.id}
                        min={0.5}
                        max={Math.min(balance, remaining)}
                        confirmLabel={`Deposit to "${g.name}"`}
                        onConfirm={(amt) => save(g.id, amt)}
                        onCancel={() => setActiveGoal(null)}
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add New Goal Card Form */}
      {showAdd && (
        <Card variant="default" className="p-5 space-y-4 border-2 border-[var(--primary)]/20 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2">
              <AppIcon name="rocket" size={20} color="var(--primary)" />
              New Savings Mission
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
              Pick Mission Icon
            </label>
            <IconPicker value={newEmoji} onChange={setNewEmoji} />
          </div>

          <Input
            label="Mission Objective"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="E.g. Gaming Headset, Birthday Gift"
            maxLength={40}
          />

          <Input
            label="Target Amount (RM)"
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
              disabled={addBusy}
              className="flex-1 justify-center"
            >
              {addBusy ? "Launching…" : "Launch Mission"}
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
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {!showAdd && data.goals.length > 0 && (
        <Button
          id="btn-add-goal"
          type="button"
          variant="primary"
          onClick={() => {
            sfx.pop();
            setShowAdd(true);
          }}
          className="w-full justify-center"
        >
          <AppIcon name="plus" size={16} />
          Add New Mission Goal
        </Button>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title="Abort Mission?"
        description="Your collected funds will stay in your core wallet balance. This mission goal will be permanently removed."
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setDeletingId(null)}>
              Keep Mission
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deletingId) deleteGoal(deletingId);
              }}
            >
              Delete Goal
            </Button>
          </div>
        }
      >
        <div className="py-2 text-xs text-[var(--text-secondary)]">
          Are you sure you want to discontinue this mission? All previous deposit logs remain in your activity log.
        </div>
      </Modal>

      {/* Saving Advice & Tips */}
      <div className="space-y-2">
        <SectionTitle>Mission Intel</SectionTitle>
        <Card variant="soft" className="p-4 sm:p-5">
          <ul className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary)] font-bold">·</span>
              Transfer money from your main wallet anytime to speed up goal progress.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary)] font-bold">·</span>
              Reach 100% to complete the mission and claim your reward milestone.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary)] font-bold">·</span>
              You can adjust your target or mission name at any point without losing saved money.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="grid grid-cols-6 gap-2 p-2 bg-[var(--surface-soft)] rounded-xl border border-[var(--border)]"
      role="listbox"
      aria-label="Mission icon"
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
                : "bg-white text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--surface-pink)] border border-[var(--border)]"
            }`}
          >
            <AppIcon name={iconName(e)} size={20} />
          </button>
        );
      })}
    </div>
  );
}
