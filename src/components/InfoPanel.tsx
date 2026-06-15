import type { SelectedFeature } from "../map/MapView";
import { CloseIcon } from "./icons";

interface Props {
  feature: SelectedFeature;
  onClose: () => void;
}

interface Item {
  k: string;
  v: string;
}

function parseMaybeJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function InfoPanel({ feature, onClose }: Props) {
  const p = feature.properties;
  let title = "";
  let sub = "";
  let tag = "";
  const items: Item[] = [];

  if (feature.kind === "airport") {
    title = String(p.icao ?? "");
    sub = String(p.name ?? "");
    tag = (p.kind as string) === "intl" ? "AIRPORT" : "AIRFIELD";
    const runways = parseMaybeJson<{ ident: string; len_m: number; surface: string }[]>(p.runways, []);
    const freqs = parseMaybeJson<{ type: string; mhz: string }[]>(p.freqs, []);
    items.push({ k: "Elevation", v: `${p.elev_ft} ft` });
    if (runways[0]) {
      items.push({ k: "Runway", v: runways[0].ident });
      items.push({ k: "Length", v: `${runways[0].len_m} m` });
      items.push({ k: "Surface", v: runways[0].surface });
    }
    for (const f of freqs) items.push({ k: f.type, v: f.mhz });
  } else if (feature.kind === "navaid") {
    title = String(p.ident ?? "");
    sub = String(p.name ?? "");
    tag = String(p.type ?? "NAVAID");
    items.push({ k: "Frequency", v: String(p.mhz ?? "") });
    items.push({ k: "Type", v: String(p.type ?? "") });
  } else {
    title = String(p.name ?? "");
    sub = `Class ${p.class}`;
    tag = String(p.category ?? "").toUpperCase();
    items.push({ k: "Lower", v: String(p.lower ?? "") });
    items.push({ k: "Upper", v: String(p.upper ?? "") });
    items.push({ k: "Class", v: String(p.class ?? "") });
  }

  return (
    <div className="info panel" role="dialog" aria-label={`${title} details`}>
      <div className="info-head">
        <div>
          <div className="info-title">{title}</div>
          {sub && <div className="info-sub">{sub}</div>}
        </div>
        {tag && <span className="info-tag">{tag}</span>}
        <button className="icon-btn info-close" onClick={onClose} aria-label="Close">
          <CloseIcon style={{ width: 18, height: 18 }} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="info-grid">
          {items.map((it, i) => (
            <div className="info-item" key={`${it.k}-${i}`}>
              <div className="k">{it.k}</div>
              <div className="v">{it.v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
