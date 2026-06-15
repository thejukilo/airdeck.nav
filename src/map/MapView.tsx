import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, LineString } from "geojson";
import { baseStyle, type BaseMap } from "./style";
import {
  addAeroLayers,
  makeOwnshipImage,
  makeWindArrowImage,
  setLayerVisible,
} from "./layers";
import { loadAeroData } from "../data/aero";
import { DEFAULT_BBOX } from "../data/region";
import type { Ownship } from "../nav/useOwnship";
import type { AeroData, LayerId, ReportingPoints } from "../data/aero";
import type { Metar, WindPoint } from "../data/weather";

export interface SelectedFeature {
  kind: "airport" | "navaid" | "airspace" | "weather" | "reporting";
  properties: Record<string, unknown>;
  lngLat?: { lng: number; lat: number };
}

export interface MapHandle {
  recenter: (ship: Ownship | null) => void;
  resetNorth: () => void;
  getCenter: () => { lng: number; lat: number } | null;
}

interface Props {
  basemap: BaseMap;
  ownship: Ownship | null;
  metars: Metar[];
  windField: WindPoint[];
  airspaces: AeroData["airspaces"];
  reportingPoints: ReportingPoints;
  route: FeatureCollection<LineString>;
  layersVisible: Record<LayerId, boolean>;
  follow: boolean;
  /** names of airspaces the ownship is currently inside (highlighted) */
  activeAirspaces: string[];
  onSelect: (f: SelectedFeature | null) => void;
}

const QUERY_LAYERS = [
  "airports-symbol",
  "reporting-symbol",
  "weather-circle",
  "airspaces-fill",
] as const;

function imagesFor(map: MlMap) {
  if (!map.getImage("ownship-arrow")) {
    map.addImage("ownship-arrow", makeOwnshipImage(), { pixelRatio: 2 });
  }
  if (!map.getImage("wind-arrow")) {
    map.addImage("wind-arrow", makeWindArrowImage(), { pixelRatio: 2 });
  }
}

function MapViewInner(
  {
    basemap,
    ownship,
    metars,
    windField,
    airspaces,
    reportingPoints,
    route,
    layersVisible,
    follow,
    activeAirspaces,
    onSelect,
  }: Props,
  ref: Ref<MapHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);

  useImperativeHandle(ref, () => ({
    recenter: (ship) => {
      if (mapRef.current && ship) {
        mapRef.current.easeTo({ center: [ship.pos.lng, ship.pos.lat], duration: 500 });
      }
    },
    resetNorth: () => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 }),
    getCenter: () => {
      const c = mapRef.current?.getCenter();
      return c ? { lng: c.lng, lat: c.lat } : null;
    },
  }));

  // --- Init (once) --------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(basemap),
      center: [5.2, 52.4],
      zoom: 8.5,
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    map.touchZoomRotate.enableRotation();

    map.on("load", async () => {
      imagesFor(map);
      try {
        const data = await loadAeroData(DEFAULT_BBOX);
        addAeroLayers(map, data);
        readyRef.current = true;
        // Apply any state that changed before load finished.
        applyVisibility();
        applyActive();
        pushAirspaces();
        pushReporting();
        pushRoute();
        pushMetars();
        pushWindField();
      } catch (err) {
        console.error("Failed to load aeronautical data", err);
      }
    });

    // Feature selection on tap.
    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: QUERY_LAYERS.filter((l) => map.getLayer(l)),
      });
      if (!hits.length) {
        onSelect(null);
        return;
      }
      const f = hits[0];
      const kind: SelectedFeature["kind"] =
        f.layer.id === "airports-symbol"
          ? "airport"
          : f.layer.id === "navaids-symbol"
            ? "navaid"
            : f.layer.id === "weather-circle"
              ? "weather"
              : f.layer.id === "reporting-symbol"
                ? "reporting"
                : "airspace";
      const lngLat =
        f.geometry.type === "Point"
          ? { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }
          : undefined;
      onSelect({ kind, properties: f.properties ?? {}, lngLat });
    });

    const setCursor = (c: string) => () => (map.getCanvas().style.cursor = c);
    for (const l of QUERY_LAYERS) {
      map.on("mouseenter", l, setCursor("pointer"));
      map.on("mouseleave", l, setCursor(""));
    }

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Base map switches restyle the base; re-add aero layers afterward. --
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    readyRef.current = false;
    map.setStyle(baseStyle(basemap));
    map.once("styledata", async () => {
      imagesFor(map);
      try {
        const data = await loadAeroData(DEFAULT_BBOX);
        addAeroLayers(map, data);
        readyRef.current = true;
        applyVisibility();
        applyActive();
        pushAirspaces();
        pushReporting();
        pushRoute();
        pushOwnship();
        pushMetars();
        pushWindField();
      } catch (err) {
        console.error(err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // --- Highlight the airspace(s) the ownship is inside --------------------
  function applyActive() {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.getLayer("airspaces-active")) return;
    map.setFilter("airspaces-active", [
      "in",
      ["get", "name"],
      ["literal", activeAirspaces],
    ]);
  }
  useEffect(applyActive, [activeAirspaces]);

  // --- Layer visibility ---------------------------------------------------
  function applyVisibility() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const [id, vis] of Object.entries(layersVisible)) {
      setLayerVisible(map, id, vis);
    }
  }
  useEffect(applyVisibility, [layersVisible]);

  // --- Ownship position ---------------------------------------------------
  function pushOwnship() {
    const map = mapRef.current;
    if (!map || !readyRef.current || !ownship) return;
    const src = map.getSource("ownship") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [ownship.pos.lng, ownship.pos.lat] },
          properties: { track: ownship.track },
        },
      ],
    });
    if (follow) {
      map.easeTo({
        center: [ownship.pos.lng, ownship.pos.lat],
        duration: 250,
        easing: (t) => t,
      });
    }
  }
  useEffect(pushOwnship, [ownship, follow]);

  // --- Airspace (scoped, App-driven) --------------------------------------
  function pushAirspaces() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("airspaces") as maplibregl.GeoJSONSource | undefined;
    src?.setData(airspaces);
  }
  useEffect(pushAirspaces, [airspaces]);

  // --- Reporting points ---------------------------------------------------
  function pushReporting() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("reporting") as maplibregl.GeoJSONSource | undefined;
    src?.setData(reportingPoints);
  }
  useEffect(pushReporting, [reportingPoints]);

  // --- Route line ---------------------------------------------------------
  function pushRoute() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    src?.setData(route);
  }
  useEffect(pushRoute, [route]);

  // --- Weather (METAR) ----------------------------------------------------
  function pushMetars() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("weather") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: metars.map((m) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
        properties: {
          icao: m.icao,
          name: m.name,
          category: m.category,
          windKt: m.windKt,
          gustKt: m.gustKt,
          visibSm: m.visibSm,
          ceilingFt: m.ceilingFt,
          tempC: m.tempC,
          dewpC: m.dewpC,
          qnhHpa: m.qnhHpa,
          raw: m.raw,
          // Only set windDir when known so the wind-arrow filter can skip calm.
          ...(m.windDir != null && m.windKt > 0 ? { windDir: m.windDir } : {}),
        },
      })),
    });
  }
  useEffect(pushMetars, [metars]);

  // --- Wind field (gridded) -----------------------------------------------
  function pushWindField() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("windfield") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: windField.map((w) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [w.lng, w.lat] },
        properties: { windDir: w.windDir, windKt: w.windKt },
      })),
    });
  }
  useEffect(pushWindField, [windField]);

  return <div ref={containerRef} className="map-root" />;
}

export const MapView = forwardRef(MapViewInner);
