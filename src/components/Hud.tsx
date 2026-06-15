import type { Ownship } from "../nav/useOwnship";
import { fmtHeading } from "../lib/geo";

/** Glanceable top status strip: ground speed, track, altitude. */
export function Hud({ ship }: { ship: Ownship | null }) {
  const gs = ship ? Math.round(ship.gs) : "—";
  const trk = ship ? fmtHeading(ship.track) : "—";
  const alt = ship ? Math.round(ship.alt) : "—";

  return (
    <div className="hud panel">
      <div className="hud-cell">
        <span className="hud-value accent">{gs}</span>
        <span className="hud-unit">kt GS</span>
      </div>
      <div className="hud-cell">
        <span className="hud-value">{trk}</span>
        <span className="hud-unit">° TRK</span>
      </div>
      <div className="hud-cell">
        <span className="hud-value">{alt}</span>
        <span className="hud-unit">ft ALT</span>
      </div>
    </div>
  );
}
