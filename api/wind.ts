import { parseBbox } from "./_region";

export const config = { runtime: "edge" };

/**
 * Gridded wind field from Open-Meteo (free, no key, CC-BY, commercial OK).
 * Samples a grid across the bbox so the map shows a dense wind arrow field —
 * unlike METAR, which only exists at reporting stations.
 *
 *   GET /api/wind?bbox=minLng,minLat,maxLng,maxLat&cols=12&rows=9
 */
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const [minLng, minLat, maxLng, maxLat] = parseBbox(url);
  const cols = clamp(Number(url.searchParams.get("cols")) || 12, 2, 20);
  const rows = clamp(Number(url.searchParams.get("rows")) || 9, 2, 20);

  const lats: number[] = [];
  const lngs: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      lats.push(minLat + ((maxLat - minLat) * r) / (rows - 1));
      lngs.push(minLng + ((maxLng - minLng) * c) / (cols - 1));
    }
  }

  const api =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}` +
    `&longitude=${lngs.join(",")}` +
    `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn`;

  try {
    const r = await fetch(api, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const data = await r.json();
    const list = Array.isArray(data) ? data : [data];
    const features = list
      .filter((d) => d?.current)
      .map((d) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [d.longitude, d.latitude] },
        properties: {
          windDir: Math.round(d.current.wind_direction_10m),
          windKt: Math.round(d.current.wind_speed_10m),
        },
      }));
    return new Response(
      JSON.stringify({ type: "FeatureCollection", name: "windfield", features }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, s-maxage=900, stale-while-revalidate=1800",
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
