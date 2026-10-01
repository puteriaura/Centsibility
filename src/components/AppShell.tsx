import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type CSSProperties, ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/providers/auth";
import { getKidSession, clearKidSession, KidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { sfx } from "@/lib/sounds";
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

  // Full-bleed chat (own header + Insights handle)
  const immersiveChat = mode === "kid" && pathname.startsWith("/kid/chat");

  return (
    <div className={`app-shell${immersiveChat ? " app-shell--immersive" : ""}`}>
      {!immersiveChat && <TopBar mode={mode} kidName={kid?.name} unread={unread} />}
      <main className={`app-shell__main${immersiveChat ? " app-shell__main--flush" : ""}`}>
        {children}
      </main>
      {!immersiveChat && <BottomNav mode={mode} unread={unread} />}
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="app-shell app-shell--loading space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Skeleton style={{ width: "48px", height: "48px", borderRadius: "999px" }} />
        <div style={{ flex: 1 }} className="space-y-2">
          <Skeleton style={{ height: "16px", width: "120px" }} />
          <Skeleton style={{ height: "12px", width: "80px" }} />
        </div>
      </div>
      <Skeleton style={{ height: "120px", width: "100%", borderRadius: "16px" }} />
      <div className="grid grid-cols-2 gap-3">
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

function pageTitle(pathname: string, mode: Mode) {
  if (mode === "kid") {
    if (pathname.startsWith("/kid/insights")) return "Insights";
    if (pathname.startsWith("/kid/chat")) return "Penny";
    if (pathname.startsWith("/kid/wallet")) return "Deposit";
    if (pathname.startsWith("/kid/transfer")) return "Transfer";
    if (pathname.startsWith("/kid/missions")) return "Missions";
    if (pathname.startsWith("/kid/quest")) return "Quest";
    if (pathname.startsWith("/kid/loans")) return "Loans";
    if (pathname.startsWith("/kid/card")) return "Debit Card-i";
    if (pathname.startsWith("/kid/notifications")) return "Notifications";
    if (pathname.startsWith("/kid/history")) return "Transaction history";
    if (pathname.startsWith("/kid/goals")) return "Tabung";
    if (pathname.startsWith("/kid/rewards")) return "Rewards";
    if (pathname.startsWith("/kid/sadaqah")) return "Sadaqah";
    if (pathname.startsWith("/kid/zakat")) return "Zakat";
    if (pathname.startsWith("/kid/quiz")) return "Quest";
    if (pathname.startsWith("/kid/invest")) return "Growth Tabung";
    return "Home";
  }
  if (pathname.startsWith("/parent/transfer")) return "Transfer";
  if (pathname.startsWith("/parent/penny")) return "Penny";
  if (pathname.startsWith("/parent/insights")) return "Insights";
  if (pathname.startsWith("/parent/reports")) return "Reports";
  if (pathname.startsWith("/parent/approvals")) return "Notifications";
  if (pathname.startsWith("/parent/settings")) return "Settings";
  return "Home";
}

function TopBar({ mode, kidName, unread }: { mode: Mode; kidName?: string; unread: number }) {
  const isKid = mode === "kid";
  const nav = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isHome = isKid
    ? currentPath === "/kid" || currentPath === "/kid/"
    : currentPath === "/parent" || currentPath === "/parent/";
  const title = pageTitle(currentPath, mode);

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

  // Kid home: avatar, the Penny assistant pill, then account actions.
  if (isKid && isHome) {
    return (
      <header className="shell-topbar shell-topbar--home">
        <div className="shell-topbar__left">
          <Link to="/kid" onClick={() => sfx.tap()} className="shell-brand" aria-label="Centsibility home">
            <span className="shell-brand__mark" aria-hidden>
              {(kidName ?? "C").charAt(0).toUpperCase()}
            </span>
          </Link>
          <h1 className="sr-only">{title}</h1>
        </div>
        <div className="shell-topbar__center">
          <Link to="/kid/insights" className="shell-mascot-pill" onClick={() => sfx.pop()}>
            <AppIcon name="sparkles" size={16} color="var(--primary)" />
            Penny
          </Link>
        </div>
        <div className="shell-topbar__right">
          <IconBtn label="Switch to parent view" onClick={switchMode}>
            <AppIcon name="parent" size={20} />
          </IconBtn>
          <IconBtn label="Sign out" onClick={logout}>
            <AppIcon name="exit" size={20} />
          </IconBtn>
        </div>
      </header>
    );
  }

  // Detail screens keep only back and a title; account actions live on home.
  return (
    <header className="shell-topbar">
      <div className="shell-topbar__left">
        {!isHome ? (
          <Link
            to={isKid ? "/kid" : "/parent"}
            aria-label="Go back"
            className="shell-icon-btn"
            onClick={() => sfx.tap()}
          >
            <AppIcon name="back" size={20} />
          </Link>
        ) : (
          <Link
            to="/parent"
            onClick={() => sfx.tap()}
            className="shell-brand"
            aria-label="Centsibility home"
          >
            <span className="shell-brand__mark" aria-hidden>
              <AppIcon name="penny" size={16} color="#fff" />
            </span>
          </Link>
        )}
        <h1 className="shell-topbar__title">{title}</h1>
      </div>

      {!isKid ? (
        <div className="shell-topbar__right">
          {unread > 0 ? (
            <Link
              to="/parent/approvals"
              className="shell-chip shell-chip--alert"
              aria-label={`${unread} unread notifications`}
            >
              <AppIcon name="bell" size={14} />
              {unread}
            </Link>
          ) : null}
          <IconBtn label="Switch to kid view" onClick={switchMode}>
            <AppIcon name="kid" size={20} />
          </IconBtn>
        </div>
      ) : null}
    </header>
  );
}

function BottomNav({ mode, unread }: { mode: Mode; unread: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items =
    mode === "kid"
      ? [
          { to: "/kid", label: "Home", icon: "home" },
          { to: "/kid/wallet", label: "Deposit", icon: "wallet" },
          // The dock's single wide pill: saving is the app's core daily action.
          { to: "/kid/goals", label: "Tabung", icon: "save", center: true },
          { to: "/kid/loans", label: "Loans", icon: "loan" },
          { to: "/kid/card", label: "Card", icon: "card" },
        ]
      : [
          { to: "/parent", label: "Home", icon: "home" },
          { to: "/parent/approvals", label: "Approve", icon: "approve", badge: unread },
          {
            to: "/parent/insights",
            label: "Insights",
            icon: "reports",
            match: ["/parent/insights", "/parent/reports"],
          },
          { to: "/parent/settings", label: "Settings", icon: "settings" },
        ];

  return (
    <nav className="shell-bottomnav" aria-label="Main navigation">
      <div
        className="shell-bottomnav__inner"
        style={{ "--nav-cols": items.length } as CSSProperties}
      >
        {items.map((it) => {
          const badge = "badge" in it ? it.badge : 0;
          const center = "center" in it && it.center;
          const matchPaths = "match" in it && Array.isArray(it.match) ? it.match : null;
          const active = matchPaths
            ? matchPaths.some((p) => pathname.startsWith(p))
            : it.to === "/kid" || it.to === "/parent"
              ? pathname === it.to || pathname === it.to + "/"
              : pathname.startsWith(it.to);
          const classes = [
            "shell-navitem",
            active ? "shell-navitem--active" : "",
            center ? "shell-navitem--center" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Link
              key={it.label}
              to={it.to}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={classes}
              onClick={() => sfx.tap()}
            >
              {center ? (
                <span className="shell-navitem__center-pill">
                  <AppIcon name={it.icon} size={22} color="#fff" />
                  <span className="shell-navitem__label">{it.label}</span>
                </span>
              ) : (
                <>
                  <span className="shell-navitem__icon-wrap">
                    <AppIcon name={it.icon} size={22} strokeWidth={active ? 2.5 : 2} />
                    {Boolean(badge) && (
                      <span className="shell-navitem__badge" aria-hidden>
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="shell-navitem__label">{it.label}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { Card } from "./ui/card";
export { SectionTitle } from "./ui/section-title";
