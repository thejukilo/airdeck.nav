import { useState } from "react";

const KEY = "airdeck.advisory.ack.v1";

/**
 * One-time advisory shown on first run — the same approach SkyDemon/EasyVFR
 * take (acknowledged in terms, not a persistent on-map banner). Stored in
 * localStorage so it isn't shown again.
 */
export function Advisory() {
  const [ack, setAck] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  if (ack) return null;

  const accept = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setAck(true);
  };

  return (
    <div className="ack-backdrop" role="dialog" aria-modal="true" aria-label="Advisory">
      <div className="ack panel">
        <h2>Before you fly</h2>
        <p>
          Airdeck Nav is an <strong>advisory aid</strong> to situational awareness —
          it is <strong>not certified for navigation</strong>. Always plan and fly
          against current official sources (AIP, NOTAM, official charts).
        </p>
        <p>
          Aeronautical data is sourced from OurAirports and open community data;
          weather from NWS/AWC. Coverage and currency are not guaranteed.
        </p>
        <button className="ack-btn" onClick={accept}>
          I understand
        </button>
      </div>
    </div>
  );
}
