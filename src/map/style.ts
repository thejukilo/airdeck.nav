import type { StyleSpecification } from "maplibre-gl";

export type Theme = "night" | "day";

/**
 * Base map style. We use free raster basemaps so the project runs with zero
 * API keys out of the box:
 *   - night → CARTO dark (muted, low-glare backdrop for chart symbology)
 *   - day   → CARTO Positron (light, high-contrast for daytime)
 *
 * Swap these for a vector basemap + key (MapTiler, Stadia, self-hosted) when
 * you want crisper rendering and rotation-friendly labels.
 */
const RASTER: Record<Theme, string[]> = {
  night: [
    "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  ],
  day: [
    "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
  ],
};

export function baseStyle(theme: Theme): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      basemap: {
        type: "raster",
        tiles: RASTER[theme],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors © CARTO",
      },
    },
    layers: [
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
        paint: { "raster-opacity": theme === "night" ? 0.9 : 1 },
      },
    ],
  };
}
