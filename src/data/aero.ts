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
  name: string;
  kind: AirportKind;
  elev_ft: number;
  runways: { ident: string; len_m: number; surface: string }[];
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

export async function loadAeroData(): Promise<AeroData> {
  const [airports, navaids, airspaces] = await Promise.all([
    load<AeroData["airports"]>("/data/airports.geojson"),
    load<AeroData["navaids"]>("/data/navaids.geojson"),
    load<AeroData["airspaces"]>("/data/airspaces.geojson"),
  ]);
  return { airports, navaids, airspaces };
}

/** Layers the user can toggle, with the swatch color shown in the UI. */
export const LAYER_DEFS = [
  { id: "airspaces", label: "Airspace", color: "#7aa7ff" },
  { id: "airports", label: "Airports", color: "#34d1bf" },
  { id: "navaids", label: "Navaids", color: "#c08cff" },
] as const;

export type LayerId = (typeof LAYER_DEFS)[number]["id"];
