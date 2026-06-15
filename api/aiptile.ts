export const config = { runtime: "edge" };

/**
 * Proxies openAIP rendered map tiles so the API key stays server-side (never in
 * the client bundle or repo). MapLibre requests /api/aiptile?z=&x=&y=.
 *
 * Layer defaults to the full "openaip" overlay (airspace + navaids + airports +
 * reporting points, transparent over a base map). Override with the
 * OPENAIP_TILE_LAYER env var (e.g. "airspaces").
 */
export default async function handler(req: Request): Promise<Response> {
  const env =
    (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
  const key = env.OPENAIP_API_KEY;
  const layer = env.OPENAIP_TILE_LAYER || "openaip";

  const u = new URL(req.url);
  const z = u.searchParams.get("z");
  const x = u.searchParams.get("x");
  const y = u.searchParams.get("y");

  // Transparent 1×1 PNG fallback when the key/tile is missing, so the map
  // simply shows the base layer instead of broken tiles.
  if (!key || z == null || x == null || y == null) {
    return transparentTile(key ? 400 : 200);
  }

  const upstream = `https://api.tiles.openaip.net/api/data/${layer}/${z}/${x}/${y}.png?apiKey=${key}`;
  try {
    const r = await fetch(upstream);
    if (!r.ok) return transparentTile(200);
    return new Response(r.body, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return transparentTile(200);
  }
}

const TRANSPARENT_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

function transparentTile(status: number): Response {
  return new Response(TRANSPARENT_PNG, {
    status,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, s-maxage=60",
    },
  });
}
