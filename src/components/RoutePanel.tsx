import type { Waypoint, RoutePlan } from "../nav/route";
import { fmtHeading } from "../lib/geo";
import { useDraggable } from "../hooks/useDraggable";
import { CloseIcon } from "./icons";

interface Props {
  from: Waypoint | null;
  to: Waypoint | null;
  plan: RoutePlan | null;
  gsKt: number;
  onClear: () => void;
  onFly: () => void;
}

const chipLevel = (c: string) =>
  c === "restricted" || c === "danger" || c === "prohibited" ? "danger" : "warn";

export function RoutePanel({ from, to, plan, gsKt, onClear, onFly }: Props) {
  const { ref, style, handleProps } = useDraggable();
  if (!from && !to) return null;

  const eteMin = plan && gsKt > 1 ? (plan.distanceNm / gsKt) * 60 : null;

  return (
    <div className="route panel" ref={ref} style={style}>
      <div className="route-head" {...handleProps}>
        <span className="route-title">Route</span>
        <button className="icon-btn" onClick={onClear} aria-label="Clear route">
          <CloseIcon style={{ width: 18, height: 18 }} />
        </button>
      </div>

      <div className="route-ends">
        <div className="route-end">
          <span className="route-role">FROM</span>
          <span className="route-icao">{from?.icao ?? "tap an airport"}</span>
        </div>
        <span className="route-arrow">→</span>
        <div className="route-end">
          <span className="route-role">TO</span>
          <span className="route-icao">{to?.icao ?? "tap an airport"}</span>
        </div>
      </div>

      {plan && (
        <>
          <div className="route-stats">
            <div className="route-stat">
              <span className="v">{plan.distanceNm.toFixed(0)}</span>
              <span className="k">NM</span>
            </div>
            <div className="route-stat">
              <span className="v">{fmtHeading(plan.bearingDeg)}°</span>
              <span className="k">track</span>
            </div>
            <div className="route-stat">
              <span className="v">{eteMin != null ? Math.round(eteMin) : "—"}</span>
              <span className="k">min</span>
            </div>
            <div className="route-stat">
              <span className="v accent">{plan.recommendedAltFt.toLocaleString()}</span>
              <span className="k">ft cruise</span>
            </div>
          </div>

          <div className="route-cross-head">
            At {plan.recommendedAltFt.toLocaleString()} ft you cross:
          </div>
          {plan.crossings.length === 0 ? (
            <div className="route-clear">No controlled or restricted airspace ✓</div>
          ) : (
            plan.crossings.map((c, i) => (
              <div className="route-cross" key={i}>
                <span className={`aware-chip ${chipLevel(c.category)}`}>
                  {c.category === "ctr" || c.category === "tma" ? `Class ${c.class || "?"}` : "R"}
                </span>
                <span className="route-cross-name">{c.name}</span>
                <span className="route-cross-band">
                  {c.lower}–{c.upper}
                </span>
              </div>
            ))
          )}

          <button className="route-fly" onClick={onFly}>
            Fly this route
          </button>
        </>
      )}
    </div>
  );
}
