/**
 * Mid-rank percentile: p = (L + 0.5·E) / N, where L counts non-null values strictly below x,
 * E counts values equal to x (including x itself) and N counts non-null values.
 *
 * Ties share one percentile, so the ~half of schools that report $0 of research all land at the
 * same point instead of being ordered by whatever order they happened to arrive in.
 * Missing values come back as NaN.
 */
export function midRankPercentiles(values: ArrayLike<number | null | undefined>, mask?: Uint8Array): Float64Array {
  const n = values.length;
  const out = new Float64Array(n).fill(NaN);
  const present: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (mask && !mask[i]) continue;
    if (v !== null && v !== undefined && Number.isFinite(v)) present.push(v);
  }
  const N = present.length;
  if (N === 0) return out;
  present.sort((a, b) => a - b);

  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const lo = lowerBound(present, v);
    const hi = upperBound(present, v);
    out[i] = (lo + 0.5 * (hi - lo)) / N;
  }
  return out;
}

function lowerBound(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
