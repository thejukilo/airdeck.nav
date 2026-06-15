import type { Theme } from "../map/style";
import type { PositionMode } from "../nav/useOwnship";
import {
  CrosshairIcon,
  MoonIcon,
  NorthIcon,
  PlayIcon,
  SatelliteIcon,
  SunIcon,
} from "./icons";

interface Props {
  follow: boolean;
  theme: Theme;
  posMode: PositionMode;
  onToggleFollow: () => void;
  onResetNorth: () => void;
  onToggleTheme: () => void;
  onTogglePosMode: () => void;
}

export function Toolbar({
  follow,
  theme,
  posMode,
  onToggleFollow,
  onResetNorth,
  onToggleTheme,
  onTogglePosMode,
}: Props) {
  return (
    <div className="toolbar panel">
      <button
        className={`tool-btn ${follow ? "active" : ""}`}
        onClick={onToggleFollow}
        title="Follow ownship"
        aria-pressed={follow}
      >
        <CrosshairIcon />
      </button>
      <button className="tool-btn" onClick={onResetNorth} title="North up">
        <NorthIcon />
      </button>
      <button
        className={`tool-btn ${posMode === "sim" ? "active" : ""}`}
        onClick={onTogglePosMode}
        title={posMode === "sim" ? "Using simulator — tap for GPS" : "Using GPS — tap for simulator"}
      >
        {posMode === "sim" ? <PlayIcon /> : <SatelliteIcon />}
      </button>
      <button className="tool-btn" onClick={onToggleTheme} title="Toggle day / night">
        {theme === "night" ? <MoonIcon /> : <SunIcon />}
      </button>
    </div>
  );
}
