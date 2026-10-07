export function recapBackgrounds(userId: string, period: string): string[] {
  let seed = 2166136261;
  for (const char of `${userId}:${period}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const images = Array.from({ length: 6 }, (_, i) => `/recap/story-${i + 1}.webp`);
  for (let i = images.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [images[i], images[j]] = [images[j], images[i]];
  }
  return images;
}

export function isStoryTap(startedAt: number, releasedAt: number) {
  return releasedAt - startedAt < 250;
}
