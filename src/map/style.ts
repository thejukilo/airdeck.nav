import type { StyleSpecification } from "maplibre-gl";

export type Theme = "night" | "day";

/**
 * Base map style. Free raster basemaps, zero API keys:
 *   - day   → OpenTopoMap (terrain, contours, roads, water) — a chart-like base
 *             to sit the openAIP aeronautical overlay on top of.
 *   - night → CARTO dark (low-glare backdrop for the cockpit).
 *
 * The openAIP rendered overlay (airspace bands, navaids, reporting points) is
 * added as a separate raster layer in layers.ts.
 */
const RASTER: Record<Theme, { tiles: string[]; attribution: string; opacity: number }> = {
  day: {
    tiles: [
      "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors",
    opacity: 1,
  },
  night: {
    tiles: [
      "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap contributors © CARTO",
    opacity: 0.9,
  },
};

export function baseStyle(theme: Theme): StyleSpecification {
  const b = RASTER[theme];
  return {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      basemap: {
        type: "raster",
        tiles: b.tiles,
        tileSize: 256,
        attribution: b.attribution,
      },
    },
    layers: [
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
        paint: { "raster-opacity": b.opacity },
      },
    ],
  };
}
