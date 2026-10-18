import { describe, it, expect } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { extractEdgeErrorMessage, isAuthError } from "../../src/lib/edge";

describe("auth error classifier", () => {
  it.each([401, 403])("recognises HTTP %s", (status) => {
    expect(
      isAuthError(new FunctionsHttpError(new Response(null, { status }))),
    ).toBe(true);
  });

  it("does not treat network failures, token text or HTTP 400 as auth failures", () => {
    expect(isAuthError(new Error("Network connection failed"))).toBe(false);
    expect(isAuthError(new Error("Invalid token"))).toBe(false);
    expect(
      isAuthError(new FunctionsHttpError(new Response(null, { status: 400 }))),
    ).toBe(false);
  });
});

describe("extractEdgeErrorMessage", () => {
  it("extracts error message from FunctionsHttpError with JSON body", async () => {
    const response = new Response(
      JSON.stringify({ error: "Too many attempts" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
    const err = new FunctionsHttpError(response);
    const msg = await extractEdgeErrorMessage(err);
    expect(msg).toBe("Too many attempts");
  });

  it("falls back to error.message for FunctionsHttpError with non-JSON body", async () => {
    const response = new Response("Bad Gateway", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
    const err = new FunctionsHttpError(response);
    const msg = await extractEdgeErrorMessage(err);
    expect(msg).toBe(err.message);
  });

  it("keeps message for a standard Error", async () => {
    const err = new Error("Network connection failed");
    const msg = await extractEdgeErrorMessage(err);
    expect(msg).toBe("Network connection failed");
  });

  it("handles string errors and unknown values", async () => {
    expect(await extractEdgeErrorMessage("Custom error string")).toBe(
      "Custom error string",
    );
    expect(await extractEdgeErrorMessage(null)).toBe(
      "Edge function call failed",
    );
    expect(await extractEdgeErrorMessage({})).toBe("Edge function call failed");
  });
});
