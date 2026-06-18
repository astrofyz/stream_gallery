import { OMEGA_B_VALUES } from "./constants";

export type RunId = "nobar" | `omega-${number}`;

export const GALLERY_DATA_PREFIX =
  import.meta.env.VITE_DATA_PREFIX?.trim() || "tmp";

export function parseRunId(id: string): RunId | null {
  if (id === "nobar") return "nobar";
  const m = /^omega-(\d+)$/.exec(id);
  if (m) return `omega-${Number(m[1])}` as RunId;
  return null;
}

/** Filename suffix: nobar → 0, omega-20 → 20, … */
export function runIdToOmegaSuffix(runId: RunId): number {
  if (runId === "nobar") return 0;
  return Number(runId.replace("omega-", ""));
}

/** Relative path: tmp/{Cluster}_{omega}.npz (cluster name as in catalog). */
export function runNpzPath(clusterCatalogName: string, runId: RunId): string {
  const omega = runIdToOmegaSuffix(runId);
  const prefix = GALLERY_DATA_PREFIX.replace(/\/$/, "");
  return `${prefix}/${clusterCatalogName}_${omega}.npz`;
}

export function defaultRunIds(): RunId[] {
  return ["nobar", ...OMEGA_B_VALUES.map((o) => `omega-${o}` as RunId)];
}

export function withBaseUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL;
  const p = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${base}${p}`;
}

/** NPZ files: use VITE_DATA_BASE in production (R2), else same-origin under public/. */
export function dataUrl(relativePath: string): string {
  const dataBase = import.meta.env.VITE_DATA_BASE?.trim();
  if (dataBase) {
    const base = dataBase.endsWith("/") ? dataBase : `${dataBase}/`;
    const p = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
    return `${base}${p}`;
  }
  return withBaseUrl(relativePath);
}

export function resolveStaticUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (t.startsWith("https://") || t.startsWith("http://")) return t;
  return withBaseUrl(t.startsWith("/") ? t.slice(1) : t);
}
