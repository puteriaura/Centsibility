export type KidLevelName = "Seedling" | "Sprout" | "Sapling" | "Tree";

export function levelNameFor(level: number): KidLevelName {
  if (level <= 1) return "Seedling";
  if (level === 2) return "Sprout";
  if (level === 3) return "Sapling";
  return "Tree";
}

/** The existing Missions rule; an explicit server level takes priority. */
export function kidLevel(kid?: { level?: unknown; xp?: unknown }) {
  const xp = Number(kid?.xp ?? 0);
  const inferred = 1 + Math.floor(xp / 100);
  const level = Number(kid?.level ?? inferred);
  const progress =
    kid?.level != null && Number(kid.level) === inferred ? xp % 100 : null;
  return { level, xp, progress };
}
