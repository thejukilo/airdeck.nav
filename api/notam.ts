export const config = { runtime: "edge" };

/**
 * NOTAM endpoint — intentionally an honest stub.
 *
 * There is no free, redistributable NOTAM feed for Europe: NOTAMs come from
 * EUROCONTROL/EAD (Data User Agreement + member-state royalties) or the FAA
 * NOTAM API (US, registration). Wire a provider via env vars, then implement
 * here. Until then we return supported:false so the UI can be honest rather
 * than show fabricated data.
 */
export default async function handler(): Promise<Response> {
  return new Response(
    JSON.stringify({
      supported: false,
      reason:
        "No free redistributable NOTAM source configured. Requires a EUROCONTROL EAD Data User Agreement (Europe) or the FAA NOTAM API (US).",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, s-maxage=3600",
      },
    },
  );
}
