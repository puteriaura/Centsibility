import bcrypt from "npm:bcryptjs";

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
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

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyStoredPin(
  pin: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (stored.startsWith("$2")) {
    const valid = await bcrypt.compare(pin, stored);
    return { valid, needsRehash: false };
  }
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    const hashed = await sha256Hex(pin);
    const valid = constantTimeEqual(hashed.toLowerCase(), stored.toLowerCase());
    return { valid, needsRehash: valid };
  }
  return { valid: false, needsRehash: false };
}
