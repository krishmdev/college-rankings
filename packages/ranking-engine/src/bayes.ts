import { CROWD_KEYS } from './registry';
import type { MetricKey } from './types';

export const PRIOR_STRENGTH = 5;
export const MIN_REVIEWS = 3;

export interface RatingAggregate {
  n: number;
  avg: number;
}

/** Pulls a small-sample mean toward the prior: (n·mean + m·μ) / (n + m). */
export function bayesianAverage(n: number, mean: number, prior: number, m = PRIOR_STRENGTH): number {
  if (n <= 0) return prior;
  return (n * mean + m * prior) / (n + m);
}

export type CrowdDimension = 'overall' | 'academics' | 'social' | 'career' | 'housing' | 'safety' | 'value';
export type SchoolAggregates = Partial<Record<CrowdDimension, RatingAggregate>>;

export const CROWD_DIMENSIONS: readonly CrowdDimension[] = CROWD_KEYS.map(
  (k) => k.replace('crowd_', '') as CrowdDimension,
);

/**
 * Converts per-school rating aggregates into crowd metric values. The prior for each dimension is
 * the review-weighted mean across all schools. Schools with fewer than `minReviews` reviews on a
 * dimension get null, so they're handled by the missing-data strategy instead of a noisy average.
 */
export function crowdMetricValues(
  aggregates: ReadonlyMap<number, SchoolAggregates>,
  opts: { m?: number; minReviews?: number } = {},
): Map<number, Partial<Record<MetricKey, number | null>>> {
  const m = opts.m ?? PRIOR_STRENGTH;
  const minReviews = opts.minReviews ?? MIN_REVIEWS;
  const priors = new Map<CrowdDimension, number>();
  for (const dim of CROWD_DIMENSIONS) {
    let sum = 0;
    let n = 0;
    for (const agg of aggregates.values()) {
      const a = agg[dim];
      if (!a || a.n <= 0) continue;
      sum += a.n * a.avg;
      n += a.n;
    }
    priors.set(dim, n > 0 ? sum / n : 3);
  }
  const out = new Map<number, Partial<Record<MetricKey, number | null>>>();
  for (const [id, agg] of aggregates) {
    const values: Partial<Record<MetricKey, number | null>> = {};
    for (const dim of CROWD_DIMENSIONS) {
      const a = agg[dim];
      const key = `crowd_${dim}` as MetricKey;
      values[key] = a && a.n >= minReviews ? bayesianAverage(a.n, a.avg, priors.get(dim)!, m) : null;
    }
    out.set(id, values);
  }
  return out;
}
