/**
 * Airspace situational awareness — the "where am I / what's ahead" engine.
 *
 * Given the ownship and the airspace polygons, works out:
 *   - which airspaces you are inside right now (and the vertical relationship), and
 *   - which airspaces lie ahead along your track, with distance, ETE and whether
 *     you'd need to climb / descend / divert.
 *
 * Operates on the openAIP airspace GeoJSON (or the bundled sample fallback).
 */
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { AirspaceProps } from "../data/aero";
import { destination, distanceNm, type LngLat } from "../lib/geo";
import type { Ownship } from "./useOwnship";

export type Vertical = "inside" | "above" | "below";

export interface AirspaceHit {
  name: string;
  category: string;
  class: string;
  lower: string;
  upper: string;
  floorFt: number;
  ceilFt: number;
  /** ownship altitude vs the airspace band */
  vertical: Vertical;
  /** present only for "ahead" results */
  distanceNm?: number;
  etaMin?: number;
}

export interface Awareness {
  inside: AirspaceHit[];
  ahead: AirspaceHit[];
}

const UNLIMITED = 99999;

/** Parse an airspace limit label ("GND", "FL095", "1500 ft MSL") to feet. */
export function parseAltFt(label: string | undefined): number {
  if (!label) return 0;
  const s = label.trim().toUpperCase();
  if (s === "GND" || s === "SFC" || s === "0") return 0;
  if (s.startsWith("UNL") || s.includes("UNLIM")) return UNLIMITED;
  const fl = s.match(/FL\s*(\d+)/);
  if (fl) return parseInt(fl[1], 10) * 100;
  const ft = s.match(/(\d[\d,]*)/);
  if (ft) return parseInt(ft[1].replace(/,/g, ""), 10);
  return 0;
}

type Poly = Feature<Polygon | MultiPolygon, AirspaceProps>;

/** Bounding box [minLng, minLat, maxLng, maxLat] of a polygon/multipolygon. */
function bboxOf(geom: Polygon | MultiPolygon): [number, number, number, number] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const rings = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

function inBbox(p: LngLat, b: [number, number, number, number]): boolean {
  return p.lng >= b[0] && p.lng <= b[2] && p.lat >= b[1] && p.lat <= b[3];
}

/** Ray-casting point-in-ring test. */
function inRing(p: LngLat, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const hit =
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function inPolygon(p: LngLat, geom: Polygon | MultiPolygon): boolean {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const poly of polys) {
    if (!poly.length) continue;
    if (inRing(p, poly[0])) {
      // subtract holes
      const inHole = poly.slice(1).some((h) => inRing(p, h));
      if (!inHole) return true;
    }
  }
  return false;
}

function verticalOf(altFt: number, floorFt: number, ceilFt: number): Vertical {
  if (altFt < floorFt) return "below";
  if (altFt > ceilFt) return "above";
  return "inside";
}

const AHEAD_NM = 25; // look-ahead distance along track
const STEP_NM = 0.5;

export function computeAwareness(
  ship: Ownship,
  features: Poly[],
): Awareness {
  const inside: AirspaceHit[] = [];
  const ahead: AirspaceHit[] = [];

  // Pre-filter to airspaces whose bbox is near the ownship / forward corridor.
  const near = features
    .filter((f) => f.geometry)
    .map((f) => ({ f, bbox: bboxOf(f.geometry) }))
    .filter(({ bbox }) => {
      // ~30 NM padding in degrees (rough; latitude-dependent but fine for filtering)
      const pad = 0.6;
      return (
        ship.pos.lng >= bbox[0] - pad &&
        ship.pos.lng <= bbox[2] + pad &&
        ship.pos.lat >= bbox[1] - pad &&
        ship.pos.lat <= bbox[3] + pad
      );
    });

  const hitFor = (f: Poly, vertical: Vertical): AirspaceHit => {
    const p = f.properties;
    return {
      name: p.name || p.typeName || "Airspace",
      category: p.category,
      class: p.class,
      lower: p.lower,
      upper: p.upper,
      floorFt: parseAltFt(p.lower),
      ceilFt: parseAltFt(p.upper) || UNLIMITED,
      vertical,
    };
  };

  const containingNow = new Set<Poly>();
  for (const { f } of near) {
    if (inPolygon(ship.pos, f.geometry)) {
      containingNow.add(f);
      const floorFt = parseAltFt(f.properties.lower);
      const ceilFt = parseAltFt(f.properties.upper) || UNLIMITED;
      inside.push(hitFor(f, verticalOf(ship.alt, floorFt, ceilFt)));
    }
  }

  // Look ahead: march along the track, first entry distance per airspace.
  const found = new Map<Poly, number>();
  for (let d = STEP_NM; d <= AHEAD_NM; d += STEP_NM) {
    const pt = destination(ship.pos, ship.track, d);
    for (const { f, bbox } of near) {
      if (containingNow.has(f) || found.has(f)) continue;
      if (!inBbox(pt, bbox)) continue;
      if (inPolygon(pt, f.geometry)) found.set(f, distanceNm(ship.pos, pt));
    }
  }
  for (const [f, dist] of found) {
    const floorFt = parseAltFt(f.properties.lower);
    const ceilFt = parseAltFt(f.properties.upper) || UNLIMITED;
    const hit = hitFor(f, verticalOf(ship.alt, floorFt, ceilFt));
    hit.distanceNm = dist;
    hit.etaMin = ship.gs > 1 ? (dist / ship.gs) * 60 : undefined;
    ahead.push(hit);
  }

  inside.sort((a, b) => Number(a.vertical !== "inside") - Number(b.vertical !== "inside"));
  ahead.sort((a, b) => (a.distanceNm ?? 0) - (b.distanceNm ?? 0));
  return { inside, ahead: ahead.slice(0, 5) };
}
