import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";
import { Route as KidRoute } from "@/routes/kid";

const { effects, navigate, path, state } = vi.hoisted(() => ({
  effects: [] as Array<() => void>,
  navigate: vi.fn(),
  path: { current: "/kid" },
  state: { first: undefined as unknown },
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void) => effects.push(effect),
  useState: (initial: unknown) => {
    const value = state.first ?? initial;
    state.first = undefined;
    return [value, vi.fn()];
  },
  useRef: () => ({ current: null }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => navigate,
  useRouterState: () => path.current,
}));
vi.mock("@/providers/auth", () => ({
  useAuth: () => ({ session: {}, loading: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/sounds", () => ({ sfx: { swoosh: vi.fn() } }));

const keys = [
  "parentSessionValidUntil",
  "centsibility.parent.pinSession",
  "centsibility:admin-bypass-parent",
];
const stored = new Map<string, string>();

beforeEach(() => {
  const sessionStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    removeItem: (key: string) => stored.delete(key),
  };
  vi.stubGlobal("window", { sessionStorage, dispatchEvent: vi.fn() });
  vi.stubGlobal("sessionStorage", sessionStorage);
  vi.stubGlobal("localStorage", { getItem: () => null, removeItem: vi.fn() });
  keys.forEach((key) => stored.set(key, "true"));
  effects.length = 0;
  navigate.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}

function expectLocked() {
  expect(keys.map((key) => sessionStorage.getItem(key))).toEqual([null, null, null]);
}

it("ends the parent unlock when KidLayout mounts", () => {
  const Layout = KidRoute.options.component as () => ReactNode;
  Layout();
  effects.forEach((effect) => effect());
  expectLocked();
});

it.each([
  ["kid", "/login"],
  ["parent", "/kid-login"],
] as const)("ends the parent unlock when switching from %s", async (mode, to) => {
  path.current = "/" + mode;
  state.first = {};
  const account = elements(AppShell({ mode, children: null })).find(
    (element) => typeof element.type === "function" && element.type.name === "ShellAccount",
  )!;
  state.first = true;
  const menu = (account.type as (props: typeof account.props) => ReactNode)(account.props);
  const switchItem = elements(menu).find(
    (element) =>
      element.props.role === "menuitem" &&
      (element.props.children as ReactNode[]).some(
        (child) => typeof child === "string" && child.startsWith("Switch to "),
      ),
  )!;
  (switchItem.props.onClick as () => void)();
  expectLocked();
  await Promise.resolve();
  expect(navigate).toHaveBeenCalledWith({ to });
});
