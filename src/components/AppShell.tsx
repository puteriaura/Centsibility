import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
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

  // Full-bleed chat like AEON Neko Sensei (own header + Insights handle)
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

function pageTitle(pathname: string, mode: Mode, kidName?: string) {
  if (mode === "kid") {
    if (pathname.startsWith("/kid/insights")) return "Insights";
    if (pathname.startsWith("/kid/chat")) return "Penny Sensei";
    if (pathname.startsWith("/kid/wallet")) return "Deposit";
    if (pathname.startsWith("/kid/loans")) return "Financing";
    if (pathname.startsWith("/kid/card")) return "Card";
    if (pathname.startsWith("/kid/goals")) return "Goals";
    if (pathname.startsWith("/kid/rewards")) return "Rewards";
    if (pathname.startsWith("/kid/sadaqah")) return "Sadaqah";
    if (pathname.startsWith("/kid/zakat")) return "Zakat";
    if (pathname.startsWith("/kid/quiz")) return "Quest";
    if (pathname.startsWith("/kid/invest")) return "Invest";
    return kidName ? `Hi, ${kidName}` : "Home";
  }
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
  const title = pageTitle(currentPath, mode, kidName);

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
            to={isKid ? "/kid" : "/parent"}
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

      <div className="shell-topbar__right">
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
        {isKid ? (
          <IconBtn
            label="Open Penny Sensei"
            onClick={() => {
              sfx.pop();
              nav({ to: "/kid/chat" });
            }}
          >
            <AppIcon name="penny" size={18} />
          </IconBtn>
        ) : null}
        <IconBtn
          label={isKid ? "Switch to parent view" : "Switch to kid view"}
          onClick={switchMode}
        >
          <AppIcon name={isKid ? "parent" : "kid"} size={18} />
        </IconBtn>
        {isKid ? (
          <IconBtn label="Sign out" onClick={logout}>
            <AppIcon name="exit" size={18} />
          </IconBtn>
        ) : null}
      </div>
    </header>
  );
}

function BottomNav({ mode, unread }: { mode: Mode; unread: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items =
    mode === "kid"
      ? [
          { to: "/kid/insights", label: "Penny", icon: "penny", match: ["/kid/insights", "/kid/chat"] },
          { to: "/kid/wallet", label: "Deposit", icon: "wallet" },
          { to: "/kid/loans", label: "Financing", icon: "loan" },
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
      <div className="shell-bottomnav__inner">
        {items.map((it) => {
          const badge = "badge" in it ? it.badge : 0;
          const matchPaths = "match" in it && Array.isArray(it.match) ? it.match : null;
          const active = matchPaths
            ? matchPaths.some((p) => pathname.startsWith(p))
            : it.to === "/kid" || it.to === "/parent"
              ? pathname === it.to || pathname === it.to + "/"
              : pathname.startsWith(it.to);

          return (
            <Link
              key={it.label}
              to={it.to}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
              className={`shell-navitem ${active ? "shell-navitem--active" : ""}`.trim()}
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
