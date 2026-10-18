import bcrypt from "npm:bcryptjs@3.0.3";

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}


export async function hashPin(pin: string): Promise<string> {
  return await bcrypt.hash(pin, 10);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}



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
