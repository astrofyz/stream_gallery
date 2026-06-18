import type { Data, Layout } from "plotly.js";
import { ISESCAPER_BOUND_SENTINEL, isescaperToMyrForColor } from "./constants";
import type { RunBundle, XYSeries } from "./npz";
import { percentile1d, subsample1d } from "./stats";
import { parseRunId } from "./paths";
import type { ManifestRun } from "./manifest";

export const PLOT_COLORS = [
  "#636efa",
  "#ef553b",
  "#00cc96",
  "#ab63fa",
  "#ffa15a",
  "#19d3f3",
  "#ff6692",
  "#b6e880",
  "#ff97ff",
];

export const NOBAR_COLOR = "#8a8a8a";

const P_LO_TIGHT = 1;
const P_HI_TIGHT = 99;
const P_LO_WIDE = 0;
const P_HI_WIDE = 100;

export type ViewMode = "stream" | "orbit" | "bf_orbit";
export type StreamRangeMode = "tight" | "wide";

export function runColor(runId: string, paletteIdx: number): string {
  return runId === "nobar" ? NOBAR_COLOR : PLOT_COLORS[paletteIdx % PLOT_COLORS.length]!;
}

function orbitSeries(bundle: RunBundle, viewMode: ViewMode): XYSeries {
  return viewMode === "bf_orbit" ? bundle.bfOrbit : bundle.orbit;
}

function streamPointRange(
  bundles: Map<string, RunBundle>,
  cluster: string,
  selectedRuns: Set<string>,
  pLo: number,
  pHi: number,
): { x: [number, number]; y: [number, number] } | null {
  const xVals: number[] = [];
  const yVals: number[] = [];
  for (const runId of selectedRuns) {
    const rid = parseRunId(runId);
    if (!rid) continue;
    const b = bundles.get(`${cluster}|${runId}`);
    if (!b) continue;
    xVals.push(...b.stream.x);
    yVals.push(...b.stream.y);
  }
  if (xVals.length === 0) return null;
  return {
    x: [percentile1d(Float64Array.from(xVals), pLo), percentile1d(Float64Array.from(xVals), pHi)],
    y: [percentile1d(Float64Array.from(yVals), pLo), percentile1d(Float64Array.from(yVals), pHi)],
  };
}

export function streamRange(
  bundles: Map<string, RunBundle>,
  cluster: string,
  selectedRuns: Set<string>,
  mode: StreamRangeMode,
): { x: [number, number]; y: [number, number] } | null {
  return streamPointRange(
    bundles,
    cluster,
    selectedRuns,
    mode === "wide" ? P_LO_WIDE : P_LO_TIGHT,
    mode === "wide" ? P_HI_WIDE : P_HI_TIGHT,
  );
}

/** Square limits from max radius about origin (for orbit views). */
export function orbitSquareRange(
  bundles: Map<string, RunBundle>,
  cluster: string,
  selectedRuns: Set<string>,
  viewMode: "orbit" | "bf_orbit",
  padding = 1.08,
): { x: [number, number]; y: [number, number] } | null {
  let rMax = 0;
  for (const runId of selectedRuns) {
    const rid = parseRunId(runId);
    if (!rid) continue;
    const b = bundles.get(`${cluster}|${runId}`);
    if (!b) continue;
    const { x: ox, y: oy } = orbitSeries(b, viewMode);
    for (let i = 0; i < ox.length; i++) {
      rMax = Math.max(rMax, Math.hypot(ox[i], oy[i]));
    }
  }
  if (rMax === 0) return null;
  const lim = rMax * padding;
  return { x: [-lim, lim], y: [-lim, lim] };
}

export function computeIsescaperColorRange(
  bundles: Map<string, RunBundle>,
  cluster: string,
  selectedRuns: Set<string>,
): { cmin: number; cmax: number } | null {
  let globalMin = Infinity;
  let globalMax = -Infinity;

  for (const runId of selectedRuns) {
    const rid = parseRunId(runId);
    if (!rid) continue;
    const b = bundles.get(`${cluster}|${runId}`);
    const col = b?.stream.isescaper;
    if (!col) continue;

    let runMin = Infinity;
    let runMax = -Infinity;
    for (let i = 0; i < col.length; i++) {
      const v = col[i];
      if (v > ISESCAPER_BOUND_SENTINEL) {
        const myr = isescaperToMyrForColor(v);
        runMin = Math.min(runMin, myr);
        runMax = Math.max(runMax, myr);
      }
    }
    if (runMin !== Infinity) {
      globalMin = Math.min(globalMin, runMin);
      globalMax = Math.max(globalMax, runMax);
    }
  }

  if (globalMin === Infinity) return null;
  if (globalMin === globalMax) {
    const e = 1e-9 * (Math.abs(globalMin) || 1);
    return { cmin: globalMin - e, cmax: globalMax + e };
  }
  return { cmin: globalMin, cmax: globalMax };
}

export function buildTraces(
  bundles: Map<string, RunBundle>,
  cluster: string,
  selectedRuns: Set<string>,
  runList: ManifestRun[],
  viewMode: ViewMode,
  showEscapeTime: boolean,
): Data[] {
  const traces: Data[] = [];
  let paletteIdx = 0;
  const escRange = showEscapeTime
    ? computeIsescaperColorRange(bundles, cluster, selectedRuns)
    : null;
  let escaperColorbarShown = false;

  if (viewMode === "orbit") {
    traces.push({
      type: "scattergl",
      mode: "markers",
      name: "Galactic centre",
      x: [0],
      y: [0],
      marker: {
        size: 12,
        color: "rgba(255,255,255,0.9)",
        symbol: "circle-open",
        line: { width: 2, color: "rgba(255,255,255,0.9)" },
      },
      hoverinfo: "skip",
      showlegend: false,
    });
  }

  if (viewMode === "bf_orbit") {
    traces.push({
      type: "scattergl",
      mode: "markers",
      name: "Bar centre",
      x: [0],
      y: [0],
      marker: {
        size: 10,
        color: "rgba(255,255,255,0.7)",
        symbol: "circle-open",
        line: { width: 1.5, color: "rgba(255,255,255,0.7)" },
      },
      hoverinfo: "skip",
      showlegend: false,
    });
  }

  for (const runId of selectedRuns) {
    const rid = parseRunId(runId);
    if (!rid) continue;
    const b = bundles.get(`${cluster}|${runId}`);
    if (!b) continue;
    const label = runList.find((r) => r.id === runId)?.label ?? runId;
    const solidColor =
      runId === "nobar" ? NOBAR_COLOR : PLOT_COLORS[paletteIdx++ % PLOT_COLORS.length]!;

    if (viewMode === "stream") {
      const xs = b.stream.x;
      const ys = b.stream.y;
      const xPlot = subsample1d(xs, xs.length);
      const yPlot = subsample1d(ys, ys.length);

      const escCol = b.stream.isescaper;
      const escSub =
        escCol && escCol.length === xs.length ? subsample1d(escCol, escCol.length) : null;
      const escMyr = escSub ? escSub.map((v) => isescaperToMyrForColor(v)) : null;
      const useEscaper = showEscapeTime && escRange !== null && escMyr !== null;

      let marker: Record<string, unknown>;
      if (useEscaper && escRange && escMyr) {
        const showBar = !escaperColorbarShown;
        escaperColorbarShown = true;
        marker = {
          size: 2,
          opacity: 0.8,
          color: escMyr,
          colorscale: "Plasma",
          cmin: escRange.cmin,
          cmax: escRange.cmax,
          colorbar: showBar
            ? {
                title: { text: "Myr", side: "right" },
                thickness: 12,
                len: 0.5,
                x: 1.02,
                tickfont: { size: 10, color: "#aaa" },
              }
            : undefined,
          showscale: showBar,
        };
      } else {
        marker = { size: 2, opacity: 0.8, color: solidColor };
      }

      traces.push({
        type: "scattergl",
        mode: "markers",
        name: label,
        x: xPlot,
        y: yPlot,
        marker,
        hoverinfo: "skip",
        legendgroup: runId,
      });
    } else {
      const { x: ox, y: oy } = orbitSeries(b, viewMode);
      traces.push({
        type: "scattergl",
        mode: "lines",
        name: label,
        x: subsample1d(ox, ox.length),
        y: subsample1d(oy, oy.length),
        line: { width: 2, color: solidColor },
        hoverinfo: "skip",
        legendgroup: runId,
      });
    }
  }
  return traces;
}

export function buildLayout(
  axisRange: { x: [number, number]; y: [number, number] } | null,
  viewMode: ViewMode,
  showEscapeTime: boolean,
  revision: string,
): Partial<Layout> {
  const orbitLike = viewMode === "orbit" || viewMode === "bf_orbit";

  const annotations: Partial<Layout>["annotations"] = [];
  if (viewMode === "orbit") {
    annotations.push({
      x: 0,
      y: 0,
      xref: "x",
      yref: "y",
      text: "Galactic centre",
      showarrow: false,
      xanchor: "left",
      xshift: 10,
      font: { size: 10, color: "rgba(255,255,255,0.55)" },
    });
  }
  if (viewMode === "bf_orbit") {
    annotations.push({
      x: 0,
      y: 0,
      xref: "x",
      yref: "y",
      text: "Bar centre",
      showarrow: false,
      xanchor: "left",
      xshift: 10,
      font: { size: 10, color: "rgba(255,255,255,0.55)" },
    });
  }

  return {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    margin: {
      l: 8,
      r: showEscapeTime && viewMode === "stream" ? 48 : 8,
      t: 8,
      b: 8,
    },
    hovermode: false,
    showlegend: false,
    annotations,
    xaxis: {
      showgrid: false,
      zeroline: orbitLike,
      zerolinecolor: "rgba(255,255,255,0.15)",
      zerolinewidth: 1,
      showticklabels: false,
      ...(axisRange ? { range: axisRange.x, autorange: false } : { autorange: true }),
    },
    yaxis: {
      showgrid: false,
      zeroline: orbitLike,
      zerolinecolor: "rgba(255,255,255,0.15)",
      zerolinewidth: 1,
      showticklabels: false,
      scaleanchor: "x",
      scaleratio: 1,
      ...(axisRange ? { range: axisRange.y, autorange: false } : { autorange: true }),
    },
    uirevision: revision,
  };
}
