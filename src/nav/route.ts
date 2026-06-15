/**
 * Route planning (v1): direct route A→B with a recommended cruise altitude
 * chosen to minimise airspace conflicts, plus the list of controlled/restricted
 * airspace still crossed at that altitude.
 *
 * "Shortest" here is the direct great-circle leg; lateral avoidance routing
 * (bending around restricted zones) is a planned follow-up. What this already
 * optimises is the *altitude* — a single cruise level that keeps you clear of
 * as much airspace as possible, minimising climbs/descents en route.
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
  /** controlled/restricted airspace still crossed at the recommended altitude */
  crossings: RouteCrossing[];
  line: FeatureCollection<LineString>;
}

type Poly = Feature<Polygon | MultiPolygon, AirspaceProps>;

// Penalty weight per airspace category (others are not restrictions).
const WEIGHT: Record<string, number> = {
  prohibited: 12,
  restricted: 10,
  danger: 10,
  ctr: 3,
  tma: 2,
  rmz: 1,
};

const MAX_ALT = 9500; // top of the VFR band we evaluate
const UNLIMITED = 99999;

/** Candidate VFR cruise altitudes (ft), at or above the chosen minimum. */
function candidateAlts(minFt: number): number[] {
  const start = Math.max(0, Math.round(minFt / 500) * 500);
  const alts: number[] = [];
  for (let a = start; a <= Math.max(start, MAX_ALT); a += 500) alts.push(a);
  return alts;
}

interface Crossed {
  props: AirspaceProps;
  floorFt: number;
  ceilFt: number;
  weight: number;
}

export function planRoute(
  from: Waypoint,
  to: Waypoint,
  airspaces: Poly[],
  minAltFt = 1500,
): RoutePlan {
  const distanceNmVal = distanceNm(from, to);
  const brg = bearingDeg(from, to);

  // Sample points along the (straight) leg.
  const n = Math.min(300, Math.max(24, Math.round(distanceNmVal)));
  const samples: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    samples.push({
      lng: from.lng + (to.lng - from.lng) * t,
      lat: from.lat + (to.lat - from.lat) * t,
    });
  }

  // Which relevant airspaces does the leg pass through horizontally?
  const crossed: Crossed[] = [];
  for (const f of airspaces) {
    const w = WEIGHT[f.properties.category];
    if (!w || !f.geometry) continue;
    if (samples.some((p) => inPolygon(p, f.geometry))) {
      crossed.push({
        props: f.properties,
        floorFt: parseAltFt(f.properties.lower),
        ceilFt: parseAltFt(f.properties.upper) || UNLIMITED,
        weight: w,
      });
    }
  }

  // Pick the altitude (at/above the minimum) with the least total penalty
  // (tie → lowest altitude).
  const alts = candidateAlts(minAltFt);
  let recommendedAltFt = alts[0];
  let bestScore = Infinity;
  for (const alt of alts) {
    const score = crossed.reduce(
      (s, c) => (alt >= c.floorFt && alt <= c.ceilFt ? s + c.weight : s),
      0,
    );
    if (score < bestScore) {
      bestScore = score;
      recommendedAltFt = alt;
    }
  }

  const crossings: RouteCrossing[] = crossed
    .filter((c) => recommendedAltFt >= c.floorFt && recommendedAltFt <= c.ceilFt)
    .sort((a, b) => b.weight - a.weight)
    .map((c) => ({
      name: c.props.name || c.props.typeName || "Airspace",
      category: c.props.category,
      class: c.props.class,
      lower: c.props.lower,
      upper: c.props.upper,
    }));

  return {
    from,
    to,
    distanceNm: distanceNmVal,
    bearingDeg: brg,
    recommendedAltFt,
    crossings,
    line: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [from.lng, from.lat],
              [to.lng, to.lat],
            ],
          },
        },
      ],
    },
  };
}
