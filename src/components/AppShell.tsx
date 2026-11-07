import { edgeKidLogout } from "@/lib/edge";
import { toast } from "sonner";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  type CSSProperties,
  ReactNode,
  useEffect,
  useState,
  useRef,
} from "react";
import { useAuth } from "@/providers/auth";
import { parentDisplayName } from "@/lib/display-name";
import { getKidSession, clearKidSession, KidSession } from "@/lib/kid-session";
import { supabase } from "@/integrations/supabase/client";
import { sfx } from "@/lib/sounds";
import { SlidingPill } from "@/components/ui/sliding-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/ui/app-icon";
import { AvatarBubble } from "@/components/AvatarBubble";
import {
  isParentBypassed,
  setParentBypassed,
  setKidBypassed,
} from "@/lib/admin-bypass";
import { AppearanceDialog } from "@/components/AppearanceSettings";
import { PracticeCardHeader } from "@/features/kid/PracticeCard";
import { usePenny } from "@/features/penny";
import {
  NAV,
  pageTitle,
  screenKind,
  trimSlash,
  upTarget,
  type Mode,
} from "@/lib/navigation";

export async function signOutKid() {
  const session = getKidSession();
  try {
    if (session) await edgeKidLogout({ code: session.code });
  } catch {
    /* Local sign-out must still work when offline. */
  } finally {
    clearKidSession();
    setKidBypassed(false);
  }
}

export function AppShell({
  mode,
  children,
}: {
  mode: Mode;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.matches[s.matches.length - 1]?.pathname ?? s.location.pathname });
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
    if (mode !== "kid") return;
    const signedOut = () => {
      setKid(null);
      toast.error("You were signed out. Please sign in again.", {
        id: "kid-signed-out",
      });
      nav({ to: "/kid-login" });
    };
    window.addEventListener("centsibility:kid-signed-out", signedOut);
    return () =>
      window.removeEventListener("centsibility:kid-signed-out", signedOut);
  }, [mode, nav]);

  useEffect(() => {
    if (mode === "parent" && !loading && !session) nav({ to: "/login" });
    if (mode === "kid" && kid === null) nav({ to: "/kid-login" });
  }, [mode, loading, session, kid, nav]);

  useEffect(() => {
    if (mode === "parent") {
      const meta = session?.user?.user_metadata as
        { avatar?: string } | undefined;
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
    if (mode === "parent" && session && !isParentBypassed()) {
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

  // Full-page chat draws its own header and has no dock
  const immersive =
    pathname.startsWith("/kid/chat") || pathname.startsWith("/parent/penny");
  const kind = screenKind(pathname, mode);
  const showDock = !immersive && kind !== "detail";

  const shellClass = [
    "app-shell",
    immersive ? "app-shell--immersive" : "",
    !showDock && !immersive ? "app-shell--no-dock" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClass}>
      {!immersive && (
        <TopBar
          mode={mode}
          kind={kind}
        />
      )}
      <main
        key={pathname}
        className={
          immersive
            ? "app-shell__main app-shell__main--flush"
            : "app-shell__main"
        }
      >
        {children}
      </main>
      <BottomNav mode={mode} unread={unread} hiddenOnPhone={!showDock} />
      <ShellAccount mode={mode} kind={immersive ? "immersive" : kind} kidName={kid?.name} kidAvatar={kidAvatar} parentAvatar={parentAvatar} unread={unread} />
      <AppearanceDialog />
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="app-shell app-shell--loading space-y-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton
          style={{ width: "44px", height: "44px", borderRadius: "999px" }}
        />
        <div style={{ flex: 1 }} className="space-y-2">
          <Skeleton style={{ height: "16px", width: "120px" }} />
          <Skeleton style={{ height: "12px", width: "80px" }} />
        </div>
      </div>
      <Skeleton
        style={{ height: "132px", width: "100%", borderRadius: "20px" }}
      />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} style={{ height: "64px", borderRadius: "16px" }} />
        ))}
      </div>
      <Skeleton
        style={{ height: "160px", width: "100%", borderRadius: "16px" }}
      />
    </div>
  );
}

function PennyButton({ title }: { title: string }) {
  const { openPenny } = usePenny();
  return (
    <button
      type="button"
      className="shell-icon-btn"
      aria-label="Ask Penny"
      onClick={() => {
        sfx.pop();
        openPenny({ context: { page: title } });
      }}
    >
      <AppIcon name="penny" size={22} color="var(--action)" />
    </button>
  );
}

function ShellAccount({ mode, kind, kidName, kidAvatar, parentAvatar, unread }: {
  mode: Mode; kind: string; kidName?: string; kidAvatar?: string; parentAvatar?: string; unread: number;
}) {
  const isKid = mode === "kid";
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      await signOutKid();
      nav({ to: "/login" });
    } else {
      setParentBypassed(false);
      nav({ to: "/kid-login" });
    }
  };

  const logout = async () => {
    sfx.tap();
    if (isKid) {
      await signOutKid();
      nav({ to: "/kid-login" });
    } else {
      setParentBypassed(false);
      await supabase.auth.signOut();
      nav({ to: "/login" });
    }
  };

  const closeThen = (fn: () => void) => () => { setMenuOpen(false); fn(); };
  return <div className={`shell-account ${kind === "home" ? "shell-account--home" : ""}`}>
        {/* Left: avatar opens the account menu (profile, switch view, sign out) */}
        <div className="shell-account__profile relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              sfx.tap();
              setMenuOpen((open) => !open);
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="shell-icon-btn"
          >
            <AvatarBubble
              emoji={
                isKid
                  ? kidAvatar ||
                    (kidName
                      ? (kidName[0] || "C").toUpperCase()
                      : "phosphor:Smiley")
                  : parentAvatar || "phosphor:User"
              }
              size={30}
              kind={isKid ? "kid" : "parent"}
            />
            <span className="shell-account__label">Profile</span>
          </button>

          {menuOpen && (
            <div role="menu" aria-label="Account menu" className="shell-menu">
              {isKid ? (
                <button
                  type="button"
                  role="menuitem"
                  className="shell-menu__item"
                  onClick={closeThen(() =>
                    void nav({ to: "/kid", search: { profile: true } }),
                  )}
                >
                  <AppIcon name="user" size={18} />
                  My profile
                </button>
              ) : (
                <Link
                  to="/parent/settings"
                  role="menuitem"
                  className="shell-menu__item"
                  onClick={() => setMenuOpen(false)}
                >
                  <AppIcon name="settings" size={18} />
                  Settings
                </Link>
              )}
              {isKid && (
                <button
                  type="button"
                  role="menuitem"
                  className="shell-menu__item"
                  onClick={closeThen(() =>
                    window.dispatchEvent(
                      new Event("centsibility:open-appearance"),
                    ),
                  )}
                >
                  <AppIcon name="settings" size={18} />
                  Settings
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="shell-menu__item"
                onClick={closeThen(() => void switchMode())}
              >
                <AppIcon name={isKid ? "parent" : "kid"} size={18} />
                {isKid ? "Switch to parent view" : "Switch to kid view"}
              </button>
              <div className="shell-menu__divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="shell-menu__item shell-menu__item--danger"
                onClick={closeThen(() => void logout())}
              >
                <AppIcon name="exit" size={18} />
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="shell-account__notifications">
          {isKid ? (
            <Link
              to="/kid/notifications"
              className="shell-icon-btn"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
              onClick={() => sfx.tap()}
            >
              <AppIcon name="bell" size={22} />
              <span className="shell-account__label">Notifications</span>
              {unread > 0 && (
                <span className="shell-count" aria-hidden="true">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          ) : (
            <Link
              to="/parent/approvals"
              search={{ tab: "activity" }}
              className="shell-icon-btn"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
              onClick={() => sfx.tap()}
            >
              <AppIcon name="bell" size={22} />
              <span className="shell-account__label">Notifications</span>
              {unread > 0 && (
                <span className="shell-count" aria-hidden="true">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
        </div>
  </div>;
}

function TopBar({
  mode,
  kind,
}: {
  mode: Mode;
  kind: "home" | "root" | "detail";
}) {
  const isKid = mode === "kid";
  const { openPenny } = usePenny();
  const currentPath = useRouterState({ select: (s) => s.matches[s.matches.length - 1]?.pathname ?? s.location.pathname });
  const title = pageTitle(currentPath, mode);

  if (isKid && trimSlash(currentPath) === "/kid/card") {
    return (
      <PracticeCardHeader
        onHelp={() => openPenny({ context: { page: "Card" } })}
      />
    );
  }

  if (kind === "home") {
    return (
      <header className="shell-topbar shell-topbar--home">
        <img src="/icons/centsibility-app.svg" alt="Centsibility" width={36} height={36} className="shell-topbar__logo" />
        <h1 className="shell-home-title">Home</h1>
        <div className="shell-topbar__left" />
        <div className="shell-topbar__right">{isKid && <PennyButton title={title} />}</div>
      </header>
    );
  }

  if (kind === "root") {
    return (
      <header className="shell-topbar shell-topbar--root">
        <div className="shell-topbar__left">
          <h1 className="shell-topbar__title">{title}</h1>
        </div>
        <div className="shell-topbar__right">
          <PennyButton title={title} />
        </div>
      </header>
    );
  }

  // Detail screen: back goes one level up, title, Penny on the right
  return (
    <header className="shell-topbar">
      <div className="shell-topbar__left">
        <Link
          to={upTarget(currentPath, mode)}
          aria-label="Back"
          className="shell-icon-btn"
          onClick={() => sfx.tap()}
        >
          <AppIcon name="back" size={22} />
        </Link>
        <h1 className="shell-topbar__title">{title}</h1>
      </div>
      <div className="shell-topbar__right">
        <PennyButton title={title} />
      </div>
    </header>
  );
}

function BottomNav({ mode, unread, hiddenOnPhone }: { mode: Mode; unread: number; hiddenOnPhone: boolean }) {
  const pathname = useRouterState({ select: (s) => s.matches[s.matches.length - 1]?.pathname ?? s.location.pathname });
  const items = NAV[mode];

  return (
    <nav className={`shell-bottomnav ${hiddenOnPhone ? "shell-bottomnav--phone-hidden" : ""}`} aria-label="Main">
      <img className="shell-nav-logo" src="/icons/centsibility-app.svg" alt="Centsibility" width={40} height={40} />
      <div
        className="shell-bottomnav__inner"
        style={{ "--nav-cols": items.length } as CSSProperties}
      >
        {items.map((it) => {
          const badge = it.badge ? unread : 0;
          const active = it.match
            ? it.match.some((p) => pathname.startsWith(p))
            : it.to === `/${mode}`
              ? trimSlash(pathname) === it.to
              : pathname.startsWith(it.to);
          const classes = [
            "shell-navitem",
            active ? "shell-navitem--active" : "",
            it.center ? "shell-navitem--center" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Link
              key={it.to}
              to={it.to}
              aria-current={active ? "page" : undefined}
              className={classes}
              onClick={() => sfx.tap()}
            >
              {it.center ? (
                <>
                  <span className="shell-navitem__center-pill">
                    <AppIcon name={it.icon} size={24} color="var(--on-sun)" strokeWidth={1.75} />
                  </span>
                  <span className="shell-navitem__label">{it.label}</span>
                </>
              ) : (
                <>
                  <span className="shell-navitem__icon-wrap">
                    {active && <SlidingPill layoutId={`dock-${mode}`} />}
                    <AppIcon name={it.icon} size={24} strokeWidth={1.75} />
                    {badge > 0 && (
                      <span className="shell-navitem__badge" aria-hidden="true">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </span>
                  <span className="shell-navitem__label">
                    {it.label}
                    {badge > 0 && (
                      <span className="sr-only">, {badge} new</span>
                    )}
                  </span>
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
