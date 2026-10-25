import bcrypt from "npm:bcryptjs@3.0.3";

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}


export async function hashPin(pin: string): Promise<string> {
  return await bcrypt.hash(pin, 10);
}

export { constantTimeEqual } from "../_shared/constant-time.ts";



export async function verifyStoredPin(
  pin: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (stored.startsWith("$2")) {
    const valid = await bcrypt.compare(pin, stored);
    return { valid, needsRehash: false };
  }

  return { valid: false, needsRehash: false };
}
