import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import penny from "@/assets/penny-mascot.png";
import { useAuth } from "@/providers/auth";
import { getKidSession, clearKidSession, KidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { sfx, isMuted, toggleMute } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import {
  House,
  Wallet,
  GameController,
  Gift,
  CheckCircle,
  ChartBar,
  Gear,
  Moon,
  Sun,
  SpeakerHigh,
  SpeakerSlash,
  Users,
  UserCircle,
  X,
  CaretLeft,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
type Mode = "kid" | "parent";

export function AppShell({ mode, children }: { mode: Mode; children: ReactNode }) {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [kid, setKid] = useState<KidSession | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  // Re-check kid session on every route change (auth guard)
  useEffect(() => {
    if (mode === "kid") setKid(getKidSession());
  }, [mode, pathname]);

  useEffect(() => {
    if (mode === "parent" && !loading && !session) nav({ to: "/login" });
    if (mode === "kid" && kid === null) nav({ to: "/kid-login" });
  }, [mode, loading, session, kid, nav]);

  // Notifications using Supabase Realtime (Imp #2)
  useEffect(() => {
    if (mode !== "parent" || !session) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false);
      setUnread(count ?? 0);
    };
    fetchCount();

    const channel = supabase
      .channel("notifications_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () =>
        fetchCount(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, session]);

  if (mode === "parent" && (loading || !session)) return <FullPageLoader />;
  if (mode === "kid" && kid === undefined) return <FullPageLoader />;
  if (mode === "kid" && !kid) return <FullPageLoader />;

  const isKid = mode === "kid";
  return (
    <div className="relative min-h-[100dvh] bg-gradient-hero pb-24 overflow-hidden">
      {/* Starry background elements */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-40">
        <div className="absolute top-10 left-10 h-1 w-1 bg-white rounded-full animate-stars [animation-delay:0.5s]" />
        <div className="absolute top-40 right-20 h-1.5 w-1.5 bg-starlight rounded-full animate-stars [animation-delay:1.2s]" />
        <div className="absolute bottom-20 left-1/4 h-2 w-2 bg-neon-mint rounded-full animate-stars blur-[1px] [animation-delay:2s]" />
        <div className="absolute top-1/2 right-1/3 h-1 w-1 bg-white rounded-full animate-stars [animation-delay:0.1s]" />
      </div>
      <TopBar mode={mode} kidName={kid?.name} unread={unread} />
      <main className="relative z-10 mx-auto max-w-md px-4 py-4 pt-24">{children}</main>
      <BottomNav mode={mode} unread={unread} />
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto max-w-md px-4 pt-24 pb-10 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
        </div>
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
    </div>
  );
}

export function CardSkeleton({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-24 w-full rounded-3xl ${className}`} />;
}

function TopBar({ mode, kidName, unread }: { mode: Mode; kidName?: string; unread: number }) {
  const isKid = mode === "kid";
  const nav = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [muted, setMuted] = useState(isMuted());

  // Show back button on sub-pages (not the home route) — addresses UX #8
  const isSubPage = isKid
    ? currentPath !== "/kid" && currentPath !== "/kid/"
    : currentPath !== "/parent" && currentPath !== "/parent/";

  const switchMode = async () => {
    sfx.swoosh();
    if (isKid) {
      clearKidSession();
      nav({ to: "/login" });
    } else {
      nav({ to: "/kid-login" });
    }
  };

  const logout = async () => {
    sfx.tap();
    if (isKid) {
      clearKidSession();
      nav({ to: "/kid-login" });
    } else {
      await supabase.auth.signOut();
      nav({ to: "/login" });
    }
  };

  const headerBg = "glass-panel";

  return (
    <header className={`fixed top-0 inset-x-0 z-40 ${headerBg}`}>
      <div className="mx-auto max-w-md px-3 py-3 flex items-center justify-between gap-2">
        {/* Left: optional back button + logo */}
        <div className="flex items-center gap-1 min-w-0">
          {isSubPage && (
            <Link
              to={isKid ? "/kid" : "/parent"}
              aria-label="Go back"
              onClick={() => sfx.tap()}
              className="btn-press rounded-full border border-border bg-card p-1.5 text-charcoal hover:border-emerald-halal shrink-0"
            >
              <CaretLeft weight="bold" className="w-4 h-4" />
            </Link>
          )}
          <Link
            to="/"
            onClick={() => sfx.tap()}
            className="btn-press flex items-center gap-2 min-w-0"
          >
            <img
              src={penny}
              alt="Penny mascot"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 drop-shadow animate-float"
            />
            <span className="font-display text-base text-starlight truncate tracking-tight">
              Centsibility
            </span>
          </Link>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isKid && kidName && (
            <span className="hidden sm:inline rounded-full bg-card border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] px-3 py-1 font-kid text-[11px] font-bold text-charcoal">
              {kidName}
            </span>
          )}
          {!isKid && unread > 0 && (
            <Link
              to="/parent/approvals"
              aria-label={`${unread} unread notifications`}
              className="relative rounded-full border border-coral bg-coral/10 px-2 py-1 font-kid text-[11px] font-bold text-coral animate-pulse"
            >
              {unread}
            </Link>
          )}
          <button
            onClick={switchMode}
            aria-label={isKid ? "Switch to parent view" : "Switch to kid view"}
            className="btn-press flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 font-kid text-[11px] font-bold text-charcoal hover:border-emerald-halal transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            {isKid ? (
              <Users weight="duotone" className="w-4 h-4 text-emerald-halal" />
            ) : (
              <UserCircle weight="duotone" className="w-4 h-4 text-bubblegum" />
            )}
            <span className="hidden sm:inline">{isKid ? "Parent" : "Kid"}</span>
          </button>
          <button
            onClick={() => {
              sfx.tap();
              setMuted(toggleMute());
            }}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            className="btn-press rounded-full border border-border bg-card p-1.5 text-charcoal hover:border-emerald-halal transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            {muted ? (
              <SpeakerSlash weight="duotone" className="w-4 h-4" />
            ) : (
              <SpeakerHigh weight="duotone" className="w-4 h-4 text-emerald-halal" />
            )}
          </button>
          <button
            onClick={() => {
              sfx.tap();
              toggle();
            }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="btn-press rounded-full border border-border bg-card p-1.5 text-charcoal hover:border-emerald-halal transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            {theme === "dark" ? (
              <Sun weight="duotone" className="w-4 h-4 text-sunny" />
            ) : (
              <Moon weight="duotone" className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="btn-press flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 font-kid text-[11px] font-bold text-slate-parent hover:border-coral hover:text-coral transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            <X weight="bold" className="w-4 h-4 sm:hidden" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ mode, unread }: { mode: Mode; unread: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items =
    mode === "kid"
      ? [
          { to: "/kid", label: "Home", icon: House },
          { to: "/kid/wallet", label: "Wallet", icon: Wallet },
          { to: "/kid/quiz", label: "Quest", icon: GameController },
          { to: "/kid/rewards", label: "Reward", icon: Gift },
        ]
      : [
          { to: "/parent", label: "Home", icon: House },
          { to: "/parent/approvals", label: "Approve", icon: CheckCircle, badge: unread },
          { to: "/parent/reports", label: "Reports", icon: ChartBar },
          { to: "/parent/settings", label: "Settings", icon: Gear },
        ];

  return (
    <nav
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(92%,420px)] rounded-[2.5rem] glass-panel p-1"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-4 gap-1">
        {items.map((it) => {
          const active =
            it.to === "/kid" || it.to === "/parent"
              ? pathname === it.to || pathname === it.to + "/"
              : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-3xl transition-colors duration-200 ${active ? "text-emerald-halal" : "text-pewter hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {active && (
                <motion.div
                  layoutId="bottom-nav-active-bg"
                  className="absolute inset-0 bg-neon-mint/20 rounded-3xl -z-10 shadow-neon"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                animate={{ scale: active ? 1.15 : 1, y: active ? -2 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Icon weight={active ? "fill" : "duotone"} className="w-[1.35rem] h-[1.35rem]" />
              </motion.div>
              <span className="font-kid text-[9px] font-bold uppercase tracking-widest">
                {it.label}
              </span>
              {"badge" in it && it.badge ? (
                <span
                  className="absolute top-1 right-2 grid h-4 w-4 place-items-center rounded-full bg-coral text-[9px] font-bold text-white shadow-sm"
                  aria-label={`${it.badge} pending`}
                >
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[2.5rem] glass-panel p-6 relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 border border-starlight/20 rounded-[2.5rem] pointer-events-none"
        style={{ mixBlendMode: "overlay" }}
      ></div>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-6 mb-3 flex items-end justify-between ${className}`}>
      <h2 className="font-kid text-lg font-bold text-starlight">{children}</h2>
      {action}
    </div>
  );
}
