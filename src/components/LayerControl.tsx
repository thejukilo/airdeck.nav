import { useState } from "react";
import { LAYER_DEFS, type LayerId } from "../data/aero";
import { LayersIcon } from "./icons";

interface Props {
  visible: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
}

export function LayerControl({ visible, onToggle }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="layers panel">
      <button className="layers-head" onClick={() => setOpen((o) => !o)}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LayersIcon style={{ width: 18, height: 18 }} />
          Map layers
        </span>
        <span className="icon-btn" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="layers-body">
          {LAYER_DEFS.map((l) => (
            <button key={l.id} className="layer-row" onClick={() => onToggle(l.id)}>
              <span className="layer-swatch" style={{ background: l.color }} />
              <span className="layer-name">{l.label}</span>
              <span className={`layer-toggle ${visible[l.id] ? "on" : ""}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
