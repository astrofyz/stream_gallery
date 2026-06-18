import Papa from "papaparse";

export type CatalogRow = Record<string, string>;

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
