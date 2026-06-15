import type { Map as MlMap, ExpressionSpecification } from "maplibre-gl";
import type { AeroData } from "../data/aero";

/**
 * Adds the aeronautical overlay (airspace fills/outlines, airports, navaids)
 * plus the ownship symbol on top of the base map. Idempotent-ish: call once
 * after the style loads.
 */

// Airspace color keyed by category.
const airspaceColor: ExpressionSpecification = [
  "match",
  ["get", "category"],
  "restricted", "#e23030",
  "danger", "#e07b00",
  "prohibited", "#c01010",
  "ctr", "#c026d3",
  "tma", "#2563eb",
  "rmz", "#0e9aa7",
  "#7a8a99",
];

export function addAeroLayers(map: MlMap, data: AeroData) {
  map.addSource("airspaces", { type: "geojson", data: data.airspaces });
  map.addSource("airports", { type: "geojson", data: data.airports });
  map.addSource("navaids", { type: "geojson", data: data.navaids });
  map.addSource("ownship", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("route", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("weather", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("windfield", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addSource("reporting", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // --- openAIP rendered chart overlay (airspace bands, navaids, reporting
  //     points, airports) on top of the topo base. Proxied to keep the key
  //     server-side. This is the layer that gives the real VFR-chart look. ---
  map.addSource("aipchart", {
    type: "raster",
    tiles: ["/api/aiptile?z={z}&x={x}&y={y}"],
    tileSize: 256,
    attribution: "© openAIP",
  });
  map.addLayer({ id: "aipchart", type: "raster", source: "aipchart" });

  // --- Airspace (geometry from openAIP; kept as a near-invisible click target
  //     so taps still surface details — the visuals come from the overlay). --
  map.addLayer({
    id: "airspaces-fill",
    type: "fill",
    source: "airspaces",
    paint: {
      "fill-color": airspaceColor,
      "fill-opacity": [
        "match",
        ["get", "category"],
        "restricted", 0.14,
        "danger", 0.12,
        "prohibited", 0.18,
        "ctr", 0.07,
        "tma", 0.05,
        0.0,
      ],
    },
  });
  // Bright highlight for the airspace(s) the ownship is currently inside.
  map.addLayer({
    id: "airspaces-active",
    type: "line",
    source: "airspaces",
    filter: ["in", ["get", "name"], ["literal", []]],
    paint: { "line-color": "#ffd23f", "line-width": 3, "line-opacity": 0.95 },
  });
  // Large, legible altitude-band label inside each restriction/controlled area.
  map.addLayer({
    id: "airspaces-restrict-label",
    type: "symbol",
    source: "airspaces",
    filter: [
      "in",
      ["get", "category"],
      ["literal", ["restricted", "danger", "prohibited", "ctr", "tma"]],
    ],
    layout: {
      "symbol-placement": "point",
      "text-field": [
        "format",
        ["get", "name"], { "font-scale": 0.82 },
        "\n", {},
        ["concat", ["get", "lower"], " – ", ["get", "upper"]], { "font-scale": 1.15 },
      ],
      "text-font": ["Noto Sans Bold"],
      "text-size": 13,
      "text-line-height": 1.3,
      "text-padding": 4,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": airspaceColor,
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
      "text-halo-blur": 0.5,
    },
    minzoom: 8,
  });

  // --- Route (built by flight planner; empty for now) ---------------------
  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ff4fd8", "line-width": 3, "line-opacity": 0.9 },
  });

  // Navaids + reporting points are drawn by the openAIP overlay above.

  // --- Airports (OurAirports — kept clickable for frequencies/runways) -----
  map.addLayer({
    id: "airports-symbol",
    type: "circle",
    source: "airports",
    paint: {
      "circle-radius": ["case", ["==", ["get", "kind"], "intl"], 7, 5],
      "circle-color": ["case", ["==", ["get", "kind"], "intl"], "#34d1bf", "#1f9e90"],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
    },
  });
  map.addLayer({
    id: "airports-label",
    type: "symbol",
    source: "airports",
    layout: {
      "text-field": ["get", "icao"],
      "text-size": 12,
      "text-font": ["Noto Sans Bold"],
      "text-offset": [0, 1.2],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#a9f0e6",
      "text-halo-color": "rgba(11,22,34,0.85)",
      "text-halo-width": 1.4,
    },
    minzoom: 6,
  });

  // --- VFR reporting points (openAIP rpp) ---------------------------------
  map.addLayer({
    id: "reporting-symbol",
    type: "circle",
    source: "reporting",
    paint: {
      "circle-radius": 5,
      // Compulsory points filled; on-request points hollow.
      "circle-color": ["case", ["get", "compulsory"], "#d24bd2", "rgba(210,75,210,0.15)"],
      "circle-stroke-color": "#d24bd2",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "reporting-label",
    type: "symbol",
    source: "reporting",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-font": ["Noto Sans Bold"],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#a02ea0",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.6,
    },
    minzoom: 8,
  });

  // --- Weather (live METAR: wind + flight category) -----------------------
  const catColor: ExpressionSpecification = [
    "match",
    ["get", "category"],
    "VFR",
    "#33d17a",
    "MVFR",
    "#4aa3ff",
    "IFR",
    "#ff5d5d",
    "LIFR",
    "#ff4fd8",
    "#8aa0b2",
  ];
  map.addLayer({
    id: "weather-circle",
    type: "circle",
    source: "weather",
    paint: {
      "circle-radius": 6,
      "circle-color": catColor,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9,
    },
  });

  // --- Wind field (gridded model wind: dense arrows + speed) --------------
  map.addLayer({
    id: "windfield-arrow",
    type: "symbol",
    source: "windfield",
    // Arrow flies downwind (windDir is the FROM direction, so + 180).
    layout: {
      "icon-image": "wind-arrow",
      "icon-size": 1,
      "icon-rotate": ["+", ["get", "windDir"], 180],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
  map.addLayer({
    id: "windfield-label",
    type: "symbol",
    source: "windfield",
    layout: {
      "text-field": ["to-string", ["get", "windKt"]],
      "text-size": 11,
      "text-font": ["Noto Sans Bold"],
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#e8f1f8",
      "text-halo-color": "rgba(11,22,34,0.92)",
      "text-halo-width": 1.6,
    },
  });

  // --- Ownship ------------------------------------------------------------
  map.addLayer({
    id: "ownship-symbol",
    type: "symbol",
    source: "ownship",
    layout: {
      "icon-image": "ownship-arrow",
      "icon-size": 1,
      "icon-rotate": ["get", "track"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
}

const AERO_LAYER_IDS: Record<string, string[]> = {
  chart: ["aipchart"],
  restrictions: ["airspaces-fill", "airspaces-active", "airspaces-restrict-label"],
  reporting: ["reporting-symbol", "reporting-label"],
  airports: ["airports-symbol", "airports-label"],
  weather: ["weather-circle"],
  wind: ["windfield-arrow", "windfield-label"],
};

export function setLayerVisible(map: MlMap, layerId: string, visible: boolean) {
  for (const id of AERO_LAYER_IDS[layerId] ?? []) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

/** A triangular ownship arrow drawn to an offscreen canvas for the symbol. */
export function makeOwnshipImage(): ImageData {
  const size = 48;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(12, 16);
  ctx.lineTo(0, 9);
  ctx.lineTo(-12, 16);
  ctx.closePath();
  ctx.fillStyle = "#ffd23f";
  ctx.strokeStyle = "#0b1622";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/**
 * A wind arrow (points "up" at 0°; rotated per-feature). Drawn as a filled
 * shape with a dark outline so it stays legible over both the night and day
 * basemaps.
 */
export function makeWindArrowImage(): ImageData {
  const size = 48;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  ctx.lineJoin = "round";
  // Single arrow outline: head (chevron) + shaft, drawn as one stroked+filled path.
  ctx.beginPath();
  ctx.moveTo(0, -18); // tip
  ctx.lineTo(8, -7);
  ctx.lineTo(2.6, -7);
  ctx.lineTo(2.6, 17); // shaft right
  ctx.lineTo(-2.6, 17); // shaft left
  ctx.lineTo(-2.6, -7);
  ctx.lineTo(-8, -7);
  ctx.closePath();
  ctx.fillStyle = "#7fd0ff";
  ctx.fill();
  ctx.strokeStyle = "#0b1622";
  ctx.lineWidth = 2;
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}
