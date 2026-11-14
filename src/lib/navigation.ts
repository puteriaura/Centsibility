// Navigation map for the app shell: which screens are dock destinations,
// what each screen is called, and where its back arrow leads.
//
// Root destinations live in the dock and have no back arrow. Everything else
// is a detail screen: a back arrow that goes one level up (not always home)
// and no dock, so task flows and keypads get the full screen.

export type Mode = "kid" | "parent";

export type NavItem = {
  to: string;
  label: string;
  icon: string;
  center?: boolean;
  badge?: boolean;
  match?: string[];
};

export const NAV: Record<Mode, NavItem[]> = {
  kid: [
    { to: "/kid", label: "Home", icon: "home" },
    { to: "/kid/wallet", label: "Wallet", icon: "wallet" },
    // Transfer opens a focused compose flow without the dock.
    { to: "/kid/transfer", label: "Send", icon: "transfer", center: true },
    { to: "/kid/insights", label: "Insights", icon: "reports" },
    { to: "/kid/more", label: "More", icon: "more" },
  ],
  parent: [
    { to: "/parent", label: "Home", icon: "home" },
    {
      to: "/parent/approvals",
      label: "Approvals",
      icon: "approve",
      badge: true,
    },
    // Sending money is the parent's main action; like a scanner, it opens a
    // focused flow without the dock.
    {
      to: "/parent/transfer",
      label: "Send",
      icon: "transfer",
      center: true,
    },
    {
      to: "/parent/insights",
      label: "Insights",
      icon: "reports",
      match: ["/parent/insights", "/parent/reports"],
    },
    { to: "/parent/settings", label: "Settings", icon: "settings" },
  ],
};

export const DOCK_ROUTES: Record<Mode, string[]> = {
  kid: ["/kid", "/kid/wallet", "/kid/insights", "/kid/more"],
  parent: [
    "/parent",
    "/parent/approvals",
    "/parent/insights",
    "/parent/settings",
  ],
};

const TITLES: Record<Mode, Array<[string, string]>> = {
  kid: [
    ["/kid/wallet", "Wallet"],
    ["/kid/more", "More"],
    ["/kid/goals", "Tabung"],
    ["/kid/loans", "Loans"],
    ["/kid/card", "Card"],
    ["/kid/insights", "Insights"],
    ["/kid/chat", "Penny"],
    ["/kid/transfer", "Send"],
    ["/kid/missions", "Missions"],
    ["/kid/quest", "Quest"],
    ["/kid/notifications", "Notifications"],
    ["/kid/history", "Transactions"],
    ["/kid/sadaqah", "Sadaqah"],
    ["/kid/invest", "Investment"],
  ],
  parent: [
    ["/parent/approvals", "Approvals"],
    ["/parent/transfer", "Send"],
    ["/parent/insights", "Insights"],
    ["/parent/reports", "Statements"],
    ["/parent/settings", "Settings"],
    ["/parent/penny", "Penny"],
  ],
};

export const trimSlash = (p: string) =>
  p.length > 1 ? p.replace(/\/+$/, "") : p;

export function pageTitle(pathname: string, mode: Mode) {
  const hit = TITLES[mode].find(([prefix]) => pathname.startsWith(prefix));
  return hit ? hit[1] : "Home";
}

/** Where the back arrow goes: one level up the hierarchy, never "wherever". */
export function upTarget(pathname: string, mode: Mode): string {
  if (mode === "kid") {
    const p = trimSlash(pathname);
    if (p.startsWith("/kid/quest")) return "/kid/missions";
    if (["/kid/goals", "/kid/loans", "/kid/card", "/kid/invest", "/kid/sadaqah", "/kid/zakat", "/kid/history", "/kid/rewards", "/kid/notifications"].includes(p)) {
      return "/kid/more";
    }
    return "/kid";
  }
  if (pathname.startsWith("/parent/reports")) return "/parent/insights";
  return "/parent";
}

export function screenKind(
  pathname: string,
  mode: Mode,
): "home" | "root" | "detail" {
  const p = trimSlash(pathname);
  if (p === `/${mode}`) return "home";
  return DOCK_ROUTES[mode].includes(p) ? "root" : "detail";
}
