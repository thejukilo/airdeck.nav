import type { SelectedFeature } from "../map/MapView";
import type { Waypoint } from "../nav/route";
import { CloseIcon } from "./icons";

interface Props {
  feature: SelectedFeature;
  onClose: () => void;
  onSetRoute?: (role: "from" | "to", wp: Waypoint) => void;
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

export function InfoPanel({ feature, onClose, onSetRoute }: Props) {
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
    if (p.elev_ft != null) items.push({ k: "Elevation", v: `${p.elev_ft} ft` });
    if (p.iata) items.push({ k: "IATA", v: String(p.iata) });
    if (runways[0]) {
      items.push({ k: "Runway", v: runways[0].ident });
      items.push({ k: "Length", v: `${runways[0].len_m} m` });
      items.push({ k: "Surface", v: runways[0].surface });
    }
    for (const f of freqs) items.push({ k: f.type, v: `${f.mhz}` });
  } else if (feature.kind === "weather") {
    const wd = p.windDir;
    const wind =
      p.windKt != null && Number(p.windKt) > 0
        ? `${wd != null ? String(wd).padStart(3, "0") + "°" : "VRB"} ${Math.round(Number(p.windKt))} kt`
        : "Calm";
    title = String(p.icao ?? "METAR");
    sub = String(p.name ?? "");
    tag = String(p.category ?? "METAR");
    items.push({ k: "Wind", v: wind });
    if (p.gustKt != null) items.push({ k: "Gust", v: `${Math.round(Number(p.gustKt))} kt` });
    if (p.visibSm != null) items.push({ k: "Visibility", v: `${p.visibSm} SM` });
    if (p.ceilingFt != null) items.push({ k: "Ceiling", v: `${p.ceilingFt} ft` });
    if (p.tempC != null) items.push({ k: "Temp", v: `${Math.round(Number(p.tempC))}°C` });
    if (p.dewpC != null) items.push({ k: "Dewpoint", v: `${Math.round(Number(p.dewpC))}°C` });
    if (p.qnhHpa != null) items.push({ k: "QNH", v: `${Math.round(Number(p.qnhHpa))} hPa` });
  } else if (feature.kind === "navaid") {
    title = String(p.ident ?? "");
    sub = String(p.name ?? "");
    tag = String(p.type ?? "NAVAID");
    items.push({ k: "Frequency", v: String(p.mhz ?? "") });
    items.push({ k: "Type", v: String(p.type ?? "") });
  } else {
    title = String(p.name ?? "");
    sub = p.class ? `Class ${p.class}` : "";
    tag = String(p.typeName ?? p.category ?? "").toUpperCase();
    if (p.lower) items.push({ k: "Lower", v: String(p.lower) });
    if (p.upper) items.push({ k: "Upper", v: String(p.upper) });
    if (p.class) items.push({ k: "Class", v: String(p.class) });
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
      {feature.kind === "weather" && p.raw ? (
        <div className="info-raw">{String(p.raw)}</div>
      ) : null}
      {feature.kind === "airport" && feature.lngLat && onSetRoute ? (
        <div className="info-actions">
          {(["from", "to"] as const).map((role) => (
            <button
              key={role}
              className="info-act"
              onClick={() =>
                onSetRoute(role, {
                  icao: String(p.icao ?? ""),
                  name: String(p.name ?? ""),
                  lng: feature.lngLat!.lng,
                  lat: feature.lngLat!.lat,
                  elevFt: typeof p.elev_ft === "number" ? p.elev_ft : null,
                })
              }
            >
              {role === "from" ? "Set departure" : "Set destination"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
