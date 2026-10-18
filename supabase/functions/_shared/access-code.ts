const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVALID_ACCESS_CODE = "This access code is invalid or has expired. Ask your parent for a new one.";

export function genCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => alphabet[byte % 32]).join("");
}

export function isCodeUsable(kid: { login_code: string | null; hashed_pin: string | null; login_code_expires_at: string | null } | null, now = Date.now()): boolean {
  return !!kid?.login_code && !kid.hashed_pin && !!kid.login_code_expires_at && Date.parse(kid.login_code_expires_at) > now;
}
