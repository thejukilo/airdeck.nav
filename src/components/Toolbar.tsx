import type { PositionMode } from "../nav/useOwnship";
import { CrosshairIcon, NorthIcon, PlayIcon, SatelliteIcon } from "./icons";

interface Props {
  follow: boolean;
  posMode: PositionMode;
  onToggleFollow: () => void;
  onResetNorth: () => void;
  onTogglePosMode: () => void;
}

export function Toolbar({
  follow,
  posMode,
  onToggleFollow,
  onResetNorth,
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
    </div>
  );
}
