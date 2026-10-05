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

  if (kid.locked_until && new Date() < new Date(kid.locked_until as string)) {
    const mins = Math.max(
      1,
      Math.ceil((new Date(kid.locked_until as string).getTime() - Date.now()) / 60000)
    );
    return {
      ok: false,
      error: `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
      status: 403,
    };
  }

  let isValid = false;
  try {
    isValid = await bcrypt.compare((pin as string).trim(), kid.hashed_pin as string);
  } catch (_e) {
    return { ok: false, error: "PIN verification failed", status: 500 };
  }

  if (!isValid) {
    const attempts = (Number(kid.failed_login_attempts) || 0) + 1;
    const lockedUntil =
      attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await admin
      .from("kids")
      .update({ failed_login_attempts: attempts, locked_until: lockedUntil })
      .eq("id", kid.id);
    const triesLeft = Math.max(0, 5 - attempts);
    return {
      ok: false,
      error:
        attempts >= 5
          ? "Too many wrong PINs. Try again in 15 minutes."
          : `That PIN isn't right. ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left.`,
      status: attempts >= 5 ? 403 : 400,
    };
  }

  if (
    (kid.failed_login_attempts && Number(kid.failed_login_attempts) > 0) ||
    kid.locked_until
  ) {
    await admin
      .from("kids")
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq("id", kid.id);
  }

  return { ok: true };
}
