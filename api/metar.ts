import { parseBbox } from "./_region";

export const config = { runtime: "edge" };

/**
 * Live METAR (wind, visibility, cloud, temp, QNH) for the requested bbox.
 *
 *   GET /api/metar?bbox=minLng,minLat,maxLng,maxLat
 *
 * Source: aviationweather.gov (US NWS/AWC) — public domain, global METAR
 * coverage, clean JSON API, no key. For European authoritative weather, DWD
 * open data (opendata.dwd.de, free under GeoNutzV) is the alternative source.
 */
export default async function handler(req: Request): Promise<Response> {
  const [minLng, minLat, maxLng, maxLat] = parseBbox(new URL(req.url));
  // AWC bbox order is minLat,minLon,maxLat,maxLon.
  const awc = `https://aviationweather.gov/api/data/metar?format=json&bbox=${minLat},${minLng},${maxLat},${maxLng}`;
  try {
    const r = await fetch(awc, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`AWC ${r.status}`);
    const body = await r.text();
    return new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
