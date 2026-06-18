import { OMEGA_B_VALUES } from "./constants";

export type ManifestRun = { id: string; label: string };
export type ManifestCluster = { cluster: string; runs: ManifestRun[] };

export type AppManifest = {
  dataPrefix: string;
  clusters: ManifestCluster[];
};

export async function loadManifest(url: string): Promise<AppManifest> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  return res.json() as Promise<AppManifest>;
}

export function defaultRuns(): ManifestRun[] {
  return [
    { id: "nobar", label: "No bar" },
    ...OMEGA_B_VALUES.map((o) => ({ id: `omega-${o}`, label: `Ω_b = ${o}` })),
  ];
}

export function runsForCluster(manifest: AppManifest | null, cluster: string): ManifestRun[] {
  const entry = manifest?.clusters.find((c) => c.cluster === cluster);
  return entry?.runs?.length ? entry.runs : defaultRuns();
}
