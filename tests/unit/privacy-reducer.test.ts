import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const documentMock = {
  visibilityState: "visible",
  addEventListener: eventTarget.addEventListener.bind(eventTarget),
  removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
  dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
};

(globalThis as any).window = windowMock;
(globalThis as any).document = documentMock;
(globalThis as any).sessionStorage = mockStorage;
(globalThis as any).localStorage = mockStorage;

import {
  privacyReducer,
  createInitialPrivacyState,
  createIdleLockTimer,
  createVisibilityLockListener,
  IDLE_TIMEOUT_MS,
} from "@/features/privacy/privacy-reducer";

describe("Privacy reducer and lifecycle", () => {
  beforeEach(() => {
    mockStorage.clear();
    documentMock.visibilityState = "visible";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts locked with a saved session", () => {
    const state = createInitialPrivacyState({ initialLocked: true });
    expect(state.locked).toBe(true);
    expect(state.hidden).toBe(false);
  });

  it("unlock clears locked", () => {
    const initial = { locked: true, hidden: false };
    const next = privacyReducer(initial, { type: "UNLOCK" });
    expect(next.locked).toBe(false);
    expect(next.hidden).toBe(false);
  });

  it("hidden survives unlock", () => {
    const initial = { locked: true, hidden: true };
    const next = privacyReducer(initial, { type: "UNLOCK" });
    expect(next.locked).toBe(false);
    expect(next.hidden).toBe(true);
  });

  it("the idle timer locks after 5 minutes, using fake timers", () => {
    vi.useFakeTimers();
    let lockCalled = false;
    const onLock = () => {
      lockCalled = true;
    };

    const cleanup = createIdleLockTimer(onLock, IDLE_TIMEOUT_MS);

    expect(lockCalled).toBe(false);

    // Advance 4 minutes (not locked yet)
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(lockCalled).toBe(false);

    // Advance past 5 minutes total
    vi.advanceTimersByTime(1 * 60 * 1000 + 100);
    expect(lockCalled).toBe(true);

    cleanup();
  });

  it("a visibilitychange to hidden locks", () => {
    let lockCalled = false;
    const onLock = () => {
      lockCalled = true;
    };

    const cleanup = createVisibilityLockListener(onLock);

    expect(lockCalled).toBe(false);

    // Set document visibilityState to hidden
    documentMock.visibilityState = "hidden";
    eventTarget.dispatchEvent(new Event("visibilitychange"));

    expect(lockCalled).toBe(true);

    cleanup();
  });
});
