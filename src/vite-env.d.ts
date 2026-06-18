/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_BASE?: string;
  readonly VITE_DATA_PREFIX?: string;
  readonly VITE_MANIFEST_URL?: string;
  readonly VITE_CATALOG_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "react-plotly.js" {
  import type { ComponentType, CSSProperties } from "react";
  import type { Data, Layout } from "plotly.js";

  export interface PlotParams {
    data: Data[];
    layout?: Partial<Layout>;
    config?: Record<string, unknown>;
    style?: CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: unknown, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: unknown, graphDiv: HTMLElement) => void;
    onPurge?: (figure: unknown, graphDiv: HTMLElement) => void;
    onError?: (err: unknown) => void;
    divId?: string;
    revision?: number;
    debug?: boolean;
  }

  const Plot: ComponentType<PlotParams>;
  export default Plot;
}
