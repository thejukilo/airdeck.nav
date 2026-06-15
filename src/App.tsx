import { useEffect, useRef, useState } from "react";
import { MapView, type MapHandle, type SelectedFeature } from "./map/MapView";
import { Hud } from "./components/Hud";
import { Toolbar } from "./components/Toolbar";
import { LayerControl } from "./components/LayerControl";
import { InfoPanel } from "./components/InfoPanel";
import { Advisory } from "./components/Advisory";
import { useOwnship, type PositionMode } from "./nav/useOwnship";
import { fetchMetars, type Metar } from "./data/weather";
import { DEFAULT_BBOX } from "./data/region";
import type { Theme } from "./map/style";
import type { LayerId } from "./data/aero";

const METAR_REFRESH_MS = 5 * 60 * 1000;

export default function App() {
  const [theme, setTheme] = useState<Theme>("night");
  const [follow, setFollow] = useState(true);
  const [posMode, setPosMode] = useState<PositionMode>("sim");
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [metars, setMetars] = useState<Metar[]>([]);
  const [layersVisible, setLayersVisible] = useState<Record<LayerId, boolean>>({
    weather: true,
    airspaces: true,
    airports: true,
    navaids: true,
  });

  const mapRef = useRef<MapHandle>(null);
  const ship = useOwnship(posMode);

  // Reflect the theme onto the document root so CSS variables switch.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Live METAR: fetch on mount, then refresh every 5 minutes.
  useEffect(() => {
    let active = true;
    const tick = () => fetchMetars(DEFAULT_BBOX).then((m) => active && setMetars(m));
    tick();
    const id = setInterval(tick, METAR_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const toggleLayer = (id: LayerId) =>
    setLayersVisible((v) => ({ ...v, [id]: !v[id] }));

  return (
    <div className="app">
      <MapView
        ref={mapRef}
        theme={theme}
        ownship={ship}
        metars={metars}
        layersVisible={layersVisible}
        follow={follow}
        onSelect={setSelected}
      />

      <Hud ship={ship} />
      <LayerControl visible={layersVisible} onToggle={toggleLayer} />

      <Toolbar
        follow={follow}
        theme={theme}
        posMode={posMode}
        onToggleFollow={() => {
          const next = !follow;
          setFollow(next);
          if (next) mapRef.current?.recenter(ship);
        }}
        onResetNorth={() => mapRef.current?.resetNorth()}
        onToggleTheme={() => setTheme((t) => (t === "night" ? "day" : "night"))}
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
        Data: OurAirports · NWS/AWC · © OpenStreetMap · CARTO — advisory only
      </div>

      <Advisory />
    </div>
  );
}
