import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/providers/auth";
import { getKidSession, clearKidSession, KidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { sfx, isMuted, toggleMute } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";

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

  // Notifications using Supabase Realtime
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

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", paddingBottom: "5rem" }}>
      <TopBar mode={mode} kidName={kid?.name} unread={unread} />
      <main style={{ marginTop: "1rem" }}>{children}</main>
      <BottomNav mode={mode} unread={unread} />
    </div>
  );
}

function FullPageLoader() {
  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto" }} className="wireframe-col">
      <div className="wireframe-row">
        <Skeleton style={{ width: "48px", height: "48px" }} />
        <div style={{ flex: 1 }} className="wireframe-col">
          <Skeleton style={{ height: "16px", width: "120px" }} />
          <Skeleton style={{ height: "12px", width: "80px" }} />
        </div>
      </div>
      <Skeleton style={{ height: "120px", width: "100%" }} />
      <div className="wireframe-grid-2">
        <Skeleton style={{ height: "80px" }} />
        <Skeleton style={{ height: "80px" }} />
      </div>
      <Skeleton style={{ height: "60px", width: "100%" }} />
    </div>
  );
}


function TopBar({ mode, kidName, unread }: { mode: Mode; kidName?: string; unread: number }) {
  const isKid = mode === "kid";
  const nav = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [muted, setMuted] = useState(isMuted());

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

  return (
    <header className="wireframe-box">
      <div className="wireframe-space-between">
        {/* Left: back button + brand */}
        <div className="wireframe-row">
          {isSubPage && (
            <Link
              to={isKid ? "/kid" : "/parent"}
              aria-label="Go back"
              onClick={() => sfx.tap()}
            >
              [icon: back]
            </Link>
          )}
          <Link
            to="/"
            onClick={() => sfx.tap()}
            className="wireframe-row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span className="wireframe-img-placeholder" style={{ padding: "0.2rem 0.5rem" }}>
              [image placeholder: Penny]
            </span>
            <strong>Centsibility</strong>
          </Link>
        </div>

        {/* Right: controls */}
        <div className="wireframe-row">
          {isKid && kidName && (
            <span>
              <strong>Kid: {kidName}</strong>
            </span>
          )}
          {!isKid && unread > 0 && (
            <Link
              to="/parent/approvals"
              aria-label={`${unread} unread notifications`}
            >
              <strong>[{unread} pending]</strong>
            </Link>
          )}
          <button
            type="button"
            onClick={switchMode}
            aria-label={isKid ? "Switch to parent view" : "Switch to kid view"}
          >
            {isKid ? "[icon: parent] Switch to Parent" : "[icon: kid] Switch to Kid"}
          </button>
          <button
            type="button"
            onClick={() => {
              sfx.tap();
              setMuted(toggleMute());
            }}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? "[icon: sound off]" : "[icon: sound on]"}
          </button>
          <button
            type="button"
            onClick={() => {
              sfx.tap();
              toggle();
            }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "[icon: light]" : "[icon: dark]"}
          </button>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
          >
            [icon: exit] Exit
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
          { to: "/kid", label: "Home", iconLabel: "[icon: home]" },
          { to: "/kid/wallet", label: "Wallet", iconLabel: "[icon: wallet]" },
          { to: "/kid/quiz", label: "Quest", iconLabel: "[icon: quest]" },
          { to: "/kid/rewards", label: "Reward", iconLabel: "[icon: reward]" },
        ]
      : [
          { to: "/parent", label: "Home", iconLabel: "[icon: home]" },
          { to: "/parent/approvals", label: "Approve", iconLabel: "[icon: approve]", badge: unread },
          { to: "/parent/reports", label: "Reports", iconLabel: "[icon: reports]" },
          { to: "/parent/settings", label: "Settings", iconLabel: "[icon: settings]" },
        ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#fff",
        borderTop: "2px solid #333",
        padding: "0.5rem",
        zIndex: 100,
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, 1fr)`,
          gap: "0.5rem",
          maxWidth: "700px",
          margin: "0 auto",
        }}
      >
        {items.map((it) => {
          const active =
            it.to === "/kid" || it.to === "/parent"
              ? pathname === it.to || pathname === it.to + "/"
              : pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              style={{
                textAlign: "center",
                padding: "0.4rem",
                border: active ? "2px solid #000" : "1px solid #ccc",
                textDecoration: "none",
                color: "#000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontWeight: active ? "bold" : "normal",
              }}
            >
              <span>{it.iconLabel}</span>
              <span>{it.label}</span>
              {"badge" in it && Boolean(it.badge) && <span>({it.badge})</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { Card } from "./ui/card";
export { SectionTitle } from "./ui/section-title";
