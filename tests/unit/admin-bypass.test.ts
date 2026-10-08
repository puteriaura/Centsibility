import { afterEach, describe, expect, it, vi } from "vitest";
import { isKidSessionToken } from "../../supabase/functions/_shared/kid-session-token";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/edge", () => ({ edgeKidLogin: vi.fn(), edgeKidLoginByCode: vi.fn() }));

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("production bypass boundary", () => {
  it("ignores forged storage flags and excludes all demo session constants", async () => {
    vi.stubEnv("DEV", false);
    const storage = { getItem: vi.fn(() => "true"), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", storage);
    const bypass = await import("../../src/lib/admin-bypass");
    expect(bypass.PARENT_BYPASS_KEY).toBe("");
    expect(bypass.KID_BYPASS_KEY).toBe("");
    expect(bypass.DEMO_PARENT_SESSION).toBeNull();
    expect(bypass.DEMO_PARENT_USER).toBeNull();
    expect(bypass.isKidBypassed()).toBe(false);
    expect(bypass.isParentBypassed()).toBe(false);
    bypass.setKidBypassed(true); bypass.setParentBypassed(true); bypass.markParentPinBypassed();
    await expect(bypass.adminBypassKid()).rejects.toThrow("development mode");
    await expect(bypass.adminBypassParent()).rejects.toThrow("development mode");
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each(["demo-token-aiman", "demo-token-demo", "demo-bypass-access-token", "AIMAN1", "", "f".repeat(63), "g".repeat(64)])("server rejects %s", token => {
    expect(isKidSessionToken(token)).toBe(false);
  });
  it("accepts only the issued randomHex(32) shape", () => {
    expect(isKidSessionToken("0123456789abcdef".repeat(4))).toBe(true);
  });
});
