import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useParentData } from "@/hooks/use-parent-data";
import { useAuth } from "@/providers/auth";
import {
  edgeParentCreateKid,
  edgeParentDeleteKid,
  edgeParentMarkNotificationsRead,
  edgeParentGetSelfAvatar,
} from "@/lib/edge";
import { CrewMemberCard } from "@/features/parent/components";
import { toast } from "sonner";
import { QuoteCard } from "@/components/QuoteCard";
import { AvatarBubble } from "@/components/AvatarBubble";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/parent/")({
  head: () => ({ meta: [{ title: "Command Center — Centsibility" }] }),
  component: ParentHome,
});

function ParentHome() {
  const { user } = useAuth();
  const { kids, approvals, rewards, txs, notifications, scheduledHibahs, loading, refresh } =
    useParentData();
  const [deletingKidId, setDeletingKidId] = useState<string | null>(null);
  const [parentAvatar, setParentAvatar] = useState("phosphor:User");

  // Recruit modal state
  const [showRecruit, setShowRecruit] = useState(false);
  const [newKidName, setNewKidName] = useState("");
  const [newKidUsername, setNewKidUsername] = useState("");
  const [generating, setGenerating] = useState(false);
  const [setupCode, setSetupCode] = useState<string | null>(null);

  useEffect(() => {
    edgeParentGetSelfAvatar().then((res) => res.avatar && setParentAvatar(res.avatar));
  }, []);

  const openRecruit = () => {
    setNewKidName("");
    setNewKidUsername("");
    setSetupCode(null);
    setShowRecruit(true);
  };

  const closeRecruit = () => {
    setShowRecruit(false);
    setSetupCode(null);
    setNewKidName("");
    setNewKidUsername("");
  };

  const createKid = async () => {
    if (!newKidName.trim() || !newKidUsername.trim()) return;
    // Client-side duplicate name check
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
      });
      setSetupCode(res.kid.login_code);
      setNewKidName("");
      setNewKidUsername("");
      sfx.success();
      toast.success("Astronaut recruited!");
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

  if (loading) {
    return (
      <AppShell mode="parent">
        <div>
          <Skeleton />
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell mode="parent">
      {/* Hero header */}
      <header>
        <div>
          <AvatarBubble emoji={parentAvatar} size={56} ring />
          <div>
            <p>Commander</p>
            <h1>
              {user?.user_metadata?.display_name ?? user?.email?.split("@")[0]}
            </h1>
            <p>
              {kids.length} {kids.length === 1 ? "Astronaut" : "Crew"} ·{" "}
              {approvals.length + rewards.length} Transmissions
            </p>
          </div>
        </div>
      </header>

      {unread.length > 0 && (
        <section>
          <div>
            <div>
              [icon: bell] {unread.length} new {unread.length === 1 ? "transmission" : "transmissions"}
            </div>
            <button
              onClick={() => {
                sfx.tap();
                markRead();
              }}
            >
              Clear Log
            </button>
          </div>
          <ul>
            {unread.slice(0, 4).map((n) => (
              <li key={n.id}>
                <Link to={n.link ?? "/parent/approvals"}>
                  • {n.message}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>Crew Members</h2>

      {/* Empty state */}
      {kids.length === 0 && (
        <section>
          <div>[icon: leaf]</div>
          <p>No astronauts yet</p>
          <p>Recruit your first crew member to get started.</p>
          <button onClick={openRecruit}>
            [icon: user-plus] Recruit First Astronaut
          </button>
        </section>
      )}

      {/* Crew list */}
      {kids.length > 0 && (
        <div>
          {kids.map((c) => (
            <CrewMemberCard
              key={c.id}
              kid={c}
              kidTxs={txs.filter((t) => t.kid_id === c.id)}
              scheduledHibahs={scheduledHibahs?.filter((h) => h.kid_id === c.id) || []}
              onDeleteInitiate={setDeletingKidId}
              onRefresh={refresh}
            />
          ))}

          {/* Recruit another button */}
          <button onClick={openRecruit}>
            [icon: plus] Recruit Another Astronaut
          </button>
        </div>
      )}

      {/* Daily Islamic finance wisdom */}
      <h2>Stellar Wisdom</h2>
      <QuoteCard variant="parent" />

      <div>
        <h2>Pending Transmissions ({approvals.length + rewards.length})</h2>
        <Link to="/parent/approvals">View all →</Link>
      </div>

      {approvals.length + rewards.length === 0 ? (
        <section>
          [icon: check] All signals clear
        </section>
      ) : (
        <div>
          {approvals.slice(0, 2).map((a) => (
            <section key={a.id}>
              <div>
                <div>
                  <strong>{a.kids?.name} · {a.kind}</strong>
                </div>
                <div>
                  {(a.reason || "").split(" :: SIG::")[0]}
                </div>
              </div>
              <div>
                RM {a.amount}
              </div>
            </section>
          ))}
          {rewards.slice(0, 2).map((r) => (
            <section key={r.id}>
              <div>
                <div>
                  <strong>{r.kids?.name} · [icon: gift] Reward</strong>
                </div>
                <div>{r.name}</div>
              </div>
              <div>
                {r.cost} [icon: star]
              </div>
            </section>
          ))}
        </div>
      )}

      {deletingKidId && (
        <div role="dialog">
          <div>
            <h3>Expel Astronaut?</h3>
            <p>
              This action is permanent and will delete all their missions, logs, and progress. Are
              you absolutely sure?
            </p>
            <div>
              <button onClick={() => setDeletingKidId(null)}>
                Cancel
              </button>
              <button onClick={() => handleDeleteKid(deletingKidId)}>
                Yes, Expel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recruit Modal ── */}
      {showRecruit && (
        <div role="dialog">
          <div>
            <div>
              <h2>[icon: rocket] Recruit Astronaut</h2>
              <button onClick={closeRecruit} aria-label="Close">
                [icon: close]
              </button>
            </div>

            {setupCode ? (
              /* ── Success: show login code ── */
              <div>
                <div>6-Digit Login Code</div>
                <div>{setupCode}</div>
                <p>Share this code with your child so they can log in.</p>
                <button onClick={() => copyCode(setupCode)}>
                  [icon: copy] Copy Code
                </button>
                <button onClick={closeRecruit}>Done</button>
              </div>
            ) : (
              /* ── Form ── */
              <div>
                <div>
                  <label>Child's Name</label>
                  <input
                    autoFocus
                    value={newKidName}
                    onChange={(e) => setNewKidName(e.target.value)}
                    placeholder="e.g. Aiman"
                    maxLength={40}
                  />
                  {kids.some(
                    (k) => k.name.trim().toLowerCase() === newKidName.trim().toLowerCase(),
                  ) && newKidName.trim() && (
                    <p>A child with this name already exists.</p>
                  )}
                </div>
                <div>
                  <label>@Username</label>
                  <div>
                    <span>@</span>
                    <input
                      value={newKidUsername}
                      onChange={(e) =>
                        setNewKidUsername(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                        )
                      }
                      placeholder="username"
                      maxLength={20}
                    />
                  </div>
                  <p>Lowercase letters, numbers and _ only. Must be unique.</p>
                </div>
                <button
                  onClick={createKid}
                  disabled={
                    generating ||
                    !newKidName.trim() ||
                    !newKidUsername.trim() ||
                    kids.some(
                      (k) => k.name.trim().toLowerCase() === newKidName.trim().toLowerCase(),
                    )
                  }
                >
                  {generating ? "Launching…" : "[icon: rocket] Launch Astronaut"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
