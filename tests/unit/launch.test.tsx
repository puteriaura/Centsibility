import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Route } from "@/routes/launch";

const { getKidSession, useAuth } = vi.hoisted(() => ({
  getKidSession: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/lib/kid-session", () => ({ getKidSession }));
vi.mock("@/providers/auth", () => ({ useAuth }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => ({ options }),
  Navigate: ({ to }: { to: string }) => createElement("span", { "data-redirect": to }),
  Link: ({ to, children }: { to: string; children: string }) => createElement("a", { href: to }, children),
}));

it("launches the saved kid or parent session and offers both sign-in choices when signed out", () => {
  const render = () => renderToStaticMarkup(createElement(Route.options.component!));
  useAuth.mockReturnValue({ session: {}, loading: false });
  getKidSession.mockReturnValue({});
  expect(render()).toContain('data-redirect="/kid"');

  getKidSession.mockReturnValue(null);
  expect(render()).toContain('data-redirect="/parent"');

  useAuth.mockReturnValue({ session: null, loading: false });
  expect(render()).toContain('href="/login"');
  expect(render()).toContain('href="/kid-login"');
});
