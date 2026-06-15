import { parseBbox } from "./_region";

export const config = { runtime: "edge" };

/**
 * Live airspace from openAIP (CC BY-NC 4.0 — may ship inside a paid app as
 * long as the data isn't sold standalone; attribution required).
 *
 *   GET /api/airspaces?bbox=minLng,minLat,maxLng,maxLat
 *
 * Requires OPENAIP_API_KEY in the environment (free key from openaip.net).
 * Without it we return an empty collection so the client falls back to the
 * bundled sample.
 */

// openAIP V2 numeric enums (best-effort; values render even if a code is new).
const TYPE_NAME: Record<number, string> = {
  0: "Other", 1: "Restricted", 2: "Danger", 3: "Prohibited", 4: "CTR",
  5: "TMZ", 6: "RMZ", 7: "TMA", 8: "TRA", 9: "TSA", 10: "FIR", 11: "UIR",
  12: "ADIZ", 13: "ATZ", 14: "MATZ", 21: "Gliding", 23: "TIZ", 24: "TIA",
  26: "CTA", 28: "Sporting",
};
const CLASS: Record<number, string> = {
  0: "A", 1: "B", 2: "C", 3: "D", 4: "E", 5: "F", 6: "G", 8: "UNCL",
};
const UNIT: Record<number, string> = { 0: "m", 1: "ft", 6: "FL" };
const DATUM: Record<number, string> = { 0: "GND", 1: "MSL", 2: "STD" };

type Limit = { value?: number; unit?: number | string; referenceDatum?: number | string };

const typeName = (t: unknown): string =>
  typeof t === "string" ? t : TYPE_NAME[t as number] ?? "Airspace";

function category(t: unknown): string {
  const n = (typeof t === "string" ? t : TYPE_NAME[t as number] ?? "").toUpperCase();
  if (["RESTRICTED", "DANGER", "PROHIBITED"].includes(n)) return "restricted";
  if (n === "CTR") return "ctr";
  if (["TMA", "CTA", "TIA", "FIR", "UIR"].includes(n)) return "tma";
  return "other";
}

const icaoClass = (c: unknown): string =>
  typeof c === "string" ? c : CLASS[c as number] ?? "";

function fmtLimit(l: Limit | string | undefined): string {
  if (!l) return "";
  if (typeof l === "string") return l;
  const unit = typeof l.unit === "string" ? l.unit : UNIT[l.unit as number] ?? "ft";
  const datum =
    typeof l.referenceDatum === "string"
      ? l.referenceDatum
      : DATUM[l.referenceDatum as number] ?? "";
  const v = l.value ?? 0;
  if (unit === "FL") return `FL${v}`;
  if (v === 0 && datum === "GND") return "GND";
  return `${v} ${unit}${datum ? ` ${datum}` : ""}`;
}

function json(body: unknown, sMaxAge = 0, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": sMaxAge
        ? `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}`
        : "no-store",
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const key = (globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.OPENAIP_API_KEY;
  const [minLng, minLat, maxLng, maxLat] = parseBbox(new URL(req.url));

  if (!key) {
    return json({
      type: "FeatureCollection",
      features: [],
      note: "Set OPENAIP_API_KEY to enable live airspace.",
    });
  }

  const api =
    `https://api.core.openaip.net/api/airspaces` +
    `?bbox=${minLng},${minLat},${maxLng},${maxLat}&limit=1000`;
  try {
    const r = await fetch(api, {
      headers: { "x-openaip-api-key": key, accept: "application/json" },
    });
    if (!r.ok) throw new Error(`openAIP ${r.status}`);
    const data = await r.json();
    const items: Record<string, unknown>[] = data.items ?? (Array.isArray(data) ? data : []);
    const features = items
      .filter((a) => a.geometry)
      .map((a) => ({
        type: "Feature" as const,
        geometry: a.geometry,
        properties: {
          name: a.name,
          category: category(a.type),
          typeName: typeName(a.type),
          class: icaoClass(a.icaoClass),
          lower: fmtLimit(a.lowerLimit as Limit),
          upper: fmtLimit(a.upperLimit as Limit),
        },
      }));
    return json(
      { type: "FeatureCollection", source: "openAIP (CC BY-NC 4.0)", features },
      86400,
    );
  } catch (err) {
    return json({ error: String(err), type: "FeatureCollection", features: [] }, 0, 502);
  }
}
