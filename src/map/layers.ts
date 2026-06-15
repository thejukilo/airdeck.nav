import type { Map as MlMap, ExpressionSpecification } from "maplibre-gl";
import type { AeroData } from "../data/aero";

/**
 * Adds the aeronautical overlay (airspace fills/outlines, airports, navaids)
 * plus the ownship symbol on top of the base map. Idempotent-ish: call once
 * after the style loads.
 */

// Airspace fill color keyed by category.
const airspaceColor: ExpressionSpecification = [
  "match",
  ["get", "category"],
  "ctr",
  "#ff7a7a",
  "tma",
  "#7aa7ff",
  "restricted",
  "#ff5d5d",
  "danger",
  "#ffb454",
  "#9aa7b3",
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

  // --- Airspace -----------------------------------------------------------
  map.addLayer({
    id: "airspaces-fill",
    type: "fill",
    source: "airspaces",
    paint: {
      "fill-color": airspaceColor,
      "fill-opacity": ["case", ["==", ["get", "category"], "tma"], 0.06, 0.12],
    },
  });
  map.addLayer({
    id: "airspaces-line",
    type: "line",
    source: "airspaces",
    paint: {
      "line-color": airspaceColor,
      "line-width": 1.5,
      "line-dasharray": ["case", ["==", ["get", "category"], "restricted"], ["literal", [2, 1.5]], ["literal", [1, 0]]],
    },
  });
  map.addLayer({
    id: "airspaces-label",
    type: "symbol",
    source: "airspaces",
    layout: {
      "text-field": ["concat", ["get", "name"], "\n", ["get", "lower"], "–", ["get", "upper"]],
      "text-size": 11,
      "text-font": ["Noto Sans Regular"],
      "text-anchor": "center",
      "symbol-placement": "point",
    },
    paint: {
      "text-color": airspaceColor,
      "text-halo-color": "rgba(11,22,34,0.85)",
      "text-halo-width": 1.5,
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

  // --- Navaids ------------------------------------------------------------
  map.addLayer({
    id: "navaids-symbol",
    type: "circle",
    source: "navaids",
    paint: {
      "circle-radius": 5,
      "circle-color": "#c08cff",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1,
    },
  });
  map.addLayer({
    id: "navaids-label",
    type: "symbol",
    source: "navaids",
    layout: {
      "text-field": ["get", "ident"],
      "text-size": 11,
      "text-font": ["Noto Sans Bold"],
      "text-offset": [0, 1.1],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#d8c4ff",
      "text-halo-color": "rgba(11,22,34,0.85)",
      "text-halo-width": 1.4,
    },
    minzoom: 7,
  });

  // --- Airports -----------------------------------------------------------
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
  map.addLayer({
    id: "weather-wind",
    type: "symbol",
    source: "weather",
    // Arrow flies downwind (windDir is the FROM direction, so + 180).
    filter: ["has", "windDir"],
    layout: {
      "icon-image": "wind-arrow",
      "icon-size": 0.9,
      "icon-rotate": ["+", ["get", "windDir"], 180],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
    },
  });
  map.addLayer({
    id: "weather-label",
    type: "symbol",
    source: "weather",
    layout: {
      "text-field": ["concat", ["to-string", ["round", ["get", "windKt"]]], " kt"],
      "text-size": 11,
      "text-font": ["Noto Sans Bold"],
      "text-offset": [0, 1.3],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#cfe8d8",
      "text-halo-color": "rgba(11,22,34,0.85)",
      "text-halo-width": 1.4,
    },
    minzoom: 7,
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
  airspaces: ["airspaces-fill", "airspaces-line", "airspaces-label"],
  airports: ["airports-symbol", "airports-label"],
  navaids: ["navaids-symbol", "navaids-label"],
  weather: ["weather-circle", "weather-wind", "weather-label"],
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

/** A slim wind arrow (points "up" at 0°; rotated per-feature by the layer). */
export function makeWindArrowImage(): ImageData {
  const size = 40;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath(); // shaft
  ctx.moveTo(0, 14);
  ctx.lineTo(0, -10);
  ctx.stroke();
  ctx.beginPath(); // head
  ctx.moveTo(0, -15);
  ctx.lineTo(6, -6);
  ctx.lineTo(-6, -6);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}
