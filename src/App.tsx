import { useEffect, useRef, useState } from "react";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { MapView, type MapHandle, type SelectedFeature } from "./map/MapView";
import { Hud } from "./components/Hud";
import { Toolbar } from "./components/Toolbar";
import { LayerControl } from "./components/LayerControl";
import { InfoPanel } from "./components/InfoPanel";
import { Advisory } from "./components/Advisory";
import { AwarenessPanel } from "./components/AwarenessPanel";
import { useOwnship, type PositionMode } from "./nav/useOwnship";
import { computeAwareness, type Awareness } from "./nav/airspace";
import { fetchMetars, fetchWindField, type Metar, type WindPoint } from "./data/weather";
import { DEFAULT_BBOX } from "./data/region";
import type { BaseMap } from "./map/style";
import type { AirspaceProps, LayerId } from "./data/aero";

const METAR_REFRESH_MS = 5 * 60 * 1000;
const AWARENESS_MS = 1000;

type AirspaceFeature = Feature<Polygon | MultiPolygon, AirspaceProps>;

export default function App() {
  const [basemap, setBasemap] = useState<BaseMap>("topo");
  const [follow, setFollow] = useState(true);
  const [posMode, setPosMode] = useState<PositionMode>("sim");
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [metars, setMetars] = useState<Metar[]>([]);
  const [windField, setWindField] = useState<WindPoint[]>([]);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [layersVisible, setLayersVisible] = useState<Record<LayerId, boolean>>({
    chart: true,
    wind: true,
    weather: true,
    airports: true,
  });

  const mapRef = useRef<MapHandle>(null);
  const ship = useOwnship(posMode);

  // Latest values for the throttled awareness loop (avoids recomputing 60×/s).
  const shipRef = useRef(ship);
  shipRef.current = ship;
  const airspacesRef = useRef<AirspaceFeature[]>([]);

  // UI theme follows the base map (night = dark chrome).
  useEffect(() => {
    document.documentElement.dataset.theme = basemap === "night" ? "night" : "day";
  }, [basemap]);

  // Live weather: METAR + gridded wind field on mount, refreshed every 5 min.
  useEffect(() => {
    let active = true;
    const tick = () => {
      fetchMetars(DEFAULT_BBOX).then((m) => active && setMetars(m));
      fetchWindField(DEFAULT_BBOX).then((w) => active && setWindField(w));
    };
    tick();
    const id = setInterval(tick, METAR_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Airspace awareness — recomputed at 1 Hz from the latest position.
  useEffect(() => {
    const compute = () => {
      const s = shipRef.current;
      if (s && airspacesRef.current.length) {
        setAwareness(computeAwareness(s, airspacesRef.current));
      }
    };
    const id = setInterval(compute, AWARENESS_MS);
    return () => clearInterval(id);
  }, []);

  const toggleLayer = (id: LayerId) =>
    setLayersVisible((v) => ({ ...v, [id]: !v[id] }));

  const activeAirspaces = awareness?.inside.map((h) => h.name) ?? [];

  return (
    <div className="app">
      <MapView
        ref={mapRef}
        basemap={basemap}
        ownship={ship}
        metars={metars}
        windField={windField}
        layersVisible={layersVisible}
        follow={follow}
        activeAirspaces={activeAirspaces}
        onSelect={setSelected}
        onAirspaces={(fc) => {
          airspacesRef.current = fc.features as AirspaceFeature[];
        }}
      />

      <Hud ship={ship} />
      <LayerControl
        visible={layersVisible}
        onToggle={toggleLayer}
        base={basemap}
        onBase={setBasemap}
      />
      <AwarenessPanel awareness={awareness} />

      <Toolbar
        follow={follow}
        posMode={posMode}
        onToggleFollow={() => {
          const next = !follow;
          setFollow(next);
          if (next) mapRef.current?.recenter(ship);
        }}
        onResetNorth={() => mapRef.current?.resetNorth()}
        onTogglePosMode={() => setPosMode((m) => (m === "sim" ? "gps" : "sim"))}
      />

      <div className="mode-pill panel">
        <span className={`dot ${ship?.source === "gps" ? "live" : ""}`} />
        {ship
          ? ship.source === "gps"
            ? "GPS fix"
            : "Simulated flight"
          : posMode === "gps"
            ? "Waiting for GPS…"
            : "Starting…"}
      </div>

      {selected && <InfoPanel feature={selected} onClose={() => setSelected(null)} />}

      <div className="attrib">
        Data: openAIP · OurAirports · NWS/AWC · Open-Meteo · © OpenStreetMap ·
        CARTO — advisory only
      </div>

      <Advisory />
    </div>
  );
}
