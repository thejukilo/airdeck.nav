import type { Awareness, AirspaceHit } from "../nav/airspace";

/**
 * Glanceable airspace awareness: what you're inside now and what's ahead on
 * track, with the vertical advice (stay below / above, or conflict) so you can
 * climb, descend or divert in time.
 */
function fmtDist(nm?: number) {
  return nm == null ? "" : `${nm.toFixed(1)} NM`;
}
function fmtEte(min?: number) {
  if (min == null) return "";
  return min < 1 ? "<1 min" : `${Math.round(min)} min`;
}

function aheadAdvice(h: AirspaceHit): { text: string; level: "ok" | "warn" | "danger" } {
  if (h.vertical === "inside") {
    return { text: `Conflict — divert, or climb >${h.upper} / descend <${h.lower}`, level: "danger" };
  }
  if (h.vertical === "below") {
    return { text: `Clear if you stay below ${h.lower}`, level: "warn" };
  }
  return { text: `Clear if you stay above ${h.upper}`, level: "ok" };
}

function insideTag(h: AirspaceHit): { text: string; level: "ok" | "warn" | "danger" } {
  if (h.vertical === "inside") return { text: "INSIDE", level: "danger" };
  if (h.vertical === "below") return { text: "above you", level: "warn" };
  return { text: "below you", level: "ok" };
}

export function AwarenessPanel({ awareness }: { awareness: Awareness | null }) {
  if (!awareness) return null;
  const { inside, ahead } = awareness;
  if (!inside.length && !ahead.length) return null;

  return (
    <div className="aware panel">
      {inside.length > 0 && (
        <div className="aware-section">
          <div className="aware-head">You are in</div>
          {inside.map((h, i) => {
            const tag = insideTag(h);
            return (
              <div className="aware-row" key={`in-${i}`}>
                <div className="aware-main">
                  <span className="aware-name">{h.name}</span>
                  <span className={`aware-chip ${tag.level}`}>{tag.text}</span>
                </div>
                <div className="aware-sub">
                  {h.class ? `Class ${h.class} · ` : ""}
                  {h.lower}–{h.upper}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ahead.length > 0 && (
        <div className="aware-section">
          <div className="aware-head">Ahead on track</div>
          {ahead.map((h, i) => {
            const adv = aheadAdvice(h);
            return (
              <div className="aware-row" key={`ah-${i}`}>
                <div className="aware-main">
                  <span className="aware-name">{h.name}</span>
                  <span className="aware-dist">
                    {fmtDist(h.distanceNm)}
                    {h.etaMin != null ? ` · ${fmtEte(h.etaMin)}` : ""}
                  </span>
                </div>
                <div className="aware-sub">
                  {h.class ? `Class ${h.class} · ` : ""}
                  {h.lower}–{h.upper}
                </div>
                <div className={`aware-advice ${adv.level}`}>{adv.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
