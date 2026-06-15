// Default area of interest (lng/lat) — Benelux + Switzerland + neighbours.
// Keeps live responses bounded; widen per deployment as coverage grows.
export const DEFAULT_BBOX: [number, number, number, number] = [2, 46, 11, 54];

export function parseBbox(url: URL): [number, number, number, number] {
  const raw = url.searchParams.get("bbox");
  if (!raw) return DEFAULT_BBOX;
  const p = raw.split(",").map(Number);
  if (p.length === 4 && p.every((n) => Number.isFinite(n))) {
    return [p[0], p[1], p[2], p[3]];
  }
  return DEFAULT_BBOX;
}
