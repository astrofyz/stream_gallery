import Papa from "papaparse";

import { OMEGA_B_VALUES } from "./constants";

export type CatalogRow = Record<string, string>;

export type ResonanceKind = "CR" | "ILR" | "OLR";

export type ResonanceNote = {
  kind: ResonanceKind;
  omega: number;
};

const FREQRATIO_TOLERANCE = 0.02;

const RESONANCE_TARGETS: ReadonlyArray<{ value: number; kind: ResonanceKind }> = [
  { value: 0, kind: "CR" },
  { value: 0.5, kind: "ILR" },
  { value: -0.5, kind: "OLR" },
];

export async function loadCatalog(relativeUrl: string): Promise<CatalogRow[]> {
  const url = relativeUrl.startsWith("http")
    ? relativeUrl
    : new URL(relativeUrl, window.location.href).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse<CatalogRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    console.warn("CSV parse warnings", parsed.errors);
  }
  return parsed.data.filter((r) => r.Cluster?.trim());
}

/** Human-readable cluster name for display. */
export function formatClusterName(cluster: string): string {
  return cluster.replace(/_/g, " ");
}

/**
 * Format age from catalog row. Supports logAge50 (log10 age in yr) or age_Gyr.
 */
export function formatClusterAge(row: CatalogRow): string | null {
  const logAge = row.logAge50?.trim();
  if (logAge) {
    const logYr = Number(logAge);
    if (!Number.isFinite(logYr)) return null;
    const gyr = Math.pow(10, logYr - 9);
    if (gyr >= 1) return `${gyr.toFixed(2)} Gyr`;
    const myr = gyr * 1000;
    if (myr >= 10) return `${Math.round(myr)} Myr`;
    return `${myr.toFixed(1)} Myr`;
  }
  const ageGyr = row.age_Gyr?.trim();
  if (ageGyr) {
    const gyr = Number(ageGyr);
    if (!Number.isFinite(gyr)) return null;
    if (gyr >= 1) return `${gyr.toFixed(2)} Gyr`;
    const myr = gyr * 1000;
    if (myr >= 10) return `${Math.round(myr)} Myr`;
    return `${myr.toFixed(1)} Myr`;
  }
  return null;
}

/** freqratio_{omega} within 0.02 of 0 (CR), +0.5 (ILR), or −0.5 (OLR). */
export function resonanceNotesForRow(row: CatalogRow): ResonanceNote[] {
  const notes: ResonanceNote[] = [];

  for (const omega of OMEGA_B_VALUES) {
    const raw = row[`freqratio_${omega}`]?.trim();
    if (!raw) continue;

    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    for (const { value: target, kind } of RESONANCE_TARGETS) {
      if (Math.abs(value - target) <= FREQRATIO_TOLERANCE) {
        notes.push({ kind, omega });
        break;
      }
    }
  }

  return notes;
}
