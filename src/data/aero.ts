/**
 * Aeronautical data model + loader.
 *
 * The shapes here mirror the GeoJSON in /public/data. Keeping a thin typed
 * layer means we can later swap the static files for a live source (OpenAIP,
 * a tile server, an offline-synced DB) without touching the map/UI code.
 */
import type { FeatureCollection, Point, Polygon } from "geojson";

export type AirspaceCategory = "ctr" | "tma" | "restricted" | "danger" | "other";
export type AirportKind = "intl" | "ga";

export interface AirportProps {
  icao: string;
  iata?: string;
  name: string;
  kind: AirportKind;
  elev_ft: number | null;
  country?: string;
  link?: string;
  runways?: { ident: string; len_m: number; surface: string }[];
  freqs: { type: string; mhz: string }[];
}

export interface NavaidProps {
  ident: string;
  name: string;
  type: string;
  mhz: string;
}

export interface AirspaceProps {
  name: string;
  category: AirspaceCategory;
  typeName?: string;
  class: string;
  lower: string;
  upper: string;
}

export interface AeroData {
  airports: FeatureCollection<Point, AirportProps>;
  navaids: FeatureCollection<Point, NavaidProps>;
  airspaces: FeatureCollection<Polygon, AirspaceProps>;
}

async function load<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Airports come from the live /api/airports function (OurAirports, CC0). When
 * that isn't reachable — local `vite` dev, or offline — we fall back to the
 * bundled sample so the map is never empty.
 */
async function loadAirports(
  bbox: [number, number, number, number],
): Promise<AeroData["airports"]> {
  try {
    const res = await fetch(`/api/airports?bbox=${bbox.join(",")}`);
    if (res.ok) {
      const fc = (await res.json()) as AeroData["airports"];
      if (fc.features?.length) return fc;
    }
  } catch {
    /* fall through to bundled sample */
  }
  return load<AeroData["airports"]>("/data/airports.geojson");
}

/**
 * Airspace comes from the live /api/airspaces function (openAIP). Falls back to
 * the bundled sample when the API key isn't set or the call fails.
 */
async function loadAirspaces(
  bbox: [number, number, number, number],
): Promise<AeroData["airspaces"]> {
  try {
    const res = await fetch(`/api/airspaces?bbox=${bbox.join(",")}`);
    if (res.ok) {
      const fc = (await res.json()) as AeroData["airspaces"];
      if (fc.features?.length) return fc;
    }
  } catch {
    /* fall through to bundled sample */
  }
  return load<AeroData["airspaces"]>("/data/airspaces.geojson");
}

export async function loadAeroData(
  bbox: [number, number, number, number],
): Promise<AeroData> {
  const [airports, navaids, airspaces] = await Promise.all([
    loadAirports(bbox),
    // Navaids are a bundled sample for now.
    load<AeroData["navaids"]>("/data/navaids.geojson"),
    loadAirspaces(bbox),
  ]);
  return { airports, navaids, airspaces };
}

/** Layers the user can toggle, with the swatch color shown in the UI. */
export const LAYER_DEFS = [
  { id: "chart", label: "Aero chart", color: "#7aa7ff" },
  { id: "wind", label: "Wind", color: "#7fd0ff" },
  { id: "weather", label: "Airport weather", color: "#33d17a" },
  { id: "airports", label: "Airports", color: "#34d1bf" },
] as const;

export type LayerId = (typeof LAYER_DEFS)[number]["id"];
