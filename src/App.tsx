import { useEffect, useRef, useState } from "react";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { MapView, type MapHandle, type SelectedFeature } from "./map/MapView";
import { Hud } from "./components/Hud";
import { Toolbar } from "./components/Toolbar";
import { LayerControl } from "./components/LayerControl";
import { InfoPanel } from "./components/InfoPanel";
import type { FeatureCollection, LineString } from "geojson";
import { Advisory } from "./components/Advisory";
import { AwarenessPanel } from "./components/AwarenessPanel";
import { SimControl } from "./components/SimControl";
import { RoutePanel } from "./components/RoutePanel";
import { useOwnship, type PositionMode } from "./nav/useOwnship";
import { computeAwareness, type Awareness } from "./nav/airspace";
import { planRoute, type RoutePlan, type Waypoint } from "./nav/route";
import { fetchMetars, fetchWindField, type Metar, type WindPoint } from "./data/weather";
import { fetchAirspaces, fetchReportingPoints } from "./data/aero";
import { DEFAULT_BBOX } from "./data/region";
import type { BaseMap } from "./map/style";
import type { AeroData, AirspaceProps, LayerId, ReportingPoints } from "./data/aero";

const METAR_REFRESH_MS = 5 * 60 * 1000;
const AWARENESS_MS = 1000;
// Airspace is fetched in a window around the aircraft and refreshed as it
// moves, so the openAIP 1000-feature cap never drops nearby airspace.
const AIRSPACE_PAD_DEG = 1.2;
const AIRSPACE_MOVE_DEG = 0.5;
const AIRSPACE_CHECK_MS = 3000;

const EMPTY_AIRSPACES: AeroData["airspaces"] = {
  type: "FeatureCollection",
  features: [],
};
const EMPTY_LINE: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

type AirspaceFeature = Feature<Polygon | MultiPolygon, AirspaceProps>;

export default function App() {
  const [basemap, setBasemap] = useState<BaseMap>("topo");
  const [follow, setFollow] = useState(true);
  const [posMode, setPosMode] = useState<PositionMode>("sim");
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [metars, setMetars] = useState<Metar[]>([]);
  const [windField, setWindField] = useState<WindPoint[]>([]);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [airspaces, setAirspaces] = useState<AeroData["airspaces"]>(EMPTY_AIRSPACES);
  const [reportingPoints, setReportingPoints] = useState<ReportingPoints>({
    type: "FeatureCollection",
    features: [],
  });
  const [routeFrom, setRouteFrom] = useState<Waypoint | null>(null);
  const [routeTo, setRouteTo] = useState<Waypoint | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [routeLine, setRouteLine] = useState<FeatureCollection<LineString>>(EMPTY_LINE);
  const [routeMinAlt, setRouteMinAlt] = useState(2500);
  const [layersVisible, setLayersVisible] = useState<Record<LayerId, boolean>>({
    chart: true,
    restrictions: true,
    reporting: true,
    wind: true,
    weather: true,
    airports: true,
  });

  // Controllable simulator state.
  const [simHeading, setSimHeading] = useState(90);
  const [simAlt, setSimAlt] = useState(2000);
  const [simGs, setSimGs] = useState(110);
  const [simRunning, setSimRunning] = useState(true);
  const [simStart, setSimStart] = useState({ lng: 5.2, lat: 52.4 });

  const mapRef = useRef<MapHandle>(null);
  const ship = useOwnship(
    posMode,
    { headingDeg: simHeading, altFt: simAlt, gsKt: simGs, running: simRunning },
    simStart,
  );

  const wrapHeading = (d: number) => setSimHeading((h) => (((h + d) % 360) + 360) % 360);

  // Latest values for the throttled awareness loop (avoids recomputing 60×/s).
  const shipRef = useRef(ship);
  shipRef.current = ship;
  const airspacesRef = useRef<AirspaceFeature[]>([]);
  const fetchCenterRef = useRef<{ lng: number; lat: number } | null>(null);
  const simStartRef = useRef(simStart);
  simStartRef.current = simStart;

  // Keep airspace loaded in a window around the aircraft.
  useEffect(() => {
    let active = true;
    const maybeFetch = () => {
      const s = shipRef.current;
      const c = s ? s.pos : simStartRef.current;
      const last = fetchCenterRef.current;
      const moved =
        !last ||
        Math.abs(c.lng - last.lng) > AIRSPACE_MOVE_DEG ||
        Math.abs(c.lat - last.lat) > AIRSPACE_MOVE_DEG;
      if (!moved) return;
      fetchCenterRef.current = { lng: c.lng, lat: c.lat };
      const bbox: [number, number, number, number] = [
        c.lng - AIRSPACE_PAD_DEG,
        c.lat - AIRSPACE_PAD_DEG,
        c.lng + AIRSPACE_PAD_DEG,
        c.lat + AIRSPACE_PAD_DEG,
      ];
      fetchAirspaces(bbox).then((fc) => {
        if (!active) return;
        setAirspaces(fc);
        airspacesRef.current = fc.features as AirspaceFeature[];
      });
      fetchReportingPoints(bbox).then((fc) => active && setReportingPoints(fc));
    };
    maybeFetch();
    const id = setInterval(maybeFetch, AIRSPACE_CHECK_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

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

  // Plan the route whenever both endpoints are set.
  useEffect(() => {
    if (!routeFrom || !routeTo) {
      setRoutePlan(null);
      setRouteLine(EMPTY_LINE);
      return;
    }
    let active = true;
    const pad = 0.5;
    const bbox: [number, number, number, number] = [
      Math.min(routeFrom.lng, routeTo.lng) - pad,
      Math.min(routeFrom.lat, routeTo.lat) - pad,
      Math.max(routeFrom.lng, routeTo.lng) + pad,
      Math.max(routeFrom.lat, routeTo.lat) + pad,
    ];
    fetchAirspaces(bbox).then((fc) => {
      if (!active) return;
      const plan = planRoute(routeFrom, routeTo, fc.features as AirspaceFeature[], routeMinAlt);
      setRoutePlan(plan);
      setRouteLine(plan.line);
    });
    return () => {
      active = false;
    };
  }, [routeFrom, routeTo, routeMinAlt]);

  const toggleLayer = (id: LayerId) =>
    setLayersVisible((v) => ({ ...v, [id]: !v[id] }));

  const setRouteEnd = (role: "from" | "to", wp: Waypoint) => {
    if (role === "from") setRouteFrom(wp);
    else setRouteTo(wp);
    setSelected(null);
  };

  const flyRoute = () => {
    if (!routePlan) return;
    setSimStart({ lng: routePlan.from.lng, lat: routePlan.from.lat });
    setSimHeading(Math.round(routePlan.bearingDeg));
    setSimAlt(routePlan.recommendedAltFt);
    setSimRunning(true);
    setFollow(true);
    setPosMode("sim");
  };

  const activeAirspaces = awareness?.inside.map((h) => h.name) ?? [];

  return (
    <div className="app">
      <MapView
        ref={mapRef}
        basemap={basemap}
        ownship={ship}
        metars={metars}
        windField={windField}
        airspaces={airspaces}
        reportingPoints={reportingPoints}
        route={routeLine}
        layersVisible={layersVisible}
        follow={follow}
        activeAirspaces={activeAirspaces}
        onSelect={setSelected}
      />

      <Hud ship={ship} />
      <div className="left-col">
        <LayerControl
          visible={layersVisible}
          onToggle={toggleLayer}
          base={basemap}
          onBase={setBasemap}
        />
        <AwarenessPanel awareness={awareness} />
      </div>

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

      {posMode === "sim" && (
        <SimControl
          headingDeg={simHeading}
          altFt={simAlt}
          gsKt={simGs}
          running={simRunning}
          onHeading={wrapHeading}
          onAlt={(d) => setSimAlt((a) => Math.max(0, a + d))}
          onSpeed={(d) => setSimGs((g) => Math.max(0, g + d))}
          onToggleRun={() => setSimRunning((r) => !r)}
          onStartHere={() => {
            const c = mapRef.current?.getCenter();
            if (c) setSimStart(c);
            setSimRunning(true);
          }}
        />
      )}

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

      <RoutePanel
        from={routeFrom}
        to={routeTo}
        plan={routePlan}
        gsKt={simGs}
        minAltFt={routeMinAlt}
        onMinAlt={(d) => setRouteMinAlt((a) => Math.max(0, Math.min(9500, a + d)))}
        onClear={() => {
          setRouteFrom(null);
          setRouteTo(null);
        }}
        onFly={flyRoute}
      />

      {selected && (
        <InfoPanel
          feature={selected}
          onClose={() => setSelected(null)}
          onSetRoute={setRouteEnd}
        />
      )}

      <div className="attrib">
        Data: openAIP · OurAirports · NWS/AWC · Open-Meteo · © OpenStreetMap ·
        CARTO — advisory only
      </div>

      <Advisory />
    </div>
  );
}
