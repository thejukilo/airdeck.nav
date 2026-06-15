import { useEffect, useRef, useState } from "react";
import { destination, type LngLat } from "../lib/geo";

export interface Ownship {
  pos: LngLat;
  /** True track over ground, degrees. */
  track: number;
  /** Ground speed, knots. */
  gs: number;
  /** Altitude, feet. */
  alt: number;
  source: "sim" | "gps";
}

export type PositionMode = "sim" | "gps";

/** Pilot-controllable simulator inputs. */
export interface SimControls {
  headingDeg: number;
  altFt: number;
  gsKt: number;
  running: boolean;
}

export function useOwnship(
  mode: PositionMode,
  sim: SimControls,
  simStart: LngLat,
): Ownship | null {
  const [ship, setShip] = useState<Ownship | null>(null);

  // Latest controls, read by the animation loop without restarting it.
  const simRef = useRef(sim);
  simRef.current = sim;
  const posRef = useRef<LngLat>(simStart);

  // Re-seed the position when the start point changes ("start from here").
  useEffect(() => {
    posRef.current = simStart;
  }, [simStart.lng, simStart.lat]);

  // --- Simulator: fly the set heading at the set speed/altitude ------------
  useEffect(() => {
    if (mode !== "sim") return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dtHr = (now - last) / 3_600_000; // ms -> hours
      last = now;
      const s = simRef.current;
      if (s.running) {
        posRef.current = destination(posRef.current, s.headingDeg, s.gsKt * dtHr);
      }
      setShip({
        pos: posRef.current,
        track: s.headingDeg,
        gs: s.running ? s.gsKt : 0,
        alt: s.altFt,
        source: "sim",
      });
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
