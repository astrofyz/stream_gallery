import type { CSSProperties } from "react";
import type { ManifestRun } from "./manifest";
import { runColor } from "./plot";

type Props = {
  runs: ManifestRun[];
  selected: Set<string>;
  loadingRuns: Set<string>;
  onToggle: (runId: string) => void;
  vertical?: boolean;
};

/** Short chip label: nobar → "0", omega-20 → "20". */
function chipLabel(run: ManifestRun): string {
  if (run.id === "nobar") return "0";
  const m = /^omega-(\d+)$/.exec(run.id);
  return m ? m[1]! : run.label;
}

export default function RunChips({
  runs,
  selected,
  loadingRuns,
  onToggle,
  vertical = false,
}: Props) {
  const chips = (
    <div
      className={`run-chips ${vertical ? "run-chips--vertical" : ""}`}
      role="group"
      aria-label="Simulation runs"
    >
      {runs.map((run) => {
        const isOn = selected.has(run.id);
        const isLoading = loadingRuns.has(run.id);
        const color = runColor(run.id);

        return (
          <button
            key={run.id}
            type="button"
            className={`run-chip ${isOn ? "run-chip--on" : ""} ${isLoading ? "run-chip--loading" : ""}`}
            style={{ "--chip-color": color } as CSSProperties}
            aria-pressed={isOn}
            aria-label={run.label}
            disabled={isLoading}
            onClick={() => onToggle(run.id)}
          >
            <span className="run-chip__dot" />
            {chipLabel(run)}
          </button>
        );
      })}
    </div>
  );

  if (!vertical) return chips;

  return (
    <div className="run-column">
      <div className="run-column__title">Ω<sub>b</sub></div>
      {chips}
    </div>
  );
}
