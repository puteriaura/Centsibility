import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Card, SectionTitle } from "@/components/AppShell";
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
import {
  Bell,
  Leaf,
  CheckCircle,
  Gift,
  Star,
  Plus,
  X,
  UserPlus,
  RocketLaunch,
  Copy,
} from "@phosphor-icons/react";

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
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell mode="parent">
      {/* Hero header — Cosmic style */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-6 text-starlight shadow-neon">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cosmic-blue/20 blur-[50px]" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-neon-mint/10 blur-[50px]" />
        <div className="relative flex items-center gap-4">
          <AvatarBubble emoji={parentAvatar} size={56} ring />
          <div className="flex-1 min-w-0">
            <p className="font-kid text-[10px] uppercase tracking-widest text-neon-mint">
              Commander
            </p>
            <h1 className="font-display text-2xl font-bold truncate tracking-tight text-starlight">
              {user?.user_metadata?.display_name ?? user?.email?.split("@")[0]}
            </h1>
            <p className="font-body text-[11px] text-starlight/60 mt-1 font-medium tracking-wide">
              {kids.length} {kids.length === 1 ? "Astronaut" : "Crew"} ·{" "}
              {approvals.length + rewards.length} Transmissions
            </p>
          </div>
        </div>
      </div>

      {unread.length > 0 && (
        <Card className="mt-4 border border-nova-red/30 bg-nova-red/10 shadow-[0_0_15px_rgba(255,100,100,0.1)]">
          <div className="flex items-center justify-between">
            <div className="font-kid font-bold text-nova-red flex items-center gap-2">
              <Bell weight="fill" className="w-5 h-5 animate-pulse" />
              {unread.length} new {unread.length === 1 ? "transmission" : "transmissions"}
            </div>
            <button
              onClick={() => {
                sfx.tap();
                markRead();
              }}
              className="rounded-full bg-void border border-nova-red/30 px-3 py-1 font-kid text-xs font-bold text-starlight hover:bg-nova-red hover:text-white transition"
            >
              Clear Log
            </button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {unread.slice(0, 4).map((n) => (
              <li key={n.id} className="font-body text-xs text-starlight/80">
                <Link
                  to={n.link ?? "/parent/approvals"}
                  className="hover:text-neon-mint transition"
                >
                  • {n.message}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <SectionTitle>Crew Members</SectionTitle>

      {/* Empty state */}
      {kids.length === 0 && (
        <Card className="border border-dashed border-neon-mint/40 bg-neon-mint/5 text-center py-8">
          <Leaf weight="duotone" className="w-10 h-10 text-neon-mint mx-auto mb-3" />
          <p className="font-kid font-bold text-starlight">No astronauts yet</p>
          <p className="font-body text-xs text-starlight/60 mt-1 mb-4">
            Recruit your first crew member to get started.
          </p>
          <button
            onClick={openRecruit}
            className="btn-press inline-flex items-center gap-2 rounded-full bg-neon-mint px-6 py-3 font-kid text-sm font-bold text-void shadow-neon hover:scale-105 transition"
          >
            <UserPlus weight="bold" className="w-4 h-4" /> Recruit First Astronaut
          </button>
        </Card>
      )}

      {/* Crew list */}
      {kids.length > 0 && (
        <div className="space-y-3">
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
          <button
            onClick={openRecruit}
            className="btn-press w-full rounded-[2rem] glass-panel border border-dashed border-neon-mint/40 py-4 flex items-center justify-center gap-2 font-kid text-sm font-bold text-neon-mint hover:bg-neon-mint/10 transition uppercase tracking-wider"
          >
            <Plus weight="bold" className="w-4 h-4" /> Recruit Another Astronaut
          </button>
        </div>
      )}

      {/* Daily Islamic finance wisdom */}
      <SectionTitle>Stellar Wisdom</SectionTitle>
      <QuoteCard variant="parent" />

      <SectionTitle
        action={
          <Link
            to="/parent/approvals"
            className="font-kid text-xs font-bold text-neon-mint uppercase tracking-wider"
          >
            View all →
          </Link>
        }
      >
        Pending Transmissions ({approvals.length + rewards.length})
      </SectionTitle>
      {approvals.length + rewards.length === 0 ? (
        <Card className="text-center text-starlight/60 font-body text-sm flex items-center justify-center gap-2 glass-panel border border-starlight/20 shadow-none">
          <CheckCircle weight="duotone" className="w-5 h-5 text-neon-mint" /> All signals clear
        </Card>
      ) : (
        <div className="space-y-2">
          {approvals.slice(0, 2).map((a) => (
            <Card key={a.id} className="glass-panel border-starlight/20 bg-void/50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-kid text-sm font-bold text-starlight">
                    {a.kids?.name} · {a.kind}
                  </div>
                  <div className="font-body text-xs text-starlight/60 mt-0.5">
                    {(a.reason || "").split(" :: SIG::")[0]}
                  </div>
                </div>
                <div className="font-mono font-bold text-neon-mint flex items-center gap-1">
                  RM {a.amount}
                </div>
              </div>
            </Card>
          ))}
          {rewards.slice(0, 2).map((r) => (
            <Card key={r.id} className="glass-panel border-starlight/20 bg-void/50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-kid text-sm font-bold text-starlight flex items-center gap-2">
                    {r.kids?.name} · <Gift weight="duotone" className="w-4 h-4 text-nebula-pink" />{" "}
                    Reward
                  </div>
                  <div className="font-body text-xs text-starlight/60 mt-0.5">{r.name}</div>
                </div>
                <div className="font-mono font-bold text-starlight flex items-center gap-1">
                  {r.cost}{" "}
                  <Star
                    weight="fill"
                    className="w-4 h-4 text-starlight drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {deletingKidId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2.5rem] glass-panel p-6 shadow-neon text-center border-nova-red/40 bg-void/90">
            <h3 className="font-kid text-lg font-bold text-nova-red uppercase tracking-wide">
              Expel Astronaut?
            </h3>
            <p className="mt-3 text-sm text-starlight/80 font-body">
              This action is permanent and will delete all their missions, logs, and progress. Are
              you absolutely sure?
            </p>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setDeletingKidId(null)}
                className="flex-1 rounded-xl bg-void border border-starlight/20 py-3 font-bold text-starlight hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteKid(deletingKidId)}
                className="flex-1 rounded-xl bg-nova-red py-3 font-bold text-white shadow-[0_0_15px_var(--nova-red)]"
              >
                Yes, Expel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recruit Modal ── */}
      {showRecruit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2.5rem] glass-panel border border-neon-mint/30 bg-void/95 p-6 shadow-neon">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl text-starlight flex items-center gap-2">
                <RocketLaunch weight="duotone" className="w-6 h-6 text-neon-mint" />
                Recruit Astronaut
              </h2>
              <button
                onClick={closeRecruit}
                className="rounded-full bg-white/10 p-1.5 text-starlight/60 hover:text-starlight hover:bg-white/20 transition"
                aria-label="Close"
              >
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>

            {setupCode ? (
              /* ── Success: show login code ── */
              <div className="text-center py-4">
                <div className="font-kid text-[10px] font-bold text-neon-mint uppercase tracking-widest mb-2">
                  6-Digit Login Code
                </div>
                <div className="font-mono text-5xl font-bold tracking-[0.2em] text-starlight drop-shadow-[0_0_10px_var(--neon-mint)] my-4">
                  {setupCode}
                </div>
                <p className="font-body text-xs text-starlight/60 mb-5">
                  Share this code with your child so they can log in.
                </p>
                <button
                  onClick={() => copyCode(setupCode)}
                  className="btn-press w-full rounded-[1.5rem] bg-neon-mint py-3.5 font-kid font-bold text-void shadow-neon flex items-center justify-center gap-2 mb-3"
                >
                  <Copy weight="bold" className="w-4 h-4" /> Copy Code
                </button>
                <button
                  onClick={closeRecruit}
                  className="w-full rounded-[1.5rem] glass-panel border border-starlight/20 py-3 font-kid text-sm font-bold text-starlight hover:bg-white/10 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <div className="space-y-4">
                <div>
                  <label className="font-kid text-[10px] font-bold text-starlight/70 uppercase tracking-wider block mb-1.5">
                    Child's Name
                  </label>
                  <input
                    autoFocus
                    value={newKidName}
                    onChange={(e) => setNewKidName(e.target.value)}
                    placeholder="e.g. Aiman"
                    className="w-full border border-starlight/20 bg-void/80 rounded-2xl px-4 py-3 font-parent text-starlight placeholder:text-starlight/30 focus:border-neon-mint focus:outline-none transition"
                    maxLength={40}
                  />
                  {kids.some(
                    (k) => k.name.trim().toLowerCase() === newKidName.trim().toLowerCase(),
                  ) && newKidName.trim() && (
                    <p className="mt-1 font-body text-xs text-nova-red">
                      A child with this name already exists.
                    </p>
                  )}
                </div>
                <div>
                  <label className="font-kid text-[10px] font-bold text-starlight/70 uppercase tracking-wider block mb-1.5">
                    @Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-starlight/40 font-parent text-sm">
                      @
                    </span>
                    <input
                      value={newKidUsername}
                      onChange={(e) =>
                        setNewKidUsername(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                        )
                      }
                      placeholder="username"
                      className="w-full border border-starlight/20 bg-void/80 rounded-2xl pl-8 pr-4 py-3 font-parent text-starlight placeholder:text-starlight/30 focus:border-neon-mint focus:outline-none transition"
                      maxLength={20}
                    />
                  </div>
                  <p className="mt-1 font-body text-[10px] text-starlight/40">
                    Lowercase letters, numbers and _ only. Must be unique.
                  </p>
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
                  className="btn-press w-full rounded-[1.5rem] bg-neon-mint py-4 font-kid font-bold text-void shadow-neon disabled:opacity-40 transition flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  {generating ? (
                    "Launching…"
                  ) : (
                    <>
                      <RocketLaunch weight="fill" className="w-5 h-5" /> Launch Astronaut
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
