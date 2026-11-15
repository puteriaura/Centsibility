// The parent PIN gate. It lives apart from index.ts so tests can run it without starting the server.
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

// Match the untyped Supabase fluent-query boundary used by the existing server helpers.
type Admin = { from(table: string): any; rpc(fn: string, args: Record<string, unknown>): any };

export type PinGateFailure = { message: string; status: number };

// Export and account deletion never run for a parent who has not set a PIN.
const PIN_MANDATORY_ACTIONS = new Set(["export-family-data", "delete-parent-account"]);

export async function sha256(text: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return encodeHex(new Uint8Array(hashBuffer));
}

/** Returns why the call must stop, or null when the PIN gate lets it through. */
export async function pinGateFailure(
  admin: Admin,
  parentId: string,
  action: string,
  token: unknown,
): Promise<PinGateFailure | null> {
  const { data: pinRow, error: pinErr } = await admin
    .from("commander_pins")
    .select("pin_hash")
    .eq("parent_id", parentId)
    .maybeSingle();
  if (pinErr) return { message: pinErr.message, status: 500 };

  // No PIN configured: other actions carry on, but export and delete need one first.
  if (!pinRow || !pinRow.pin_hash) {
    return PIN_MANDATORY_ACTIONS.has(action) ? { message: "Set a 6-digit PIN first", status: 403 } : null;
  }

  if (typeof token !== "string" || !token.trim()) return { message: "PIN required", status: 403 };

  const { data: isValid, error: valErr } = await admin.rpc("parent_pin_session_valid", {
    p_parent_id: parentId,
    p_token_hash: await sha256(token.trim()),
  });
  if (valErr) return { message: valErr.message, status: 500 };
  return isValid ? null : { message: "PIN required", status: 403 };
}
