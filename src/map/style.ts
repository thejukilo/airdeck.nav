import type { StyleSpecification } from "maplibre-gl";

export type BaseMap = "plain" | "topo" | "night";

/**
 * Base map styles (free raster, zero keys). The openAIP aeronautical overlay is
 * added on top in layers.ts and stays the same across all bases:
 *   - plain → CARTO Positron: clean, uncluttered — easiest to read in flight.
 *   - topo  → OpenTopoMap: terrain, contours, roads — full chart context.
 *   - night → CARTO dark: low-glare cockpit backdrop.
 */
const RASTER: Record<BaseMap, { tiles: string[]; attribution: string; opacity: number }> = {
  plain: {
    tiles: [
      "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap contributors © CARTO",
    opacity: 1,
  },
  topo: {
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

export function baseStyle(base: BaseMap): StyleSpecification {
  const b = RASTER[base];
  return {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      basemap: { type: "raster", tiles: b.tiles, tileSize: 256, attribution: b.attribution },
    },
    layers: [
      { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": b.opacity } },
    ],
  };
}
