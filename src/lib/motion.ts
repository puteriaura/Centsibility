import { DOCK_ROUTES, trimSlash } from "@/lib/navigation";

export const spring = { type: "spring", stiffness: 247, damping: 31.4, mass: 1 } as const;
export const springPop = { type: "spring", stiffness: 195, damping: 20.1, mass: 1 } as const;

const dockPaths = new Set(Object.values(DOCK_ROUTES).flat());
export function navigationMotion(from: string | undefined, to: string): "tab" | "forward" | "back" {
  const start = trimSlash(from ?? "/");
  const end = trimSlash(to);
  if (dockPaths.has(start) && dockPaths.has(end)) return "tab";
  const depth = (path: string) => dockPaths.has(path) ? 1 : path.split("/").filter(Boolean).length;
  return depth(end) < depth(start) ? "back" : "forward";
}

// The installed DOM typings predate this optional browser API.
export function activeViewTransition() {
  return (document as Document & { activeViewTransition?: ViewTransition | null }).activeViewTransition;
}
