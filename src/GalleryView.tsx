import { useCallback, useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

import {
  formatClusterAge,
  formatClusterName,
  resonanceNotesForRow,
  type CatalogRow,
} from "./catalog";
import {
  ensureRunBundle,
  getCachedBundle,
} from "./loadCluster";
import type { RunBundle } from "./npz";
import type { ManifestRun } from "./manifest";
import {
  buildLayout,
  buildTraces,
  omegaColor,
  orbitSquareRange,
  scaleAxisRange,
  streamRange,
  type StreamRangeMode,
  type ViewMode,
} from "./plot";
import RunChips from "./RunChips";

type Props = {
  cluster: string;
  catalogRow: CatalogRow | undefined;
  runList: ManifestRun[];
  initialSelected: Set<string>;
};

export default function GalleryView({
  cluster,
  catalogRow,
  runList,
  initialSelected,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("stream");
  const [showEscapeTime, setShowEscapeTime] = useState(false);
  const [streamRangeMode, setStreamRangeMode] = useState<StreamRangeMode>("wide");
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomRevision, setZoomRevision] = useState(0);
  const [showSunCircle, setShowSunCircle] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(
    () => new Set(initialSelected),
  );
  const [loadingRuns, setLoadingRuns] = useState<Set<string>>(new Set());
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cacheTick, setCacheTick] = useState(0);

  const bundles = useMemo(() => {
    const map = new Map<string, RunBundle>();
    for (const runId of selectedRuns) {
      const b = getCachedBundle(cluster, runId);
      if (b) map.set(`${cluster}|${runId}`, b);
    }
    return map;
  }, [cluster, selectedRuns, cacheTick]);

  const fetchRun = useCallback(
    async (runId: string) => {
      if (getCachedBundle(cluster, runId)) return;
      setLoadingRuns((prev) => new Set(prev).add(runId));
      setFetchError(null);
      try {
        await ensureRunBundle(cluster, runId);
        setCacheTick((n) => n + 1);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : String(e));
        setSelectedRuns((prev) => {
          const n = new Set(prev);
          n.delete(runId);
          return n;
        });
      } finally {
        setLoadingRuns((prev) => {
          const n = new Set(prev);
          n.delete(runId);
          return n;
        });
      }
    },
    [cluster],
  );

  useEffect(() => {
    for (const runId of selectedRuns) {
      if (!getCachedBundle(cluster, runId)) {
        void fetchRun(runId);
      }
    }
  }, [cluster, selectedRuns, fetchRun]);

  const toggleRun = (runId: string) => {
    setSelectedRuns((prev) => {
      const n = new Set(prev);
      if (n.has(runId)) {
        if (n.size <= 1) return prev;
        n.delete(runId);
      } else {
        n.add(runId);
      }
      return n;
    });
  };

  const baseAxisRange = useMemo(() => {
    if (viewMode === "orbit" || viewMode === "bf_orbit") {
      return orbitSquareRange(bundles, cluster, selectedRuns, viewMode);
    }
    return streamRange(bundles, cluster, selectedRuns, streamRangeMode);
  }, [bundles, cluster, selectedRuns, viewMode, streamRangeMode, cacheTick]);

  const axisRange = useMemo(() => {
    if (viewMode !== "stream" || zoomScale === 1) return baseAxisRange;
    return scaleAxisRange(baseAxisRange, zoomScale);
  }, [baseAxisRange, viewMode, zoomScale]);

  const plotData = useMemo(
    () =>
      buildTraces(
        bundles,
        cluster,
        selectedRuns,
        runList,
        viewMode,
        showEscapeTime,
      ),
    [bundles, cluster, selectedRuns, runList, viewMode, showEscapeTime, cacheTick],
  );

  const revision = `${cluster}-${viewMode}-${showEscapeTime}-${showSunCircle}-${streamRangeMode}-${zoomScale}-${zoomRevision}-${[...selectedRuns].sort().join(",")}`;
  const layout = useMemo(
    () =>
      buildLayout(
        axisRange,
        viewMode,
        showEscapeTime,
        revision,
        showSunCircle,
      ),
    [axisRange, viewMode, showEscapeTime, revision, showSunCircle],
  );

  const orbitLike = viewMode === "orbit" || viewMode === "bf_orbit";

  const resetStreamZoom = () => {
    setStreamRangeMode("wide");
    setZoomScale(1);
    setZoomRevision((n) => n + 1);
  };

  const zoomWideStream = () => {
    setStreamRangeMode("wide");
    setZoomScale(1);
    setZoomRevision((n) => n + 1);
  };

  const zoomInStream = () => {
    setZoomScale((s) => Math.max(0.15, s * 0.75));
    setZoomRevision((n) => n + 1);
  };

  const zoomOutStream = () => {
    setZoomScale((s) => Math.min(4, s * 1.35));
    setZoomRevision((n) => n + 1);
  };

  const age = catalogRow ? formatClusterAge(catalogRow) : null;
  const resonanceNotes = catalogRow ? resonanceNotesForRow(catalogRow) : [];
  const hasData = plotData.length > 0;

  return (
    <div className="gallery">
      <header className="gallery-meta">
        <h1 className="gallery-meta__name">{formatClusterName(cluster)}</h1>
        {age && <p className="gallery-meta__age">{age}</p>}
        {resonanceNotes.length > 0 && (
          <div className="gallery-meta__resonances">
            {resonanceNotes.map((note) => (
              <p
                key={`${note.kind}-${note.omega}`}
                className="gallery-meta__resonance"
              >
                <span className="gallery-meta__resonance-prefix">
                  Near {note.kind} at{" "}
                </span>
                <span style={{ color: omegaColor(note.omega) }}>
                  Ω = {note.omega}
                </span>
              </p>
            ))}
          </div>
        )}
      </header>

      <div className="gallery-body">
        <aside className="gallery-sidebar">
          <RunChips
            runs={runList}
            selected={selectedRuns}
            loadingRuns={loadingRuns}
            onToggle={toggleRun}
            vertical
            showSunChip={orbitLike}
            sunChipOn={showSunCircle}
            onToggleSunChip={() => setShowSunCircle((v) => !v)}
          />
          {viewMode === "stream" && (
            <label className="escape-toggle escape-toggle--sidebar">
              <input
                type="checkbox"
                checked={showEscapeTime}
                onChange={(e) => setShowEscapeTime(e.target.checked)}
              />
              <span>Escape time</span>
            </label>
          )}
        </aside>

        <div className="gallery-main">
          <div className="gallery-plot">
            {hasData ? (
              <Plot
                data={plotData}
                layout={layout}
                style={{ width: "100%", height: "100%" }}
                config={{
                  responsive: true,
                  displayModeBar: false,
                  scrollZoom: viewMode === "stream",
                  doubleClick: false,
                }}
                useResizeHandler
              />
            ) : (
              <p className="gallery-plot__empty">Loading streams…</p>
            )}
            {fetchError && <p className="gallery-error">{fetchError}</p>}
          </div>

          <footer className="gallery-controls">
            <div className="gallery-controls__main">
              <div
                className="view-toggle view-toggle--triple"
                role="group"
                aria-label="View mode"
              >
                <button
                  type="button"
                  className={`view-toggle__btn ${viewMode === "stream" ? "view-toggle__btn--active" : ""}`}
                  onClick={() => setViewMode("stream")}
                >
                  Stream
                </button>
                <button
                  type="button"
                  className={`view-toggle__btn ${viewMode === "orbit" ? "view-toggle__btn--active" : ""}`}
                  onClick={() => setViewMode("orbit")}
                >
                  Orbit
                </button>
                <button
                  type="button"
                  className={`view-toggle__btn ${viewMode === "bf_orbit" ? "view-toggle__btn--active" : ""}`}
                  onClick={() => setViewMode("bf_orbit")}
                >
                  Bar-frame
                </button>
              </div>

              {viewMode === "stream" && (
                <div className="zoom-stack" role="group" aria-label="Zoom">
                  <button
                    type="button"
                    className="zoom-btn zoom-btn--icon"
                    onClick={zoomInStream}
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="zoom-btn zoom-btn--icon"
                    onClick={zoomOutStream}
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="zoom-btn"
                    onClick={zoomWideStream}
                    disabled={streamRangeMode === "wide" && zoomScale === 1}
                  >
                    Wide
                  </button>
                  <button
                    type="button"
                    className="zoom-btn"
                    onClick={resetStreamZoom}
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
