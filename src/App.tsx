import { useEffect, useRef, useState } from "react";
import { MapView, type MapHandle, type SelectedFeature } from "./map/MapView";
import { Hud } from "./components/Hud";
import { Toolbar } from "./components/Toolbar";
import { LayerControl } from "./components/LayerControl";
import { InfoPanel } from "./components/InfoPanel";
import { useOwnship, type PositionMode } from "./nav/useOwnship";
import type { Theme } from "./map/style";
import type { LayerId } from "./data/aero";

export default function App() {
  const [theme, setTheme] = useState<Theme>("night");
  const [follow, setFollow] = useState(true);
  const [posMode, setPosMode] = useState<PositionMode>("sim");
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const [layersVisible, setLayersVisible] = useState<Record<LayerId, boolean>>({
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

  const toggleLayer = (id: LayerId) =>
    setLayersVisible((v) => ({ ...v, [id]: !v[id] }));

  return (
    <div className="app">
      <MapView
        ref={mapRef}
        theme={theme}
        ownship={ship}
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

      <div className="attrib">© OpenStreetMap · CARTO — Sample data, not for navigation</div>
    </div>
  );
}
