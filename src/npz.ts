import { unzipSync } from "fflate";
import { load } from "npyjs";

export type NpzArrays = Record<string, Float32Array | Float64Array>;

export type XYSeries = {
  x: Float32Array | Float64Array;
  y: Float32Array | Float64Array;
  isescaper?: Float32Array | Float64Array;
};

/** One file per run: stream, galactic orbit, bar-frame orbit. */
export type RunBundle = {
  stream: XYSeries;
  orbit: XYSeries;
  bfOrbit: XYSeries;
};

export async function loadNpz(arrayBuffer: ArrayBuffer): Promise<NpzArrays> {
  const u8 = new Uint8Array(arrayBuffer);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(u8);
  } catch {
    throw new Error("Not a valid NPZ (zip) file");
  }
  const out: NpzArrays = {};
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith(".npy")) continue;
    const key = name.replace(/\.npy$/i, "");
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const parsed = await load(buf);
    const typed = parsed.data;
    if (!(typed instanceof Float32Array) && !(typed instanceof Float64Array)) {
      throw new Error(`Unsupported array type for ${key} (use flat float arrays, not pickled dicts)`);
    }
    out[key] = typed;
  }
  return out;
}

function requireKey(arrays: NpzArrays, name: string): Float32Array | Float64Array {
  const a = arrays[name];
  if (!a) throw new Error(`Missing "${name}" in NPZ`);
  return a;
}

/**
 * Parse flat gallery NPZ keys into stream / orbit / bf_orbit series.
 *
 * Expected keys: stream_x, stream_y, orbit_x, orbit_y, bf_orbit_x, bf_orbit_y,
 * optional stream_isescaper.
 */
export async function loadGalleryNpz(arrayBuffer: ArrayBuffer): Promise<RunBundle> {
  const raw = await loadNpz(arrayBuffer);
  const bundle: RunBundle = {
    stream: {
      x: requireKey(raw, "stream_x"),
      y: requireKey(raw, "stream_y"),
      ...(raw.stream_isescaper ? { isescaper: raw.stream_isescaper } : {}),
    },
    orbit: {
      x: requireKey(raw, "orbit_x"),
      y: requireKey(raw, "orbit_y"),
    },
    bfOrbit: {
      x: requireKey(raw, "bf_orbit_x"),
      y: requireKey(raw, "bf_orbit_y"),
    },
  };
  return bundle;
}
