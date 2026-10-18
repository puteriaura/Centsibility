import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import {
  edgeKidGetState,
  edgeKidPennyChat,
  edgeParentGetProfile,
} from "../../src/lib/edge";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  refresh: vi.fn(),
  clear: vi.fn(),
  dispatch: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    auth: { refreshSession: mocks.refresh },
  },
}));
vi.mock("@/lib/admin-bypass", () => ({
  isKidBypassed: () => false,
  isParentBypassed: () => false,
}));
vi.mock("@/lib/kid-session", () => ({
  clearKidSession: mocks.clear,
  getKidSession: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", {
    dispatchEvent: mocks.dispatch,
    location: { pathname: "/parent", href: "/parent" },
  });
  vi.stubGlobal("CustomEvent", class extends Event {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([401, 400])(
  "clears child sessions on HTTP 401 or session_invalid body (%s)",
  async (status) => {
    const response = new Response(
      JSON.stringify({
        error: "Signed out",
        ...(status === 400 ? { code: "session_invalid" } : {}),
      }),
      { status },
    );
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    });
    await expect(edgeKidGetState({ code: "fake-session" })).rejects.toThrow(
      "You were signed out",
    );
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.dispatch.mock.calls[0][0].type).toBe(
      "centsibility:kid-signed-out",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  },
);

it.each(["kid", "parent"])("keeps %s signed in when offline", async (actor) => {
  mocks.invoke.mockResolvedValue({
    data: null,
    error: new FunctionsFetchError(new TypeError("Failed to fetch")),
  });
  const call =
    actor === "kid"
      ? edgeKidGetState({ code: "fake-session" })
      : edgeParentGetProfile();
  await expect(call).rejects.toThrow("You seem to be offline");
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(mocks.dispatch).not.toHaveBeenCalled();
  expect(window.location.href).toBe("/parent");
});

it("uses 15-second request and 45-second Penny abort signals", async () => {
  const controller = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(controller.signal);
  mocks.invoke.mockResolvedValue({ data: {}, error: null });
  await edgeKidGetState({ code: "fake-session" });
  await edgeKidPennyChat({ code: "fake-session", message: "Saving" });
  expect(timeout.mock.calls).toEqual([[15_000], [45_000]]);
  expect(
    mocks.invoke.mock.calls.every(
      ([, options]) => options.signal === controller.signal,
    ),
  ).toBe(true);
  controller.abort();
  mocks.invoke.mockResolvedValue({
    data: null,
    error: new FunctionsFetchError(new Error("aborted")),
  });
  await expect(edgeKidGetState({ code: "fake-session" })).rejects.toThrow(
    "That took too long",
  );
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("refreshes parent HTTP auth failures once and preserves PIN gates", async () => {
  const unauthorized = new FunctionsHttpError(
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  );
  mocks.invoke
    .mockResolvedValueOnce({ data: null, error: unauthorized })
    .mockResolvedValueOnce({ data: { ok: true }, error: null });
  mocks.refresh.mockResolvedValue({ data: { session: {} }, error: null });
  await expect(edgeParentGetProfile()).resolves.toEqual({ ok: true });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  mocks.invoke.mockResolvedValue({
    data: null,
    error: new FunctionsHttpError(
      new Response(JSON.stringify({ error: "PIN required" }), { status: 403 }),
    ),
  });
  await expect(edgeParentGetProfile()).rejects.toThrow("PIN required");
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.dispatch.mock.calls.at(-1)[0].type).toBe(
    "centsibility:pin-required",
  );
});
