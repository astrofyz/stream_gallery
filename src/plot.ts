import type { Data, Layout } from "plotly.js";
import { ISESCAPER_BOUND_SENTINEL, isescaperToMyrForColor, OMEGA_B_VALUES, SOLAR_CIRCLE_RADIUS_KPC } from "./constants";
import type { RunBundle, XYSeries } from "./npz";
import { percentile1d, subsample1d } from "./stats";
import { parseRunId } from "./paths";
import type { ManifestRun } from "./manifest";

/** Plotly built-in Portland (sampled for per-Ω_b marker colors). */
const PORTLAND: ReadonlyArray<[number, string]> = [
  [0, "rgb(12,51,131)"],
  [0.25, "rgb(10,136,186)"],
  [0.5, "rgb(242,211,56)"],
  [0.75, "rgb(242,143,56)"],
  [1, "rgb(217,30,30)"],
];

/** Plotly Viridis LUT (named scale; explicit array avoids scattergl autocolorscale → Blues). */
const VIRIDIS_COLORSCALE: ReadonlyArray<[number, string]> = [
  [0, "#440154"],
  [0.062745, "#48186a"],
  [0.12549, "#472d7b"],
  [0.188235, "#424086"],
  [0.25098, "#3b528b"],
  [0.313725, "#33638d"],
  [0.376471, "#2c728e"],
  [0.439216, "#26828e"],
  [0.501961, "#21918c"],
  [0.564706, "#1fa088"],
  [0.627451, "#28ae80"],
  [0.690196, "#3fbc73"],
  [0.752941, "#5ec962"],
  [0.815686, "#84d44b"],
  [0.878431, "#addc30"],
  [0.941176, "#d8e219"],
  [1, "#fde725"],
];

export const NOBAR_COLOR = "#8a8a8a";

function parseRgb(color: string): [number, number, number] {
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex) {
    return [parseInt(hex[1]!, 16), parseInt(hex[2]!, 16), parseInt(hex[3]!, 16)];
  }
  return [138, 138, 138];
}

function sampleColorscale(scale: ReadonlyArray<[number, string]>, t: number): string {
  const x = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < scale.length - 1 && scale[i + 1]![0] < x) i++;

  const [t0, c0] = scale[i]!;
  const [t1, c1] = scale[Math.min(i + 1, scale.length - 1)]!;
  if (t0 === t1) return c0;

  const f = (x - t0) / (t1 - t0);
  const [r0, g0, b0] = parseRgb(c0);
  const [r1, g1, b1] = parseRgb(c1);
  const r = Math.round(r0 + (r1 - r0) * f);
  const g = Math.round(g0 + (g1 - g0) * f);
  const b = Math.round(b0 + (b1 - b0) * f);
  return `rgb(${r},${g},${b})`;
}

/** Portland color for a bar-pattern speed (Ω_b). */
export function omegaColor(omega: number): string {
  const idx = (OMEGA_B_VALUES as readonly number[]).indexOf(omega);
  if (idx < 0) return NOBAR_COLOR;
  const t = idx / (OMEGA_B_VALUES.length - 1);
  return sampleColorscale(PORTLAND, t);
}

export function runColor(runId: string): string {
  if (runId === "nobar") return NOBAR_COLOR;
  const m = /^omega-(\d+)$/.exec(runId);
  return m ? omegaColor(Number(m[1])) : NOBAR_COLOR;
}

const P_LO_TIGHT = 1;
const P_HI_TIGHT = 99;
const P_LO_WIDE = 0;
const P_HI_WIDE = 100;

export type ViewMode = "stream" | "orbit" | "bf_orbit";
export type StreamRangeMode = "tight" | "wide";

/** Shrink/expand axis limits about centre (factor < 1 = zoom in). */
export function scaleAxisRange(
  range: { x: [number, number]; y: [number, number] } | null,
  factor: number,
): { x: [number, number]; y: [number, number] } | null {
  if (!range || factor <= 0) return range;
  const cx = (range.x[0] + range.x[1]) / 2;
  const cy = (range.y[0] + range.y[1]) / 2;
  const hx = ((range.x[1] - range.x[0]) / 2) * factor;
  const hy = ((range.y[1] - range.y[0]) / 2) * factor;
  return { x: [cx - hx, cx + hx], y: [cy - hy, cy + hy] };
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
  const escRange = showEscapeTime
    ? computeIsescaperColorRange(bundles, cluster, selectedRuns)
    : null;
  let escaperColorbarShown = false;

  if (viewMode === "orbit") {
    traces.push({
      type: "scattergl",
      mode: "markers",
      name: "GC",
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
      name: "GC",
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
    const solidColor = runColor(runId);

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
          colorscale: [...VIRIDIS_COLORSCALE],
          autocolorscale: false,
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
  showSunCircle = false,
): Partial<Layout> {
  const orbitLike = viewMode === "orbit" || viewMode === "bf_orbit";

  const annotations: Partial<Layout>["annotations"] = [];
  if (viewMode === "orbit") {
    annotations.push({
      x: 0,
      y: 0,
      xref: "x",
      yref: "y",
      text: "GC",
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
      text: "GC",
      showarrow: false,
      xanchor: "left",
      xshift: 10,
      font: { size: 10, color: "rgba(255,255,255,0.55)" },
    });
  }

  const shapes: Partial<Layout>["shapes"] = [];
  if (orbitLike && showSunCircle) {
    const r = SOLAR_CIRCLE_RADIUS_KPC;
    shapes.push({
      type: "circle",
      xref: "x",
      yref: "y",
      x0: -r,
      y0: -r,
      x1: r,
      y1: r,
      line: {
        color: "rgba(232,184,74,0.7)",
        width: 1.5,
        dash: "dash",
      },
      fillcolor: "rgba(0,0,0,0)",
      layer: "above",
    });
  }

  return {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    dragmode: viewMode === "stream" ? "pan" : false,
    margin: {
      l: 8,
      r: showEscapeTime && viewMode === "stream" ? 48 : 8,
      t: 8,
      b: 8,
    },
    hovermode: false,
    showlegend: false,
    annotations,
    shapes: shapes.length > 0 ? shapes : undefined,
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
