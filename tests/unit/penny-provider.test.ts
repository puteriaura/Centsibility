import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getPennyStorageKey,
  loadCachedMessages,
  saveCachedMessages,
  clearCachedMessages,
  PENNY_STORAGE_KEY_PREFIX,
} from "../../src/features/penny/storage";
import type { ChatMessage } from "../../src/features/penny/types";

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

(globalThis as unknown as { window: unknown }).window = {
  sessionStorage: mockStorage,
};

describe("Penny message persistence (T34)", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  it("constructs correct storage keys for kid and parent modes", () => {
    expect(getPennyStorageKey("kid")).toBe(`${PENNY_STORAGE_KEY_PREFIX}kid`);
    expect(getPennyStorageKey("parent")).toBe(
      `${PENNY_STORAGE_KEY_PREFIX}parent`,
    );
  });

  it("returns null when no messages are cached", () => {
    expect(loadCachedMessages("kid")).toBeNull();
    expect(loadCachedMessages("parent")).toBeNull();
  });

  it("saves and reloads kid chat messages across drawer close / page switch", () => {
    const testMessages: ChatMessage[] = [
      { id: "welcome", role: "assistant", text: "Salam! I'm Penny." },
      { id: "u-1", role: "user", text: "How much did I spend this week?" },
      { id: "a-1", role: "assistant", text: "You spent RM 12.50 on snacks." },
    ];

    saveCachedMessages("kid", testMessages);

    // Verify raw storage
    const raw = mockStorage.getItem(`${PENNY_STORAGE_KEY_PREFIX}kid`);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(testMessages);

    // Verify loading back (simulating closing drawer and opening full page)
    const reloaded = loadCachedMessages("kid");
    expect(reloaded).toEqual(testMessages);
    expect(reloaded?.length).toBe(3);
    expect(reloaded?.[2].text).toBe("You spent RM 12.50 on snacks.");
  });

  it("separates kid and parent session messages", () => {
    const kidMessages: ChatMessage[] = [
      { id: "welcome-kid", role: "assistant", text: "Salam kid!" },
    ];
    const parentMessages: ChatMessage[] = [
      { id: "welcome-parent", role: "assistant", text: "Salam parent!" },
    ];

    saveCachedMessages("kid", kidMessages);
    saveCachedMessages("parent", parentMessages);

    expect(loadCachedMessages("kid")).toEqual(kidMessages);
    expect(loadCachedMessages("parent")).toEqual(parentMessages);
  });

  it("safely handles corrupted storage without throwing", () => {
    mockStorage.setItem(`${PENNY_STORAGE_KEY_PREFIX}kid`, "invalid-json{}}");
    expect(loadCachedMessages("kid")).toBeNull();

    mockStorage.setItem(
      `${PENNY_STORAGE_KEY_PREFIX}kid`,
      JSON.stringify("not-an-array"),
    );
    expect(loadCachedMessages("kid")).toBeNull();

    mockStorage.setItem(`${PENNY_STORAGE_KEY_PREFIX}kid`, JSON.stringify([]));
    expect(loadCachedMessages("kid")).toBeNull();
  });

  it("clears cached messages on request", () => {
    const testMessages: ChatMessage[] = [
      { id: "welcome", role: "assistant", text: "Salam!" },
    ];
    saveCachedMessages("kid", testMessages);
    saveCachedMessages("parent", testMessages);

    clearCachedMessages("kid");
    expect(loadCachedMessages("kid")).toBeNull();
    expect(loadCachedMessages("parent")).toEqual(testMessages);

    clearCachedMessages();
    expect(loadCachedMessages("parent")).toBeNull();
  });
});
