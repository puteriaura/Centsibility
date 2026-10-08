/** All issued child sessions use randomHex(32), never demo/login codes. */
export function isKidSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
