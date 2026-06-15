/**
 * Live weather (METAR) via the /api/metar function. Normalizes the AWC JSON
 * into a slim shape and derives a VFR/MVFR/IFR/LIFR flight category.
 */
import { bboxParam, DEFAULT_BBOX } from "./region";

/** A single sampled point in the gridded wind field. */
export interface WindPoint {
  lng: number;
  lat: number;
  /** Direction the wind blows FROM, degrees true. */
  windDir: number;
  windKt: number;
}

interface WindFeature {
  geometry: { coordinates: [number, number] };
  properties: { windDir: number; windKt: number };
}

export async function fetchWindField(
  bbox: [number, number, number, number] = DEFAULT_BBOX,
): Promise<WindPoint[]> {
  try {
    const res = await fetch(`/api/wind?bbox=${bboxParam(bbox)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: WindFeature[] };
    return (data.features ?? []).map((f) => ({
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      windDir: f.properties.windDir,
      windKt: f.properties.windKt,
    }));
  } catch {
    return [];
  }
}

export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKN";

export interface Metar {
  icao: string;
  name: string;
  lng: number;
  lat: number;
  /** Wind direction the wind blows FROM, degrees true. null = calm/variable. */
  windDir: number | null;
  windVrb: boolean;
  windKt: number;
  gustKt: number | null;
  visibSm: number | null;
  ceilingFt: number | null;
  tempC: number | null;
  dewpC: number | null;
  qnhHpa: number | null;
  category: FlightCategory;
  raw: string;
  observed: string;
}

interface AwcMetar {
  icaoId?: string;
  name?: string;
  lat?: number;
  lon?: number;
  wdir?: number | string;
  wspd?: number;
  wgst?: number | null;
  visib?: number | string;
  altim?: number;
  temp?: number;
  dewp?: number;
  rawOb?: string;
  reportTime?: string;
  clouds?: { cover?: string; base?: number | null }[];
}

function ceiling(clouds: AwcMetar["clouds"]): number | null {
  if (!clouds) return null;
  const bases = clouds
    .filter((c) => c.cover === "BKN" || c.cover === "OVC" || c.cover === "OVX")
    .map((c) => c.base)
    .filter((b): b is number => typeof b === "number");
  return bases.length ? Math.min(...bases) : null;
}

function categorize(visibSm: number | null, ceilingFt: number | null): FlightCategory {
  if (visibSm == null && ceilingFt == null) return "UNKN";
  const v = visibSm ?? 99;
  const c = ceilingFt ?? 99999;
  if (v < 1 || c < 500) return "LIFR";
  if (v < 3 || c < 1000) return "IFR";
  if (v <= 5 || c <= 3000) return "MVFR";
  return "VFR";
}

export const CATEGORY_COLOR: Record<FlightCategory, string> = {
  VFR: "#33d17a",
  MVFR: "#4aa3ff",
  IFR: "#ff5d5d",
  LIFR: "#ff4fd8",
  UNKN: "#8aa0b2",
};

export async function fetchMetars(
  bbox: [number, number, number, number] = DEFAULT_BBOX,
): Promise<Metar[]> {
  try {
    const res = await fetch(`/api/metar?bbox=${bboxParam(bbox)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as AwcMetar[] | { error: string };
    if (!Array.isArray(data)) return [];
    return data
      .filter((m) => typeof m.lat === "number" && typeof m.lon === "number")
      .map((m): Metar => {
        const visibSm =
          typeof m.visib === "number"
            ? m.visib
            : typeof m.visib === "string"
              ? parseFloat(m.visib) // "10+" -> 10
              : null;
        const ceilingFt = ceiling(m.clouds);
        const dir = typeof m.wdir === "number" ? m.wdir : null;
        return {
          icao: m.icaoId ?? "",
          name: m.name ?? m.icaoId ?? "",
          lng: m.lon!,
          lat: m.lat!,
          windDir: dir,
          windVrb: m.wdir === "VRB",
          windKt: m.wspd ?? 0,
          gustKt: m.wgst ?? null,
          visibSm: Number.isFinite(visibSm) ? visibSm : null,
          ceilingFt,
          tempC: m.temp ?? null,
          dewpC: m.dewp ?? null,
          qnhHpa: m.altim ?? null,
          category: categorize(Number.isFinite(visibSm) ? visibSm : null, ceilingFt),
          raw: m.rawOb ?? "",
          observed: m.reportTime ?? "",
        };
      });
  } catch {
    return [];
  }
}
