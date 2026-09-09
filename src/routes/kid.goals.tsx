import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
import { useKidData } from "@/hooks/use-kid-data";
import { edgeKidContributeGoal } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { MoneyKeypad } from "@/components/MoneyKeypad";
import { toast } from "sonner";
import { sfx } from "@/lib/sounds";

export const Route = createFileRoute("/kid/goals")({
  head: () => ({ meta: [{ title: "My Missions — Centsibility" }] }),
  component: KidGoals,
});

import {
  Target,
  Trophy,
  GameController,
  Rocket,
  Star,
  Gift,
  House,
  BookOpen,
  MusicNote,
  Bicycle,
  Globe,
  Heart,
  Plus,
  PencilSimple,
  Trash,
  CheckCircle,
  X,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

function GoalBalloons() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[1.5rem] z-0">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-full bg-gradient-to-t from-neon-mint/30 to-transparent blur-2xl"
      />
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: 200, x: Math.random() * 100 - 50, opacity: 0, scale: 0.5 }}
          animate={{ y: -100, x: Math.random() * 100 - 50, opacity: [0, 1, 0], scale: 1 }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
          className="absolute bottom-0 left-1/2 text-2xl"
          style={{ marginLeft: `${(i - 2.5) * 20}px` }}
        >
          {["🎈", "✨", "🌟", "🎈"][i % 4]}
        </motion.div>
      ))}
    </div>
  );
}

/* ─── helpers ─── */
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

function GoalIcon({ name, className = "w-6 h-6" }: { name: string; className?: string }) {
  const icons: Record<string, any> = {
    Target,
    Trophy,
    GameController,
    Rocket,
    Star,
    Gift,
    House,
    BookOpen,
    MusicNote,
    Bicycle,
    Globe,
    Heart,
  };
  const Icon = icons[name] || Target;
  return <Icon weight="duotone" className={className} />;
}

function KidGoals() {
  const { data, loading, refresh } = useKidData();
  const [activeGoal, setActiveGoal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  /* Add form state */
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newEmoji, setNewEmoji] = useState("Target");
  const [addBusy, setAddBusy] = useState(false);

  /* Edit form state */
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editEmoji, setEditEmoji] = useState("Target");
  const [editBusy, setEditBusy] = useState(false);

  if (loading || !data)
    return (
      <AppShell mode="kid">
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-36 rounded-3xl glass-panel bg-void/30 animate-pulse border-starlight/10"
            />
          ))}
        </div>
      </AppShell>
    );

  const balance = Number(data.kid.balance);
  const code = getKidSession()?.code;
  const kidId = data.kid.id;

  /* ── Save money to a goal ── */
  const save = async (goalId: string, amount: number) => {
    if (!code) return;
    try {
      await edgeKidContributeGoal({ code, goalId, amount });
      sfx.coin();
      toast.success("Saved! Keep it up 🌟");
      setActiveGoal(null);
      refresh();
    } catch (e: unknown) {
      sfx.error();
      toast.error(e instanceof Error ? e.message : "An error occurred");
    }
  };

  /* ── Add new goal ── */
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

  /* ── Edit goal ── */
  const saveEdit = async (goalId: string) => {
    const target = parseFloat(editTarget);
    if (!editName.trim() || isNaN(target) || target <= 0) {
      toast.error("Enter a valid name and target amount");
      return;
    }
    setEditBusy(true);
    try {
      // Find the goal to check if saved exceeds new target
      const goal = data.goals.find((g: (typeof data.goals)[number]) => g.id === goalId);
      const currentSaved = goal ? Number(goal.saved) : 0;
      const newSaved = Math.min(currentSaved, target);
      const excess = currentSaved - newSaved;

      const { error } = await supabase
        .from("goals")
        .update({ name: editName.trim(), emoji: editEmoji, target, saved: newSaved })
        .eq("id", goalId);
      if (error) throw new Error(error.message);

      // Refund excess back to kid's balance if target was reduced
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

  /* ── Delete goal ── */
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

  return (
    <AppShell mode="kid">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl text-starlight flex items-center gap-2 drop-shadow-sm">
            <Rocket
              weight="duotone"
              className="w-8 h-8 text-nebula-pink drop-shadow-[0_0_8px_var(--nebula-pink)]"
            />
            My Missions
          </h1>
          <p className="font-body text-sm text-starlight/60 mt-1">Save up for your cosmic goals.</p>
        </div>
        <span className="font-mono text-sm font-bold text-neon-mint mt-1 bg-neon-mint/10 px-3 py-1 rounded-full border border-neon-mint/20 shadow-neon">
          RM {balance.toFixed(2)} Fuel
        </span>
      </div>

      {/* ── Goal cards ── */}
      <div className="mt-6 space-y-4">
        {data.goals.length === 0 && (
          <Card className="text-center py-12 glass-panel border-starlight/20 shadow-soft">
            <div className="flex justify-center mb-4 text-starlight/40 drop-shadow-lg">
              <Rocket weight="duotone" className="w-16 h-16" />
            </div>
            <p className="font-kid font-bold text-starlight text-xl tracking-wide">
              No active missions!
            </p>
            <p className="font-body text-sm text-starlight/60 mt-2">
              Tap the <Plus weight="bold" className="inline text-nebula-pink w-4 h-4" /> button to
              launch your first mission.
            </p>
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
              className={`relative overflow-hidden glass-panel transition-all ${complete ? "border-neon-mint shadow-neon bg-neon-mint/10 scale-[1.02]" : "border-starlight/20 shadow-soft"}`}
            >
              {complete && <GoalBalloons />}

              <div className="relative z-10">
                {/* Complete badge */}
                {complete && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-0 right-0 rounded-full bg-neon-mint px-3 py-1 font-kid text-[10px] font-bold text-void flex items-center gap-1 shadow-[0_0_10px_var(--neon-mint)] uppercase tracking-wider"
                  >
                    <CheckCircle weight="fill" className="w-3.5 h-3.5" /> Mission Accomplished
                  </motion.span>
                )}

                {isEditing ? (
                  /* ── Edit form ── */
                  <div className="space-y-4">
                    <p className="font-kid text-xs font-bold text-starlight/50 uppercase tracking-wider">
                      Edit Mission
                    </p>
                    {/* Emoji picker */}
                    <div className="flex flex-wrap gap-2">
                      {ICON_KEYS.map((e) => (
                        <button
                          key={e}
                          onClick={() => setEditEmoji(e)}
                          className={`rounded-2xl p-2.5 transition shadow-sm border ${editEmoji === e ? "bg-nebula-pink border-nebula-pink text-white shadow-[0_0_15px_var(--nebula-pink)]" : "bg-void/50 border-starlight/10 text-starlight hover:border-nebula-pink/50 hover:text-nebula-pink"}`}
                        >
                          <GoalIcon name={e} className="w-6 h-6" />
                        </button>
                      ))}
                    </div>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Mission Name"
                      className="w-full rounded-2xl border border-starlight/20 bg-void/50 px-4 py-3 font-kid text-sm text-starlight focus:border-nebula-pink focus:outline-none placeholder:text-starlight/30 shadow-inner"
                      maxLength={40}
                    />
                    <div className="flex items-center gap-3">
                      <span className="font-kid font-bold text-sm text-starlight/50 whitespace-nowrap uppercase tracking-wider">
                        Target RM
                      </span>
                      <input
                        type="number"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        placeholder="0.00"
                        min={1}
                        className="flex-1 rounded-2xl border border-starlight/20 bg-void/50 px-4 py-3 font-mono font-bold text-sm text-starlight focus:border-nebula-pink focus:outline-none shadow-inner"
                      />
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => saveEdit(g.id)}
                        disabled={editBusy}
                        className="btn-press flex-1 rounded-2xl bg-neon-mint py-3 font-kid font-bold text-void text-sm disabled:opacity-50 shadow-neon uppercase tracking-wider transition hover:scale-105"
                      >
                        {editBusy ? "Saving…" : "Save Mission"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-press flex-1 rounded-2xl bg-void border border-starlight/20 py-3 font-kid font-bold text-starlight text-sm shadow-sm uppercase tracking-wider hover:bg-white/10 transition"
                      >
                        Abort
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Goal display ── */
                  <>
                    <div className="flex items-center gap-4">
                      <motion.div
                        animate={complete ? { y: [0, -8, 0], scale: [1, 1.1, 1] } : {}}
                        transition={
                          complete ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}
                        }
                        className={`grid h-16 w-16 shrink-0 place-items-center rounded-[1.5rem] border ${complete ? "bg-neon-mint border-neon-mint text-void shadow-[0_0_20px_var(--neon-mint)]" : "bg-void/50 border-starlight/20 text-starlight shadow-inner"}`}
                      >
                        <GoalIcon name={g.emoji ?? "Target"} className="w-8 h-8" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <div className="font-kid font-bold text-starlight text-lg truncate tracking-wide">
                          {g.name}
                        </div>
                        <div className="font-mono text-xs text-starlight/60 mt-1 font-semibold">
                          RM {Number(g.saved).toFixed(2)} / RM {Number(g.target).toFixed(2)}
                        </div>
                      </div>
                      <div
                        className={`font-display text-2xl font-bold shrink-0 ${complete ? "text-neon-mint drop-shadow-[0_0_5px_var(--neon-mint)]" : "text-starlight"}`}
                      >
                        {pct}%
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-5 h-4 overflow-hidden rounded-full bg-void/50 border border-starlight/10 shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${complete ? "bg-neon-mint shadow-[0_0_15px_var(--neon-mint)]" : "bg-gradient-to-r from-cosmic-blue via-nebula-pink to-neon-mint"}`}
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="mt-5 flex gap-3">
                      {!complete && (
                        <button
                          onClick={() => setActiveGoal(activeGoal === g.id ? null : g.id)}
                          className={`btn-press flex-1 rounded-2xl border py-3 font-kid text-sm font-bold transition shadow-soft flex items-center justify-center gap-1.5 uppercase tracking-wider ${activeGoal === g.id ? "bg-nova-red border-nova-red text-white shadow-[0_0_15px_var(--nova-red)]" : "bg-cosmic-blue border-cosmic-blue text-white shadow-[0_0_15px_var(--cosmic-blue)] hover:bg-cosmic-blue/80"}`}
                        >
                          {activeGoal === g.id ? (
                            <>
                              <X weight="bold" className="w-4 h-4" /> Cancel
                            </>
                          ) : (
                            <>
                              <Plus weight="bold" className="w-4 h-4" /> Add Fuel
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingId(g.id);
                          setEditName(g.name);
                          setEditTarget(String(g.target));
                          setEditEmoji(g.emoji ?? "Target");
                          setActiveGoal(null);
                        }}
                        className="btn-press rounded-2xl glass-panel px-4 py-3 font-kid text-sm font-bold text-starlight hover:bg-white/10 transition shadow-sm flex items-center justify-center border-starlight/20"
                        title="Edit Mission"
                      >
                        <PencilSimple weight="duotone" className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(g.id)}
                        className="btn-press rounded-2xl glass-panel px-4 py-3 font-kid text-sm font-bold text-nova-red hover:bg-nova-red/20 transition shadow-sm flex items-center justify-center border-nova-red/30"
                        title="Abort Mission"
                      >
                        <Trash weight="duotone" className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Money keypad */}
                    <AnimatePresence>
                      {activeGoal === g.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 rounded-3xl glass-panel bg-void/50 p-4 border border-cosmic-blue/30 shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden"
                        >
                          <p className="font-kid text-[11px] font-bold text-starlight/60 mb-3 uppercase tracking-wider">
                            Fuel Core:{" "}
                            <span className="font-mono text-neon-mint ml-1">
                              RM {balance.toFixed(2)}
                            </span>
                            <span className="mx-2 text-starlight/30">|</span>
                            Required:{" "}
                            <span className="font-mono text-nebula-pink ml-1">
                              RM {remaining.toFixed(2)}
                            </span>
                          </p>
                          <MoneyKeypad
                            key={g.id}
                            min={0.5}
                            max={Math.min(balance, remaining)}
                            confirmLabel={`Fuel "${g.name}"`}
                            confirmBg="bg-cosmic-blue shadow-[0_0_15px_var(--cosmic-blue)] font-kid tracking-wide"
                            onConfirm={(amt) => save(g.id, amt)}
                            onCancel={() => setActiveGoal(null)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Add goal form (modal-like card) ── */}
      {showAdd && (
        <Card className="mt-5 border-2 border-dashed border-nebula-pink/40 bg-void/80 glass-panel shadow-neon">
          <p className="font-kid text-lg font-bold text-starlight mb-4 flex items-center gap-2">
            <Rocket
              weight="duotone"
              className="w-6 h-6 text-nebula-pink drop-shadow-[0_0_5px_var(--nebula-pink)]"
            />{" "}
            New Mission
          </p>

          {/* Emoji picker */}
          <div className="flex flex-wrap gap-2 mb-5">
            {ICON_KEYS.map((e) => (
              <button
                key={e}
                onClick={() => setNewEmoji(e)}
                className={`rounded-2xl p-2.5 transition shadow-sm border ${newEmoji === e ? "bg-nebula-pink border-nebula-pink text-white shadow-[0_0_15px_var(--nebula-pink)] scale-110" : "bg-void/50 border-starlight/10 text-starlight hover:border-nebula-pink/50 hover:text-nebula-pink"}`}
              >
                <GoalIcon name={e} className="w-6 h-6" />
              </button>
            ))}
          </div>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="What is your mission objective?"
            className="w-full rounded-2xl border border-starlight/20 bg-void/50 px-4 py-3.5 font-kid text-sm text-starlight focus:border-nebula-pink focus:outline-none mb-4 placeholder:text-starlight/40 shadow-inner"
            maxLength={40}
            autoFocus
          />

          <div className="flex items-center gap-3 mb-6">
            <span className="font-kid font-bold text-sm text-starlight/50 whitespace-nowrap uppercase tracking-wider">
              Target RM
            </span>
            <input
              type="number"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="0.00"
              min={1}
              className="flex-1 rounded-2xl border border-starlight/20 bg-void/50 px-4 py-3.5 font-mono font-bold text-lg text-starlight focus:border-nebula-pink focus:outline-none shadow-inner"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={addGoal}
              disabled={addBusy}
              className="btn-press flex-1 rounded-2xl bg-nebula-pink py-4 font-kid font-bold text-white text-sm disabled:opacity-50 transition shadow-[0_0_15px_var(--nebula-pink)] flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              {addBusy ? (
                "Launching…"
              ) : (
                <>
                  <Rocket weight="bold" className="w-5 h-5" /> Launch Mission
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewName("");
                setNewTarget("");
                setNewEmoji("Target");
              }}
              className="btn-press flex-1 rounded-2xl bg-void border border-starlight/20 py-4 font-kid font-bold text-starlight text-sm shadow-sm uppercase tracking-wider hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* ── Floating add button ── */}
      {!showAdd && (
        <button
          id="btn-add-goal"
          onClick={() => {
            sfx.pop();
            setShowAdd(true);
          }}
          className="btn-press fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-[1.5rem] bg-bubblegum text-white text-2xl shadow-[0_10px_20px_-10px_rgba(0,0,0,0.3)] transition"
          title="Add new goal"
        >
          <Plus weight="bold" className="w-6 h-6" />
        </button>
      )}

      {/* ── Delete confirm modal ── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2.5rem] glass-panel bg-void/90 p-8 shadow-neon text-center border-nova-red/40">
            <div className="flex justify-center mb-4 text-nova-red opacity-90 drop-shadow-[0_0_10px_var(--nova-red)]">
              <Trash weight="duotone" className="w-14 h-14" />
            </div>
            <h3 className="font-kid text-xl font-bold text-starlight uppercase tracking-wide">
              Abort Mission?
            </h3>
            <p className="mt-3 font-body text-sm text-starlight/70 leading-relaxed">
              Your collected fuel will stay in your core. This mission will be permanently deleted!
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 rounded-2xl bg-void border border-starlight/20 py-3 font-kid text-sm font-bold text-starlight uppercase tracking-wider hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteGoal(deletingId)}
                className="flex-1 rounded-2xl bg-nova-red py-3 font-kid text-sm font-bold text-white shadow-[0_0_15px_var(--nova-red)] uppercase tracking-wider transition hover:scale-105"
              >
                Abort
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionTitle>Astronaut Tips</SectionTitle>
      <Card className="glass-panel border-starlight/20 bg-void/50 shadow-none">
        <ul className="space-y-4 font-body text-sm text-starlight/80">
          <li className="flex items-start gap-3">
            <Rocket weight="bold" className="w-5 h-5 text-neon-mint mt-0.5" /> Transfer fuel from
            your core to a mission to track progress.
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle weight="bold" className="w-5 h-5 text-neon-mint mt-0.5" /> Reach 100% to
            unlock a special celebration!
          </li>
          <li className="flex items-start gap-3">
            <PencilSimple weight="bold" className="w-5 h-5 text-starlight/50 mt-0.5" /> Tap edit to
            change your objective or target fuel at any time.
          </li>
        </ul>
      </Card>
    </AppShell>
  );
}
