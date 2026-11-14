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

  // Check if this caller is already locked out (limit 5 attempts in 900s).
  // Use a separate lock bucket so valid attempts from a different device/IP are never blocked.
  const lockCheck = await hit(admin, "login-pin-lock", callerKey, 5, 900);
  if (!lockCheck.allowed) {
    const mins = Math.max(1, Math.ceil(lockCheck.retryAfter / 60));
    return { ok: false, error: `Too many wrong PINs. Try again in ${mins} minutes.`, status: 403 };
  }

  let isValid = false;
  try {
    isValid = await bcrypt.compare((pin as string).trim(), kid.hashed_pin as string);
  } catch (_e) {
    return { ok: false, error: "PIN verification failed", status: 500 };
  }

  if (isValid) {
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
