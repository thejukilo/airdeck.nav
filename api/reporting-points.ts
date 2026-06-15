import { parseBbox } from "./_region";

export const config = { runtime: "edge" };

/**
 * VFR reporting points from openAIP (rpp). Returns GeoJSON points with name and
 * whether the point is compulsory. Requires OPENAIP_API_KEY; returns an empty
 * collection without it.
 *
 *   GET /api/reporting-points?bbox=minLng,minLat,maxLng,maxLat
 */
export default async function handler(req: Request): Promise<Response> {
  const key = (globalThis as { process?: { env?: Record<string, string> } }).process
    ?.env?.OPENAIP_API_KEY;
  const [minLng, minLat, maxLng, maxLat] = parseBbox(new URL(req.url));

  const empty = (sMaxAge = 0) =>
    new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
      headers: {
        "content-type": "application/json",
        "cache-control": sMaxAge ? `public, s-maxage=${sMaxAge}` : "no-store",
      },
    });

  if (!key) return empty();

  const api =
    `https://api.core.openaip.net/api/reporting-points` +
    `?bbox=${minLng},${minLat},${maxLng},${maxLat}&limit=1000`;
  try {
    const r = await fetch(api, {
      headers: { "x-openaip-api-key": key, accept: "application/json" },
    });
    if (!r.ok) throw new Error(`openAIP ${r.status}`);
    const data = await r.json();
    const items: Record<string, unknown>[] = data.items ?? (Array.isArray(data) ? data : []);
    const features = items
      .filter((p) => p.geometry)
      .map((p) => ({
        type: "Feature" as const,
        geometry: p.geometry,
        properties: {
          name: p.name ?? "",
          compulsory: Boolean(p.compulsory),
        },
      }));
    return new Response(
      JSON.stringify({ type: "FeatureCollection", source: "openAIP (CC BY-NC 4.0)", features }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch {
    return empty();
  }
}
