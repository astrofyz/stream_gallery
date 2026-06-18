import type { CatalogRow } from "./catalog";
import { loadGalleryNpz, type RunBundle } from "./npz";
import { dataUrl, parseRunId, runNpzPath, type RunId } from "./paths";

const bundleCache = new Map<string, RunBundle>();
const inflight = new Map<string, Promise<RunBundle>>();

function cacheKey(cluster: string, runId: string): string {
  return `${cluster}|${runId}`;
}

export function clearBundleCache(): void {
  bundleCache.clear();
  inflight.clear();
}

export function getCachedBundle(cluster: string, runId: string): RunBundle | undefined {
  return bundleCache.get(cacheKey(cluster, runId));
}

/** Random cluster from catalog (user-curated list). */
export function pickRandomCluster(catalog: CatalogRow[]): string {
  if (catalog.length === 0) throw new Error("Catalog is empty");
  return catalog[Math.floor(Math.random() * catalog.length)]!.Cluster;
}

export async function ensureRunBundle(
  cluster: string,
  runId: string,
): Promise<RunBundle> {
  const key = cacheKey(cluster, runId);
  const cached = bundleCache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const rid = parseRunId(runId);
  if (!rid) throw new Error(`Invalid run id: ${runId}`);

  const promise = (async () => {
    const path = runNpzPath(cluster, rid as RunId);
    const res = await fetch(dataUrl(path));
    if (!res.ok) {
      throw new Error(`Missing ${path} (${res.status})`);
    }
    const bundle = await loadGalleryNpz(await res.arrayBuffer());
    bundleCache.set(key, bundle);
    inflight.delete(key);
    return bundle;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    inflight.delete(key);
    throw e;
  }
}

export async function preloadRuns(
  cluster: string,
  runIds: Iterable<string>,
): Promise<void> {
  await Promise.all([...runIds].map((id) => ensureRunBundle(cluster, id)));
}
