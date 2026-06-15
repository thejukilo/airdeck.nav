import { useEffect, useRef, useState } from "react";
import { bearingDeg, destination, type LngLat } from "../lib/geo";

export interface Ownship {
  pos: LngLat;
  /** True track over ground, degrees. */
  track: number;
  /** Ground speed, knots. */
  gs: number;
  /** Altitude, feet (simulated / from GPS where available). */
  alt: number;
  source: "sim" | "gps";
}

export type PositionMode = "sim" | "gps";

// A gentle demo circuit around the Lelystad / Amsterdam area so the moving map
// has something to show without a real GPS fix.
const SIM_LEGS: LngLat[] = [
  { lng: 5.5272, lat: 52.4603 }, // EHLE
  { lng: 5.2, lat: 52.65 },
  { lng: 4.9, lat: 52.55 },
  { lng: 4.95, lat: 52.32 }, // near PAM
  { lng: 5.3, lat: 52.25 },
  { lng: 5.6, lat: 52.38 },
];

const SIM_GS = 110; // kt
const SIM_ALT = 2000; // ft

export function useOwnship(mode: PositionMode): Ownship | null {
  const [ship, setShip] = useState<Ownship | null>(null);
  const legRef = useRef(0);
  const targetRef = useRef<LngLat>(SIM_LEGS[1]);
  const posRef = useRef<LngLat>(SIM_LEGS[0]);

  // --- Simulator ----------------------------------------------------------
  useEffect(() => {
    if (mode !== "sim") return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dtHr = (now - last) / 3_600_000; // ms -> hours
      last = now;
      const stepNm = SIM_GS * dtHr;

      const from = posRef.current;
      const to = targetRef.current;
      const trk = bearingDeg(from, to);
      const next = destination(from, trk, stepNm);

      // Advance to the next leg once we're close to the waypoint.
      if (
        Math.hypot(to.lng - next.lng, to.lat - next.lat) < 0.01 ||
        Math.hypot(to.lng - from.lng, to.lat - from.lat) <
          Math.hypot(next.lng - from.lng, next.lat - from.lat)
      ) {
        legRef.current = (legRef.current + 1) % SIM_LEGS.length;
        targetRef.current = SIM_LEGS[(legRef.current + 1) % SIM_LEGS.length];
        posRef.current = SIM_LEGS[legRef.current];
      } else {
        posRef.current = next;
      }

      setShip({ pos: posRef.current, track: trk, gs: SIM_GS, alt: SIM_ALT, source: "sim" });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  // --- Real GPS -----------------------------------------------------------
  useEffect(() => {
    if (mode !== "gps") return;
    if (!("geolocation" in navigator)) {
      setShip(null);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setShip({
          pos: { lng: p.coords.longitude, lat: p.coords.latitude },
          track: p.coords.heading ?? 0,
          gs: (p.coords.speed ?? 0) * 1.94384, // m/s -> kt
          alt: (p.coords.altitude ?? 0) * 3.28084, // m -> ft
          source: "gps",
        });
      },
      () => setShip(null),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [mode]);

  return ship;
}
