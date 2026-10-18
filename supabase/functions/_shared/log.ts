const allowedKeys = new Set([
  "fn", "requestId", "action", "kidId", "parentId", "status", "ms",
  "intent", "fields", "event",
]);

export function logEvent(fields: Record<string, unknown>): void {
  console.log(JSON.stringify(Object.fromEntries(
    Object.entries(fields).filter(([key]) => allowedKeys.has(key)),
  )));
}
