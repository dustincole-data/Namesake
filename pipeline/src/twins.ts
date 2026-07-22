export function shapeVector(shares: number[]): number[] {
  const norm = Math.hypot(...shares);
  if (norm === 0) return shares.map(() => 0);
  return shares.map(v => v / norm);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]; // inputs are unit vectors
  return dot;
}

export function topTwins(
  targetSlug: string,
  vectors: Map<string, number[]>,
  k: number,
): { slug: string; sim: number }[] {
  const target = vectors.get(targetSlug);
  if (!target) return [];
  const scored: { slug: string; sim: number }[] = [];
  for (const [slug, vec] of vectors) {
    if (slug === targetSlug) continue;
    scored.push({ slug, sim: cosine(target, vec) });
  }
  scored.sort((a, b) => b.sim - a.sim);
  return scored.slice(0, k);
}
