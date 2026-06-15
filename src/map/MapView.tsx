import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { baseStyle, type Theme } from "./style";
import { addAeroLayers, makeOwnshipImage, setLayerVisible } from "./layers";
import { loadAeroData } from "../data/aero";
import type { Ownship } from "../nav/useOwnship";
import type { LayerId } from "../data/aero";

export interface SelectedFeature {
  kind: "airport" | "navaid" | "airspace";
  properties: Record<string, unknown>;
}

export interface MapHandle {
  recenter: (ship: Ownship | null) => void;
  resetNorth: () => void;
}

interface Props {
  theme: Theme;
  ownship: Ownship | null;
  layersVisible: Record<LayerId, boolean>;
  follow: boolean;
  onSelect: (f: SelectedFeature | null) => void;
}

const QUERY_LAYERS = [
  "airports-symbol",
  "navaids-symbol",
  "airspaces-fill",
] as const;

function MapViewInner(
  { theme, ownship, layersVisible, follow, onSelect }: Props,
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
  }));

  // --- Init (once) --------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(theme),
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
      map.addImage("ownship-arrow", makeOwnshipImage(), { pixelRatio: 2 });
      try {
        const data = await loadAeroData();
        addAeroLayers(map, data);
        readyRef.current = true;
        // Apply any visibility that was toggled before load finished.
        applyVisibility();
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
            : "airspace";
      onSelect({ kind, properties: f.properties ?? {} });
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

  // --- Theme switches restyle the base; re-add aero layers afterward. -----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    readyRef.current = false;
    map.setStyle(baseStyle(theme));
    map.once("styledata", async () => {
      if (!map.getImage("ownship-arrow")) {
        map.addImage("ownship-arrow", makeOwnshipImage(), { pixelRatio: 2 });
      }
      try {
        const data = await loadAeroData();
        addAeroLayers(map, data);
        readyRef.current = true;
        applyVisibility();
        pushOwnship();
      } catch (err) {
        console.error(err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

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

  return <div ref={containerRef} className="map-root" />;
}

export const MapView = forwardRef(MapViewInner);
