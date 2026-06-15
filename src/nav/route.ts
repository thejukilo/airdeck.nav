/**
 * Route planning: pick a cruise altitude (at/above the chosen minimum) that
 * minimises airspace conflicts, then find the lowest-cost lateral path from A to
 * B that avoids restricted/controlled airspace at that altitude.
 *
 * The path is a weighted A* search over a grid laid across the area: cells that
 * fall inside airspace carry a penalty (prohibited/restricted heavy, controlled
 * lighter), so the cheapest path naturally bends around them. Soft penalties
 * (not hard blocks) guarantee a route always exists — if avoidance is
 * impossible it routes through the least-bad airspace and lists it.
 */
import type { Feature, FeatureCollection, LineString, Polygon, MultiPolygon } from "geojson";
import type { AirspaceProps } from "../data/aero";
import { bearingDeg, distanceNm, type LngLat } from "../lib/geo";
import { inPolygon, parseAltFt } from "./airspace";

export interface Waypoint {
  icao: string;
  name: string;
  lng: number;
  lat: number;
  elevFt?: number | null;
}

export interface RouteCrossing {
  name: string;
  category: string;
  class: string;
  lower: string;
  upper: string;
}

export interface RoutePlan {
  from: Waypoint;
  to: Waypoint;
  distanceNm: number;
  bearingDeg: number;
  recommendedAltFt: number;
  crossings: RouteCrossing[];
  line: FeatureCollection<LineString>;
}

type Poly = Feature<Polygon | MultiPolygon, AirspaceProps>;

const WEIGHT: Record<string, number> = {
  prohibited: 60,
  restricted: 40,
  danger: 40,
  ctr: 8,
  tma: 5,
  rmz: 2,
};

const MAX_ALT = 9500;
const UNLIMITED = 99999;
const GRID_CELLS = 100; // along the longer dimension
const MARGIN_DEG = 0.4; // how far the route may bend outside the direct corridor

function candidateAlts(minFt: number): number[] {
  const start = Math.max(0, Math.round(minFt / 500) * 500);
  const alts: number[] = [];
  for (let a = start; a <= Math.max(start, MAX_ALT); a += 500) alts.push(a);
  return alts;
}

function bboxOf(geom: Polygon | MultiPolygon): [number, number, number, number] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const rings = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  for (const ring of rings)
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

const floorOf = (p: AirspaceProps) => parseAltFt(p.lower);
const ceilOf = (p: AirspaceProps) => parseAltFt(p.upper) || UNLIMITED;
const inBand = (alt: number, p: AirspaceProps) => alt >= floorOf(p) && alt <= ceilOf(p);

export function planRoute(
  from: Waypoint,
  to: Waypoint,
  airspaces: Poly[],
  minAltFt = 1500,
): RoutePlan {
  const relevant = airspaces.filter((f) => f.geometry && WEIGHT[f.properties.category]);

  // --- 1. Choose cruise altitude from straight-line crossings -------------
  const n = Math.min(300, Math.max(24, Math.round(distanceNm(from, to))));
  const straight: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    straight.push({
      lng: from.lng + (to.lng - from.lng) * t,
      lat: from.lat + (to.lat - from.lat) * t,
    });
  }
  const crossedStraight = relevant.filter((f) =>
    straight.some((p) => inPolygon(p, f.geometry)),
  );
  let recommendedAltFt = candidateAlts(minAltFt)[0];
  let best = Infinity;
  for (const alt of candidateAlts(minAltFt)) {
    const score = crossedStraight.reduce(
      (s, f) => (inBand(alt, f.properties) ? s + WEIGHT[f.properties.category] : s),
      0,
    );
    if (score < best) {
      best = score;
      recommendedAltFt = alt;
    }
  }

  // Obstacles = relevant airspace whose band includes the cruise altitude.
  const obstacles = relevant.filter((f) => inBand(recommendedAltFt, f.properties));

  // --- 2. Build the penalty grid ------------------------------------------
  const minLng = Math.min(from.lng, to.lng) - MARGIN_DEG;
  const maxLng = Math.max(from.lng, to.lng) + MARGIN_DEG;
  const minLat = Math.min(from.lat, to.lat) - MARGIN_DEG;
  const maxLat = Math.max(from.lat, to.lat) + MARGIN_DEG;
  const midLat = (minLat + maxLat) / 2;
  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;
  const cell = Math.max(spanLng, spanLat) / GRID_CELLS;
  const cols = Math.max(2, Math.round(spanLng / cell) + 1);
  const rows = Math.max(2, Math.round(spanLat / cell) + 1);

  const dxNm = cell * 60 * Math.cos((midLat * Math.PI) / 180);
  const dyNm = cell * 60;

  const nodeLng = (cx: number) => minLng + cx * cell;
  const nodeLat = (cy: number) => minLat + cy * cell;

  const pen = new Float32Array(cols * rows);
  for (const f of obstacles) {
    const w = WEIGHT[f.properties.category];
    const [bx0, by0, bx1, by1] = bboxOf(f.geometry);
    const cx0 = Math.max(0, Math.floor((bx0 - minLng) / cell));
    const cx1 = Math.min(cols - 1, Math.ceil((bx1 - minLng) / cell));
    const cy0 = Math.max(0, Math.floor((by0 - minLat) / cell));
    const cy1 = Math.min(rows - 1, Math.ceil((by1 - minLat) / cell));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const pt = { lng: nodeLng(cx), lat: nodeLat(cy) };
        if (inPolygon(pt, f.geometry)) {
          const idx = cy * cols + cx;
          if (w > pen[idx]) pen[idx] = w;
        }
      }
    }
  }

  // --- 3. Weighted A* ------------------------------------------------------
  const clampCx = (lng: number) =>
    Math.max(0, Math.min(cols - 1, Math.round((lng - minLng) / cell)));
  const clampCy = (lat: number) =>
    Math.max(0, Math.min(rows - 1, Math.round((lat - minLat) / cell)));
  const startIdx = clampCy(from.lat) * cols + clampCx(from.lng);
  const goalCx = clampCx(to.lng);
  const goalCy = clampCy(to.lat);
  const goalIdx = goalCy * cols + goalCx;

  const g = new Float64Array(cols * rows).fill(Infinity);
  const came = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const heapIdx: number[] = [];
  const heapF: number[] = [];

  const h = (idx: number) => {
    const cx = idx % cols;
    const cy = (idx - cx) / cols;
    return Math.hypot((goalCx - cx) * dxNm, (goalCy - cy) * dyNm);
  };
  const push = (idx: number, f: number) => {
    heapIdx.push(idx);
    heapF.push(f);
    let i = heapIdx.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= heapF[i]) break;
      [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
      [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heapIdx[0];
    const last = heapIdx.length - 1;
    heapIdx[0] = heapIdx[last];
    heapF[0] = heapF[last];
    heapIdx.pop();
    heapF.pop();
    let i = 0;
    const len = heapIdx.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < len && heapF[l] < heapF[m]) m = l;
      if (r < len && heapF[r] < heapF[m]) m = r;
      if (m === i) break;
      [heapF[m], heapF[i]] = [heapF[i], heapF[m]];
      [heapIdx[m], heapIdx[i]] = [heapIdx[i], heapIdx[m]];
      i = m;
    }
    return top;
  };

  g[startIdx] = 0;
  push(startIdx, h(startIdx));
  while (heapIdx.length) {
    const cur = pop();
    if (cur === goalIdx) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % cols;
    const cy = (cur - cx) / cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nIdx = ny * cols + nx;
        if (closed[nIdx]) continue;
        const base = dx && dy ? Math.hypot(dxNm, dyNm) : dx ? dxNm : dyNm;
        const step = base * (1 + pen[nIdx]);
        const ng = g[cur] + step;
        if (ng < g[nIdx]) {
          g[nIdx] = ng;
          came[nIdx] = cur;
          push(nIdx, ng + h(nIdx));
        }
      }
    }
  }

  // --- 4. Reconstruct + simplify ------------------------------------------
  let path: LngLat[];
  if (came[goalIdx] === -1 && goalIdx !== startIdx) {
    path = [from, to]; // no path found — fall back to direct
  } else {
    const cells: number[] = [];
    let c = goalIdx;
    while (c !== -1) {
      cells.push(c);
      if (c === startIdx) break;
      c = came[c];
    }
    cells.reverse();
    const pts = cells.map((idx) => {
      const cx = idx % cols;
      const cy = (idx - cx) / cols;
      return { lng: nodeLng(cx), lat: nodeLat(cy) };
    });
    pts[0] = { lng: from.lng, lat: from.lat };
    pts[pts.length - 1] = { lng: to.lng, lat: to.lat };
    path = simplify(pts);
  }

  function penaltyAt(p: LngLat): number {
    const idx = clampCy(p.lat) * cols + clampCx(p.lng);
    return pen[idx];
  }
  // Keep a segment only if it doesn't pass through penalised cells.
  function segmentClear(a: LngLat, b: LngLat): boolean {
    const steps = Math.max(2, Math.ceil(distanceNm(a, b) / (dyNm * 0.5)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (penaltyAt({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t }) > 0.5)
        return false;
    }
    return true;
  }
  function simplify(pts: LngLat[]): LngLat[] {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !segmentClear(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  // --- 5. Stats + crossings along the final path --------------------------
  let distance = 0;
  for (let i = 1; i < path.length; i++) distance += distanceNm(path[i - 1], path[i]);

  const dense: LngLat[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const segSteps = Math.max(2, Math.ceil(distanceNm(a, b)));
    for (let s = 0; s <= segSteps; s++) {
      const t = s / segSteps;
      dense.push({ lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t });
    }
  }
  const crossings: RouteCrossing[] = obstacles
    .filter((f) => dense.some((p) => inPolygon(p, f.geometry)))
    .sort((a, b) => WEIGHT[b.properties.category] - WEIGHT[a.properties.category])
    .map((f) => ({
      name: f.properties.name || f.properties.typeName || "Airspace",
      category: f.properties.category,
      class: f.properties.class,
      lower: f.properties.lower,
      upper: f.properties.upper,
    }));

  return {
    from,
    to,
    distanceNm: distance,
    bearingDeg: bearingDeg(path[0], path[1] ?? to),
    recommendedAltFt,
    crossings,
    line: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: path.map((p) => [p.lng, p.lat]) },
        },
      ],
    },
  };
}
