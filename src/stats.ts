export function subsample1d(
  data: Float32Array | Float64Array,
  maxPoints: number,
): number[] {
  const n = data.length;
  if (maxPoints <= 0 || n <= maxPoints) return Array.from(data);
  const step = Math.ceil(n / maxPoints);
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(data[i]);
  return out;
}

export function percentile1d(data: Float32Array | Float64Array, p: number): number {
  if (data.length === 0) return NaN;
  const arr = Array.from(data);
  arr.sort((a, b) => a - b);
  const pos = (p / 100) * (arr.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return arr[lo];
  return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
}
