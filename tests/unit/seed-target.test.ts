import { describe, expect, it } from "vitest";
import { assertSeedTarget } from "../../seed";

describe("seed target guard", () => {
  it("allows only local targets or the exact staging URL", () => {
    expect(() => assertSeedTarget("http://localhost:54321")).not.toThrow();
    expect(() => assertSeedTarget("http://127.0.0.1:54321")).not.toThrow();
    const staging = "https://synthetic-staging.supabase.co";
    expect(() => assertSeedTarget(staging, staging)).not.toThrow();
    expect(() => assertSeedTarget(staging)).toThrow();
    expect(() => assertSeedTarget("https://other.supabase.co", staging)).toThrow();
  });

  it("rejects production even when configured as staging", () => {
    const production = "https://uoghvqciodboxhfopuip.supabase.co";
    expect(() => assertSeedTarget(production, production)).toThrow();
    expect(() => assertSeedTarget("https://uoghvqciodboxhfopuip.localhost")).toThrow();
    expect(() => assertSeedTarget("file:///localhost")).toThrow();
  });
});
