import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MockStorage();
const eventTarget = new EventTarget();

const windowMock = {
  sessionStorage: mockStorage,
  localStorage: mockStorage,
  addEventListener: eventTarget.addEventListener.bind(eventTarget),
  removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
  dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
};

(globalThis as any).window = windowMock;
(globalThis as any).sessionStorage = mockStorage;
(globalThis as any).localStorage = mockStorage;

const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

import {
  setParentPinSession,
  getParentPinSession,
  clearParentPinSession,
  edgeParentDeposit,
  edgeKidSadaqah,
} from "../../src/lib/edge";

describe("parent pin session storage", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    mockStorage.clear();
    mockInvoke.mockReset();
  });

  it("stores and retrieves active PIN session", () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    setParentPinSession("token_xyz", future);

    const session = getParentPinSession();
    expect(session).not.toBeNull();
    expect(session?.token).toBe("token_xyz");
    expect(session?.expiresAt).toBe(future);
  });

  it("returns null and clears expired PIN session", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    setParentPinSession("token_expired", past);

    const session = getParentPinSession();
    expect(session).toBeNull();
    expect(mockStorage.getItem("centsibility.parent.pinSession")).toBeNull();
  });

  it("clearParentPinSession removes item from sessionStorage", () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    setParentPinSession("token_xyz", future);
    clearParentPinSession();
    expect(getParentPinSession()).toBeNull();
  });

  it("auto-attaches pinSession for parent-finance calls and does not attach for kid-finance", async () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    setParentPinSession("test_token_parent", future);

    mockInvoke.mockResolvedValue({
      data: { newBalance: 100 },
      error: null,
    });

    // Call parent-finance
    await edgeParentDeposit({ kidId: "kid1", amount: 10, type: "DEPOSIT" });
    expect(mockInvoke).toHaveBeenCalledWith("parent-finance", {
      signal: expect.any(AbortSignal),
      body: expect.objectContaining({
        action: "deposit",
        kidId: "kid1",
        pinSession: "test_token_parent",
      }),
    });

    // Call kid-finance
    await edgeKidSadaqah({ code: "DEMO01", amount: 5 });
    expect(mockInvoke).toHaveBeenCalledWith("kid-finance", {
      signal: expect.any(AbortSignal),
      body: expect.not.objectContaining({
        pinSession: expect.anything(),
      }),
    });
  });

  it("dispatches centsibility:pin-required event and clears session on PIN required error", async () => {
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    setParentPinSession("test_token_parent", future);

    const response = new Response(JSON.stringify({ error: "PIN required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });

    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    });

    const eventSpy = vi.fn();
    const listener = () => eventSpy();
    windowMock.addEventListener("centsibility:pin-required", listener);

    try {
      await expect(
        edgeParentDeposit({ kidId: "kid1", amount: 10, type: "DEPOSIT" })
      ).rejects.toThrow("PIN required");

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(getParentPinSession()).toBeNull();
    } finally {
      windowMock.removeEventListener("centsibility:pin-required", listener);
    }
  });
});
