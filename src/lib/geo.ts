/**
 * Geodesy helpers for VFR navigation.
 *
 * All angles are in degrees, distances in nautical miles, speeds in knots
 * unless noted. We use the simple spherical (haversine / great-circle) model;
 * for VFR leg distances the error vs. an ellipsoidal model is negligible.
 */

export const EARTH_RADIUS_NM = 3440.065;

export interface LngLat {
  lng: number;
  lat: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in nautical miles. */
export function distanceNm(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_NM * 2 * Math.asin(Math.sqrt(h));
}

/** Initial true bearing from `a` to `b`, degrees 0–360. */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Project a point a given distance (nm) along a true bearing (deg). */
export function destination(from: LngLat, bearing: number, distNm: number): LngLat {
  const ang = distNm / EARTH_RADIUS_NM;
  const brg = toRad(bearing);
  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brg),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 };
}

/** Format a true heading as a 3-digit string, e.g. 7 -> "007". */
export function fmtHeading(deg: number): string {
  return String(Math.round(((deg % 360) + 360) % 360)).padStart(3, "0");
}

/** Decimal degrees -> "52°18.5'N 004°45.8'E" style coordinate string. */
export function fmtLatLng({ lat, lng }: LngLat): string {
  const part = (v: number, pos: string, neg: string, pad: number) => {
    const hemi = v >= 0 ? pos : neg;
    const abs = Math.abs(v);
    const d = Math.floor(abs);
    const m = (abs - d) * 60;
    return `${String(d).padStart(pad, "0")}°${m.toFixed(1).padStart(4, "0")}'${hemi}`;
  };
  return `${part(lat, "N", "S", 2)} ${part(lng, "E", "W", 3)}`;
}
