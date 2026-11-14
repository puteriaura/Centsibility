import bcrypt from "npm:bcryptjs@3.0.3";
import { clientIpKey, hashKey, hit } from "../_shared/rate-limit.ts";

export function isValidPinFormat(pin: unknown): boolean {
  return typeof pin === "string" && /^\d{6}$/.test(pin.trim());
}

/** Per-caller login PIN check (FC-58): prevents a sibling from locking out another child globally. */
export async function checkKidLoginPin(
  admin: any,
  req: Request,
  kid: Record<string, unknown>,
  pin: unknown,
  deviceId?: unknown,
): Promise<{ ok: boolean; error?: string; status?: number }> {
  if (!isValidPinFormat(pin)) {
    return { ok: false, error: "PIN must be 6 digits", status: 400 };
  }
  if (!kid.hashed_pin) {
    return { ok: false, error: "PIN setup required", status: 400 };
  }

  const ipKey = (await clientIpKey(req)) ?? "no-ip";
  const deviceHint = typeof deviceId === "string" && deviceId.trim()
    ? deviceId.trim().slice(0, 64)
    : (req.headers.get("user-agent") ?? "unknown").slice(0, 64);
  const callerKey = await hashKey(`${ipKey}:${deviceHint}:${String(kid.id ?? "")}`);

  // Read-check active 900s window failures without incrementing on valid attempts.
  let lockHits = 0;
  const windowMs = Math.floor(Date.now() / 900_000) * 900_000;
  if (typeof admin?.from === "function") {
    const { data: row } = await admin
      .from("rate_limits")
      .select("hits")
      .eq("bucket", "login-pin-fail")
      .eq("key", callerKey)
      .eq("window_start", new Date(windowMs).toISOString())
      .maybeSingle();
    lockHits = Number(row?.hits ?? 0);
  }
  if (lockHits >= 5) {
    const retryAfter = Math.max(1, Math.ceil((windowMs + 900_000 - Date.now()) / 1000));
    const mins = Math.max(1, Math.ceil(retryAfter / 60));
    return { ok: false, error: `Too many wrong PINs. Try again in ${mins} minutes.`, status: 403 };
  }

  let isValid = false;
  try {
    isValid = await bcrypt.compare((pin as string).trim(), kid.hashed_pin as string);
  } catch (_e) {
    return { ok: false, error: "PIN verification failed", status: 500 };
  }

  if (isValid) {
    if (typeof admin?.from === "function") {
      try {
        await admin
          .from("rate_limits")
          .delete()
          .eq("bucket", "login-pin-fail")
          .eq("key", callerKey);
      } catch {
        // Best-effort clear of prior failures.
      }
    }
    return { ok: true };
  }

  const fail = await hit(admin, "login-pin-fail", callerKey, 5, 900);
  if (!fail.allowed || fail.hits >= 5) {
    const mins = Math.max(1, Math.ceil(fail.retryAfter / 60));
    return { ok: false, error: `Too many wrong PINs. Try again in ${mins} minutes.`, status: 403 };
  }
  const attemptsLeft = Math.max(1, 5 - fail.hits);
  return { ok: false, error: `That PIN isn't right. ${attemptsLeft} tries left.`, status: 400 };
}

export async function checkKidPin(
  admin: any,
  kid: Record<string, unknown>,
  pin: unknown
): Promise<{ ok: boolean; error?: string; status?: number }> {
  if (!isValidPinFormat(pin)) {
    return { ok: false, error: "PIN must be 6 digits", status: 400 };
  }
  if (!kid.hashed_pin) {
    return { ok: false, error: "PIN setup required", status: 400 };
  }

  let isValid = false;
  try {
    isValid = await bcrypt.compare((pin as string).trim(), kid.hashed_pin as string);
  } catch (_e) {
    return { ok: false, error: "PIN verification failed", status: 500 };
  }

  const { data, error } = await admin.rpc("kid_pin_result", {
    p_kid_id: kid.id, p_hash: kid.hashed_pin, p_valid: isValid,
  });
  if (error || !data) return { ok: false, error: "PIN verification unavailable. Please try again.", status: 503 };
  if (data.status === "changed") return { ok: false, error: "Your PIN changed. Please try again.", status: 409 };
  if (data.lockedUntil) {
    const mins = Math.max(1, Math.ceil((Date.parse(data.lockedUntil) - Date.now()) / 60000));
    return { ok: false, error: `Too many wrong PINs. Try again in ${mins} minutes.`, status: 403 };
  }
  if (data.status !== "valid") {
    return { ok: false, error: `That PIN isn't right. ${data.attemptsLeft} tries left.`, status: 400 };
  }
  return { ok: true };
}
