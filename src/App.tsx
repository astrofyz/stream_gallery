import { useEffect, useState } from "react";

import { loadCatalog, type CatalogRow } from "./catalog";
import GalleryView from "./GalleryView";
import LoadingScreen from "./LoadingScreen";
import {
  clearBundleCache,
  pickRandomCluster,
  preloadRuns,
} from "./loadCluster";
import { defaultRuns } from "./manifest";
import { defaultRunIds } from "./paths";
import { resolveStaticUrl } from "./paths";

const MIN_LOAD_MS = 1500;

type AppState =
  | { phase: "loading" }
  | { phase: "ready"; cluster: string; catalog: CatalogRow[] }
  | { phase: "error"; message: string };

export default function App() {
  const [state, setState] = useState<AppState>({ phase: "loading" });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const t0 = Date.now();
      try {
        const catalogUrl =
          import.meta.env.VITE_CATALOG_URL?.trim() || "catalog.csv";

        const catalog = await loadCatalog(resolveStaticUrl(catalogUrl));

        if (cancelled) return;

        const cluster = pickRandomCluster(catalog);
        clearBundleCache();

        const allRunIds = defaultRunIds();
        await preloadRuns(cluster, allRunIds);

        if (cancelled) return;

        const elapsed = Date.now() - t0;
        const wait = Math.max(0, MIN_LOAD_MS - elapsed);
        await new Promise((r) => setTimeout(r, wait));

        if (cancelled) return;

        setFading(true);
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled) return;

        setState({ phase: "ready", cluster, catalog });
      } catch (e) {
        if (!cancelled) {
          setState({
            phase: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === "error") {
    return (
      <div className="app-error">
        <p>{state.message}</p>
      </div>
    );
  }

  if (state.phase === "loading") {
    return <LoadingScreen visible={!fading} fading={fading} />;
  }

  const catalogRow = state.catalog.find((r) => r.Cluster === state.cluster);
  const runList = defaultRuns();
  const allRunIds = new Set(runList.map((r) => r.id));

  return (
    <GalleryView
      cluster={state.cluster}
      catalogRow={catalogRow}
      runList={runList}
      initialSelected={allRunIds}
    />
  );
}
