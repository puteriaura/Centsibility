export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidNewUsername(value: string): boolean {
  return /^[a-z0-9._-]{3,24}$/.test(value);
}
