import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  type CSSProperties,
  ReactNode,
  useEffect,
  useState,
  useRef,
} from "react";
import { useAuth } from "@/providers/auth";
import { getKidSession, clearKidSession, KidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { sfx } from "@/lib/sounds";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarBubble } from "@/components/AvatarBubble";
import { setParentBypassed, setKidBypassed } from "@/lib/admin-bypass";
import { edgeKidGetState } from "@/lib/edge";
import { usePenny } from "@/features/penny";
type Mode = "kid" | "parent";

export function AppShell({
  mode,
  children,
}: {
  mode: Mode;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [kid, setKid] = useState<KidSession | null | undefined>(undefined);
  const [kidAvatar, setKidAvatar] = useState<string | undefined>(undefined);
  const [parentAvatar, setParentAvatar] = useState<string | undefined>(
    undefined,
  );
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (mode === "kid") setKid(getKidSession());
  }, [mode, pathname]);

  useEffect(() => {
    if (mode === "parent" && !loading && !session) nav({ to: "/login" });
    if (mode === "kid" && kid === null) nav({ to: "/kid-login" });
  }, [mode, loading, session, kid, nav]);

  useEffect(() => {
    if (mode === "parent") {
      const meta = session?.user?.user_metadata as
        | { avatar?: string }
        | undefined;
      setParentAvatar(meta?.avatar || "phosphor:User");
    } else {
      const handleAvatar = (e: Event) => {
        const custom = e as CustomEvent<{ avatar?: string }>;
        if (custom.detail?.avatar) setKidAvatar(custom.detail.avatar);
      };
      window.addEventListener("centsibility:kid-avatar", handleAvatar);
      return () =>
        window.removeEventListener("centsibility:kid-avatar", handleAvatar);
    }
  }, [mode, session]);

  useEffect(() => {
    if (mode === "parent" && session) {
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
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications" },
          () => fetchCount(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (mode === "kid") {
      const handleUnread = (e: Event) => {
        const custom = e as CustomEvent<{ unread?: number }>;
        if (typeof custom.detail?.unread === "number")
          setUnread(custom.detail.unread);
      };
      window.addEventListener("centsibility:kid-unread", handleUnread);
      return () =>
        window.removeEventListener("centsibility:kid-unread", handleUnread);
    }
  }, [mode, session]);

  if (mode === "parent" && (loading || !session)) return <FullPageLoader />;
  if (mode === "kid" && kid === undefined) return <FullPageLoader />;
  if (mode === "kid" && !kid) return <FullPageLoader />;

  // Full-bleed chat (own header + Insights handle)
  const immersiveChat = mode === "kid" && pathname.startsWith("/kid/chat");

  return (
    <div className={`app-shell${immersiveChat ? " app-shell--immersive" : ""}`}>
      {!immersiveChat && (
        <TopBar
          mode={mode}
          kidName={kid?.name}
          kidAvatar={kidAvatar}
          parentAvatar={parentAvatar}
          unread={unread}
        />
      )}
      <main
        className={`app-shell__main${immersiveChat ? " app-shell__main--flush" : ""}`}
      >
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
        <Skeleton
          style={{ width: "48px", height: "48px", borderRadius: "999px" }}
        />
        <div style={{ flex: 1 }} className="space-y-2">
          <Skeleton style={{ height: "16px", width: "120px" }} />
          <Skeleton style={{ height: "12px", width: "80px" }} />
        </div>
      </div>
      <Skeleton
        style={{ height: "120px", width: "100%", borderRadius: "16px" }}
      />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton style={{ height: "80px", borderRadius: "16px" }} />
        <Skeleton style={{ height: "80px", borderRadius: "16px" }} />
      </div>
      <Skeleton
        style={{ height: "60px", width: "100%", borderRadius: "12px" }}
      />
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
    <button
      type="button"
      className="shell-icon-btn"
      onClick={onClick}
      aria-label={label}
    >
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

function TopBar({
  mode,
  kidName,
  kidAvatar,
  parentAvatar,
  unread,
}: {
  mode: Mode;
  kidName?: string;
  kidAvatar?: string;
  parentAvatar?: string;
  unread: number;
}) {
  const isKid = mode === "kid";
  const nav = useNavigate();
  const { openPenny } = usePenny();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isHome = isKid
    ? currentPath === "/kid" || currentPath === "/kid/"
    : currentPath === "/parent" || currentPath === "/parent/";
  const title = pageTitle(currentPath, mode);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

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

  const onAvatarClick = () => {
    sfx.tap();
    if (isKid) {
      window.dispatchEvent(new CustomEvent("centsibility:open-profile"));
    } else {
      nav({ to: "/parent/settings" });
    }
  };

  if (isHome) {
    return (
      <header className="shell-topbar shell-topbar--home">
        {/* Left: Avatar */}
        <div className="shell-topbar__left">
          <button
            type="button"
            onClick={onAvatarClick}
            aria-label={isKid ? "Open profile settings" : "Open settings"}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-0.5 rounded-full hover:opacity-85 transition-opacity"
          >
            {isKid ? (
              <AvatarBubble
                emoji={
                  kidAvatar ||
                  (kidName
                    ? (kidName[0] || "C").toUpperCase()
                    : "phosphor:Smiley")
                }
                size={38}
                ring
                kind="kid"
              />
            ) : (
              <AvatarBubble
                emoji={parentAvatar || "phosphor:User"}
                size={38}
                ring
                kind="parent"
              />
            )}
          </button>
          <h1 className="sr-only">{title}</h1>
        </div>

        {/* Centre: Penny */}
        <div className="shell-topbar__center">
          <button
            type="button"
            className="shell-mascot-pill min-h-[44px] min-w-[44px] px-3.5 py-2 inline-flex items-center gap-1.5 rounded-full font-bold text-xs bg-white text-[var(--ink)] border border-[var(--border)] shadow-2xs hover:bg-[var(--surface-soft)] transition-colors cursor-pointer"
            onClick={() => {
              sfx.pop();
              openPenny({ context: { page: title } });
            }}
            aria-label="Penny chat"
          >
            <AppIcon name="penny" size={18} color="var(--primary)" />
            Penny
          </button>
        </div>

        {/* Right: Bell with unread badge + Settings button */}
        <div className="shell-topbar__right relative">
          <Link
            to={isKid ? "/kid/notifications" : "/parent/approvals"}
            className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--surface-soft)] transition-colors"
            aria-label={`${isKid ? "Notifications" : "Approvals"}${unread > 0 ? `, ${unread} unread` : ""}`}
            onClick={() => sfx.tap()}
          >
            <AppIcon name="bell" size={20} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--primary)] text-white text-[10px] font-extrabold flex items-center justify-center leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account actions"
            className="shell-icon-btn min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <AppIcon name="settings" size={20} />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="Account actions"
              className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-[var(--border)] p-1.5 z-50 animate-in fade-in"
            >
              {isKid ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-soft)] rounded-xl min-h-[44px] text-left transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      switchMode();
                    }}
                  >
                    <AppIcon name="parent" size={18} />
                    Switch to parent view
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-[var(--error-text)] hover:bg-[var(--surface-soft)] rounded-xl min-h-[44px] text-left transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    <AppIcon name="exit" size={18} />
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/parent/settings"
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-soft)] rounded-xl min-h-[44px] text-left transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <AppIcon name="settings" size={18} />
                    Settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-soft)] rounded-xl min-h-[44px] text-left transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      switchMode();
                    }}
                  >
                    <AppIcon name="kid" size={18} />
                    Switch to kid view
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-[var(--error-text)] hover:bg-[var(--surface-soft)] rounded-xl min-h-[44px] text-left transition-colors"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    <AppIcon name="exit" size={18} />
                    Sign out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>
    );
  }

  // Detail screen: Back + Title + small Penny icon on right
  return (
    <header className="shell-topbar">
      <div className="shell-topbar__left">
        <Link
          to={isKid ? "/kid" : "/parent"}
          aria-label="Go back"
          className="shell-icon-btn min-w-[44px] min-h-[44px] flex items-center justify-center"
          onClick={() => sfx.tap()}
        >
          <AppIcon name="back" size={20} />
        </Link>
        <h1 className="shell-topbar__title">{title}</h1>
      </div>

      <div className="shell-topbar__right">
        <button
          type="button"
          className="shell-icon-btn min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          aria-label="Ask Penny"
          onClick={() => {
            sfx.pop();
            openPenny({ context: { page: title } });
          }}
        >
          <AppIcon name="penny" size={20} color="var(--primary)" />
        </button>
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
          { to: "/kid/wallet", label: "Deposit", icon: "wallet" },
          // The dock's single wide pill: saving is the app's core daily action.
          { to: "/kid/goals", label: "Tabung", icon: "save", center: true },
          { to: "/kid/loans", label: "Loans", icon: "loan" },
          { to: "/kid/card", label: "Card", icon: "card" },
        ]
      : [
          { to: "/parent", label: "Home", icon: "home" },
          {
            to: "/parent/approvals",
            label: "Approve",
            icon: "approve",
            badge: unread,
          },
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
          const matchPaths =
            "match" in it && Array.isArray(it.match) ? it.match : null;
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
                    <AppIcon
                      name={it.icon}
                      size={22}
                      strokeWidth={active ? 2.5 : 2}
                    />
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
