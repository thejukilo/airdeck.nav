import { parseBbox } from "./_region";

export const config = { runtime: "edge" };

/**
 * Live airport data from OurAirports (CC0 / public domain), filtered to a bbox
 * and returned as GeoJSON with frequencies joined in. Cached hard at the CDN
 * edge — the underlying CSVs change rarely.
 *
 *   GET /api/airports?bbox=minLng,minLat,maxLng,maxLat
 *
 * Note: OurAirports is community-sourced (no accuracy guarantee). Advisory only.
 */
const BASE = "https://davidmegginson.github.io/ourairports-data";

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o: Row = {};
    header.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

function kindOf(type: string): string {
  if (type === "large_airport" || type === "medium_airport") return "intl";
  return "ga";
}

export default async function handler(req: Request): Promise<Response> {
  const [minLng, minLat, maxLng, maxLat] = parseBbox(new URL(req.url));
  try {
    const [aText, fText] = await Promise.all([
      fetch(`${BASE}/airports.csv`).then((r) => r.text()),
      fetch(`${BASE}/airport-frequencies.csv`).then((r) => r.text()),
    ]);

    const airports = parseCsv(aText).filter((a) => {
      if (a.type === "closed" || a.type === "balloonport") return false;
      const lat = Number(a.latitude_deg);
      const lng = Number(a.longitude_deg);
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    });

    const idents = new Set(airports.map((a) => a.ident));
    const freqByIdent = new Map<string, { type: string; mhz: string }[]>();
    for (const f of parseCsv(fText)) {
      if (!idents.has(f.airport_ident)) continue;
      const list = freqByIdent.get(f.airport_ident) ?? [];
      list.push({ type: f.type || f.description, mhz: f.frequency_mhz });
      freqByIdent.set(f.airport_ident, list);
    }

    const features = airports.map((a) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [Number(a.longitude_deg), Number(a.latitude_deg)],
      },
      properties: {
        icao: a.icao_code || a.gps_code || a.ident,
        iata: a.iata_code || undefined,
        name: a.name,
        kind: kindOf(a.type),
        elev_ft: a.elevation_ft ? Number(a.elevation_ft) : null,
        country: a.iso_country,
        link: a.home_link || a.wikipedia_link || undefined,
        freqs: freqByIdent.get(a.ident) ?? [],
      },
    }));

    return new Response(
      JSON.stringify({
        type: "FeatureCollection",
        name: "airports",
        source: "OurAirports (CC0)",
        features,
      }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
