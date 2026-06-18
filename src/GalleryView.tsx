import { useCallback, useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

import { formatClusterAge, formatClusterName, type CatalogRow } from "./catalog";
import {
  ensureRunBundle,
  getCachedBundle,
} from "./loadCluster";
import type { RunBundle } from "./npz";
import type { ManifestRun } from "./manifest";
import {
  buildLayout,
  buildTraces,
  orbitSquareRange,
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
  const [streamRangeMode, setStreamRangeMode] = useState<StreamRangeMode>("tight");
  const [zoomRevision, setZoomRevision] = useState(0);
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

  const axisRange = useMemo(() => {
    if (viewMode === "orbit" || viewMode === "bf_orbit") {
      return orbitSquareRange(bundles, cluster, selectedRuns, viewMode);
    }
    return streamRange(bundles, cluster, selectedRuns, streamRangeMode);
  }, [bundles, cluster, selectedRuns, viewMode, streamRangeMode, cacheTick]);

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

  const revision = `${cluster}-${viewMode}-${showEscapeTime}-${streamRangeMode}-${zoomRevision}-${[...selectedRuns].sort().join(",")}`;
  const layout = useMemo(
    () => buildLayout(axisRange, viewMode, showEscapeTime, revision),
    [axisRange, viewMode, showEscapeTime, revision],
  );

  const resetStreamZoom = () => {
    setStreamRangeMode("tight");
    setZoomRevision((n) => n + 1);
  };

  const zoomOutStream = () => {
    setStreamRangeMode("wide");
    setZoomRevision((n) => n + 1);
  };

  const age = catalogRow ? formatClusterAge(catalogRow) : null;
  const hasData = plotData.length > 0;

  return (
    <div className="gallery">
      <header className="gallery-meta">
        <h1 className="gallery-meta__name">{formatClusterName(cluster)}</h1>
        {age && <p className="gallery-meta__age">{age}</p>}
      </header>

      <div className="gallery-body">
        <aside className="gallery-sidebar">
          <RunChips
            runs={runList}
            selected={selectedRuns}
            loadingRuns={loadingRuns}
            onToggle={toggleRun}
            vertical
          />
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
            <div className="gallery-controls__row">
              <div className="view-toggle view-toggle--triple" role="group" aria-label="View mode">
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

              <div className="gallery-controls__actions">
                {viewMode === "stream" && (
                  <>
                    <button
                      type="button"
                      className="zoom-btn"
                      onClick={zoomOutStream}
                      disabled={streamRangeMode === "wide"}
                    >
                      Zoom out
                    </button>
                    <button
                      type="button"
                      className="zoom-btn"
                      onClick={resetStreamZoom}
                    >
                      Reset
                    </button>
                  </>
                )}

                <label className="escape-toggle">
                  <input
                    type="checkbox"
                    checked={showEscapeTime}
                    disabled={viewMode !== "stream"}
                    onChange={(e) => setShowEscapeTime(e.target.checked)}
                  />
                  <span>Escape time</span>
                </label>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
