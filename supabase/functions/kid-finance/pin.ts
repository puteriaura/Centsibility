import bcrypt from "npm:bcryptjs";

export function isValidPinFormat(pin: unknown): boolean {
  return typeof pin === "string" && /^\d{6}$/.test(pin.trim());
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
