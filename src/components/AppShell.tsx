import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/providers/auth";
import { getKidSession, clearKidSession, KidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/lib/theme";
import { sfx, isMuted, toggleMute } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/ui/app-icon";
import { setParentBypassed, setKidBypassed } from "@/lib/admin-bypass";

type Mode = "kid" | "parent";

export function AppShell({ mode, children }: { mode: Mode; children: ReactNode }) {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [kid, setKid] = useState<KidSession | null | undefined>(undefined);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (mode === "kid") setKid(getKidSession());
  }, [mode, pathname]);

  useEffect(() => {
    if (mode === "parent" && !loading && !session) nav({ to: "/login" });
    if (mode === "kid" && kid === null) nav({ to: "/kid-login" });
  }, [mode, loading, session, kid, nav]);

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
    <div className="app-shell">
      <TopBar mode={mode} kidName={kid?.name} unread={unread} />
      <main className="app-shell__main">{children}</main>
      <BottomNav mode={mode} unread={unread} />
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="app-shell app-shell--loading wireframe-col">
      <div className="wireframe-row">
        <Skeleton style={{ width: "48px", height: "48px", borderRadius: "999px" }} />
        <div style={{ flex: 1 }} className="wireframe-col">
          <Skeleton style={{ height: "16px", width: "120px" }} />
          <Skeleton style={{ height: "12px", width: "80px" }} />
        </div>
      </div>
      <Skeleton style={{ height: "120px", width: "100%", borderRadius: "16px" }} />
      <div className="wireframe-grid-2">
        <Skeleton style={{ height: "80px", borderRadius: "16px" }} />
        <Skeleton style={{ height: "80px", borderRadius: "16px" }} />
      </div>
      <Skeleton style={{ height: "60px", width: "100%", borderRadius: "12px" }} />
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="shell-icon-btn" onClick={onClick} aria-label={label}>
      {children}
    </button>
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
      setKidBypassed(false);
      nav({ to: "/login" });
    } else {
      setParentBypassed(false);
      nav({ to: "/kid-login" });
    }
  };

  const logout = async () => {
    sfx.tap();
    if (isKid) {
      clearKidSession();
      setKidBypassed(false);
      nav({ to: "/kid-login" });
    } else {
      setParentBypassed(false);
      await supabase.auth.signOut();
      nav({ to: "/login" });
    }
  };

  return (
    <header className="shell-topbar">
      <div className="shell-topbar__left">
        {isSubPage && (
          <Link
            to={isKid ? "/kid" : "/parent"}
            aria-label="Go back"
            className="shell-icon-btn"
            onClick={() => sfx.tap()}
          >
            <AppIcon name="back" size={20} />
          </Link>
        )}
        <Link to="/" onClick={() => sfx.tap()} className="shell-brand">
          <span className="shell-brand__mark" aria-hidden>
            <AppIcon name="penny" size={18} color="#fff" />
          </span>
          <strong className="shell-brand__name">Centsibility</strong>
        </Link>
      </div>

      <div className="shell-topbar__right">
        {isKid && kidName ? (
          <span className="shell-chip">{kidName}</span>
        ) : null}
        {!isKid && unread > 0 ? (
          <Link
            to="/parent/approvals"
            className="shell-chip shell-chip--alert"
            aria-label={`${unread} unread notifications`}
          >
            <AppIcon name="bell" size={14} />
            {unread}
          </Link>
        ) : null}
        <IconBtn
          label={isKid ? "Switch to parent view" : "Switch to kid view"}
          onClick={switchMode}
        >
          <AppIcon name={isKid ? "parent" : "kid"} size={18} />
        </IconBtn>
        <IconBtn
          label={muted ? "Unmute sounds" : "Mute sounds"}
          onClick={() => {
            sfx.tap();
            setMuted(toggleMute());
          }}
        >
          <AppIcon name={muted ? "soundoff" : "soundon"} size={18} />
        </IconBtn>
        <IconBtn
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => {
            sfx.tap();
            toggle();
          }}
        >
          <AppIcon name={theme === "dark" ? "light" : "dark"} size={18} />
        </IconBtn>
        <IconBtn label="Sign out" onClick={logout}>
          <AppIcon name="exit" size={18} />
        </IconBtn>
      </div>
    </header>
  );
}

function BottomNav({ mode, unread }: { mode: Mode; unread: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items =
    mode === "kid"
      ? [
          { to: "/kid", label: "Home", icon: "home" },
          { to: "/kid/wallet", label: "Wallet", icon: "wallet" },
          { to: "/kid/quiz", label: "Quest", icon: "quest" },
          { to: "/kid/rewards", label: "Reward", icon: "reward" },
        ]
      : [
          { to: "/parent", label: "Home", icon: "home" },
          { to: "/parent/approvals", label: "Approve", icon: "approve", badge: unread },
          { to: "/parent/reports", label: "Reports", icon: "reports" },
          { to: "/parent/settings", label: "Settings", icon: "settings" },
        ];

  return (
    <nav className="shell-bottomnav" aria-label="Main navigation">
      <div className="shell-bottomnav__inner">
        {items.map((it) => {
          const active =
            it.to === "/kid" || it.to === "/parent"
              ? pathname === it.to || pathname === it.to + "/"
              : pathname.startsWith(it.to);
          const badge = "badge" in it ? it.badge : 0;
          return (
            <Link
              key={it.to}
              to={it.to}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={active ? "shell-navitem shell-navitem--active" : "shell-navitem"}
              onClick={() => sfx.tap()}
            >
              <span className="shell-navitem__icon-wrap">
                <AppIcon name={it.icon} size={22} strokeWidth={active ? 2.5 : 2} />
                {Boolean(badge) && (
                  <span className="shell-navitem__badge" aria-hidden>
                    {badge}
                  </span>
                )}
              </span>
              <span className="shell-navitem__label">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { Card } from "./ui/card";
export { SectionTitle } from "./ui/section-title";
