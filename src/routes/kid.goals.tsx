import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/section-title";
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
      <div className="wireframe-col">
        {[1, 2].map((i) => (
          <div key={i} className="wireframe-box" style={{ height: "6rem" }} />
        ))}
      </div>
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
    <>
      <div className="wireframe-space-between">
        <div>
          <h1>[icon: rocket] My Missions</h1>
          <p>Save up for your cosmic goals.</p>
        </div>
        <div className="wireframe-box">
          <strong>RM {balance.toFixed(2)} Fuel</strong>
        </div>
      </div>

      {/* ── Goal cards ── */}
      <div className="wireframe-col" style={{ marginTop: "1rem" }}>
        {data.goals.length === 0 && (
          <Card className="wireframe-card" style={{ textAlign: "center" }}>
            <p><strong>No active missions!</strong></p>
            <p><small>Tap the add button to launch your first mission.</small></p>
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
              className="wireframe-card"
            >
              <div>
                {complete && (
                  <div style={{ float: "right" }}>
                    <small><strong>[✓ Mission Accomplished]</strong></small>
                  </div>
                )}

                {isEditing ? (
                  /* ── Edit form ── */
                  <div className="wireframe-col">
                    <small>Edit Mission</small>
                    <div className="wireframe-row" style={{ flexWrap: "wrap" }}>
                      {ICON_KEYS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setEditEmoji(e)}
                          style={{
                            border: editEmoji === e ? "2px solid #000" : "1px solid #ccc",
                          }}
                        >
                          [icon: {e.toLowerCase()}]
                        </button>
                      ))}
                    </div>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Mission Name"
                      maxLength={40}
                    />
                    <div className="wireframe-row">
                      <label>Target RM</label>
                      <input
                        type="number"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        placeholder="0.00"
                        min={1}
                      />
                    </div>
                    <div className="wireframe-row">
                      <button
                        type="button"
                        onClick={() => saveEdit(g.id)}
                        disabled={editBusy}
                      >
                        {editBusy ? "Saving…" : "Save Mission"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        Abort
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Goal display ── */
                  <>
                    <div className="wireframe-space-between">
                      <div className="wireframe-row">
                        <span>[icon: {g.emoji ? g.emoji.toLowerCase() : "target"}]</span>
                        <div>
                          <strong>{g.name}</strong>
                          <div>
                            <small>RM {Number(g.saved).toFixed(2)} / RM {Number(g.target).toFixed(2)}</small>
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>
                        {pct}%
                      </div>
                    </div>

                    {/* Native Progress Bar */}
                    <div style={{ margin: "0.75rem 0" }}>
                      <progress value={pct} max={100} style={{ width: "100%" }} />
                    </div>

                    {/* Action buttons */}
                    <div className="wireframe-row">
                      {!complete && (
                        <button
                          type="button"
                          onClick={() => setActiveGoal(activeGoal === g.id ? null : g.id)}
                          style={{ flex: 1 }}
                        >
                          {activeGoal === g.id ? "[icon: close] Cancel" : "[icon: plus] Add Fuel"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(g.id);
                          setEditName(g.name);
                          setEditTarget(String(g.target));
                          setEditEmoji(g.emoji ?? "Target");
                          setActiveGoal(null);
                        }}
                        title="Edit Mission"
                      >
                        [icon: edit]
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(g.id)}
                        title="Abort Mission"
                      >
                        [icon: delete]
                      </button>
                    </div>

                    {/* Money keypad */}
                    {activeGoal === g.id && (
                      <div className="wireframe-box" style={{ marginTop: "1rem" }}>
                        <p>
                          Fuel Core: RM {balance.toFixed(2)} | Required: RM {remaining.toFixed(2)}
                        </p>
                        <MoneyKeypad
                          key={g.id}
                          min={0.5}
                          max={Math.min(balance, remaining)}
                          confirmLabel={`Fuel "${g.name}"`}
                          onConfirm={(amt) => save(g.id, amt)}
                          onCancel={() => setActiveGoal(null)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Add goal form ── */}
      {showAdd && (
        <Card className="wireframe-card" style={{ marginTop: "1rem" }}>
          <h3>[icon: rocket] New Mission</h3>

          {/* Emoji picker */}
          <div className="wireframe-row" style={{ flexWrap: "wrap", margin: "0.5rem 0" }}>
            {ICON_KEYS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setNewEmoji(e)}
                style={{
                  border: newEmoji === e ? "2px solid #000" : "1px solid #ccc",
                }}
              >
                [icon: {e.toLowerCase()}]
              </button>
            ))}
          </div>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="What is your mission objective?"
            maxLength={40}
            style={{ marginBottom: "0.5rem" }}
          />

          <div className="wireframe-row" style={{ marginBottom: "0.5rem" }}>
            <label>Target RM</label>
            <input
              type="number"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="0.00"
              min={1}
            />
          </div>

          <div className="wireframe-row">
            <button
              type="button"
              onClick={addGoal}
              disabled={addBusy}
            >
              {addBusy ? "Launching…" : "[icon: rocket] Launch Mission"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setNewName("");
                setNewTarget("");
                setNewEmoji("Target");
              }}
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* ── Add button ── */}
      {!showAdd && (
        <div style={{ marginTop: "1rem" }}>
          <button
            id="btn-add-goal"
            type="button"
            onClick={() => {
              sfx.pop();
              setShowAdd(true);
            }}
            style={{ width: "100%" }}
          >
            [icon: plus] Add New Goal
          </button>
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {deletingId && (
        <div className="wireframe-box" style={{ marginTop: "1rem", border: "2px solid #333" }}>
          <div>[icon: delete]</div>
          <h3>Abort Mission?</h3>
          <p>
            Your collected fuel will stay in your core. This mission will be permanently deleted!
          </p>
          <div className="wireframe-row">
            <button
              type="button"
              onClick={() => setDeletingId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteGoal(deletingId)}
            >
              Abort
            </button>
          </div>
        </div>
      )}

      <SectionTitle>Astronaut Tips</SectionTitle>
      <Card className="wireframe-card">
        <ul>
          <li>Transfer fuel from your core to a mission to track progress.</li>
          <li>Reach 100% to unlock a special celebration!</li>
          <li>Tap edit to change your objective or target fuel at any time.</li>
        </ul>
      </Card>
    </>
  );
}
