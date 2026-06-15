import { fmtHeading } from "../lib/geo";
import { PlayIcon, CrosshairIcon } from "./icons";

interface Props {
  headingDeg: number;
  altFt: number;
  gsKt: number;
  running: boolean;
  onHeading: (delta: number) => void;
  onAlt: (delta: number) => void;
  onSpeed: (delta: number) => void;
  onToggleRun: () => void;
  onStartHere: () => void;
}

interface StepperProps {
  label: string;
  value: string;
  onDown: () => void;
  onUp: () => void;
}

function Stepper({ label, value, onDown, onUp }: StepperProps) {
  return (
    <div className="sim-stepper">
      <button className="sim-step" onClick={onDown} aria-label={`${label} down`}>
        −
      </button>
      <div className="sim-readout">
        <span className="sim-val">{value}</span>
        <span className="sim-label">{label}</span>
      </div>
      <button className="sim-step" onClick={onUp} aria-label={`${label} up`}>
        +
      </button>
    </div>
  );
}

export function SimControl({
  headingDeg,
  altFt,
  gsKt,
  running,
  onHeading,
  onAlt,
  onSpeed,
  onToggleRun,
  onStartHere,
}: Props) {
  return (
    <div className="simbar panel">
      <button
        className={`sim-run ${running ? "on" : ""}`}
        onClick={onToggleRun}
        title={running ? "Pause" : "Fly"}
      >
        {running ? <span className="sim-pause" /> : <PlayIcon />}
      </button>
      <Stepper
        label="HDG"
        value={`${fmtHeading(headingDeg)}°`}
        onDown={() => onHeading(-10)}
        onUp={() => onHeading(10)}
      />
      <Stepper
        label="ALT ft"
        value={altFt.toLocaleString()}
        onDown={() => onAlt(-500)}
        onUp={() => onAlt(500)}
      />
      <Stepper
        label="SPD kt"
        value={String(gsKt)}
        onDown={() => onSpeed(-10)}
        onUp={() => onSpeed(10)}
      />
      <button className="sim-here" onClick={onStartHere} title="Start from map center">
        <CrosshairIcon />
        <span>Here</span>
      </button>
    </div>
  );
}
