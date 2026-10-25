/** The existing Missions rule; an explicit server level takes priority. */
export function kidLevel(kid?: { level?: unknown; xp?: unknown }) {
  const xp = Number(kid?.xp ?? 0);
  const inferred = 1 + Math.floor(xp / 100);
  return { level: Number(kid?.level ?? inferred), xp, progress: kid?.level != null && Number(kid.level) === inferred ? xp % 100 : null };
}
