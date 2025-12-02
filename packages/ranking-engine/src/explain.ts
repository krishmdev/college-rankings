import type { ActiveMetric, RankResult } from './score';
import { activeMetrics, compareSchools, scoreSchool } from './score';
import type { MetricKey, Profile } from './types';

export interface Contribution {
  key: MetricKey;
  weight: number;
  /** Share of total weight, 0-1. */
  share: number;
  /** Oriented metric score 0-1 actually used (imputed when missing). */
  s: number;
  imputed: boolean;
  /** Points out of 100. Contributions of all active metrics sum to the school's score. */
  points: number;
}

export function contributions(result: RankResult, schoolIdx: number): Contribution[] {
  const { active, totalWeight, pct, profile } = result;
  if (totalWeight <= 0) return [];
  const parts = scoreSchool(pct, active, totalWeight, profile.missing, schoolIdx, true);
  return active.map((a, j) => ({
    key: a.key,
    weight: a.weight,
    share: a.weight / totalWeight,
    s: parts.s[j]!,
    imputed: parts.imputed[j] === 1,
    points: (100 * a.weight * parts.s[j]!) / totalWeight,
  }));
}

/** Contributions sorted by points, largest first. */
export function topContributions(result: RankResult, schoolIdx: number, n = 3): Contribution[] {
  return contributions(result, schoolIdx)
    .sort((a, b) => b.points - a.points || a.key.localeCompare(b.key))
    .slice(0, n);
}

export interface NeighborDelta {
  schoolIdx: number;
  rank: number;
  score: number;
  /** This school's score minus the neighbor's. */
  gap: number;
  /** Per metric: this school's points minus the neighbor's, largest absolute first. */
  deltas: { key: MetricKey; points: number }[];
}

export interface Explanation {
  schoolIdx: number;
  rank: number;
  of: number;
  score: number;
  coverage: number;
  contributions: Contribution[];
  above: NeighborDelta | null;
  below: NeighborDelta | null;
}

function neighbor(result: RankResult, schoolIdx: number, mine: Contribution[], r: number): NeighborDelta | null {
  if (r < 1 || r > result.order.length) return null;
  const idx = result.order[r - 1]!;
  const theirs = contributions(result, idx);
  const deltas = mine
    .map((c, j) => ({ key: c.key, points: c.points - theirs[j]!.points }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.key.localeCompare(b.key));
  return {
    schoolIdx: idx,
    rank: r,
    score: result.score[idx]!,
    gap: result.score[schoolIdx]! - result.score[idx]!,
    deltas,
  };
}

export function explain(result: RankResult, schoolIdx: number): Explanation | null {
  const r = result.rankOf[schoolIdx]!;
  if (r === 0) return null;
  const mine = contributions(result, schoolIdx);
  return {
    schoolIdx,
    rank: r,
    of: result.order.length,
    score: result.score[schoolIdx]!,
    coverage: result.coverage[schoolIdx]!,
    contributions: mine,
    above: neighbor(result, schoolIdx, mine, r - 1),
    below: neighbor(result, schoolIdx, mine, r + 1),
  };
}

/**
 * Rank of one school under a different profile, without sorting everything: count the schools
 * that would sort ahead of it. Uses the same percentile arrays and filter mask as `result`.
 */
export function rankUnder(result: RankResult, profile: Profile, schoolIdx: number): number {
  const { index, pct, mask } = result;
  const active: ActiveMetric[] = activeMetrics(index, profile);
  const totalWeight = active.reduce((acc, a) => acc + a.weight, 0);
  const n = index.schools.length;
  const score = new Float64Array(n);
  const coverage = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const s = scoreSchool(pct, active, totalWeight, profile.missing, i);
    score[i] = s.score;
    coverage[i] = s.coverage;
  }
  let ahead = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i] || i === schoolIdx) continue;
    if (compareSchools(index, score, coverage, i, schoolIdx) < 0) ahead++;
  }
  return ahead + 1;
}

export interface Sensitivity {
  key: MetricKey;
  weight: number;
  rankIfZero: number;
  rankIfDoubled: number;
}

/** How the school's rank moves if each weighted metric is dropped or doubled. */
export function sensitivity(result: RankResult, schoolIdx: number): Sensitivity[] {
  if (result.rankOf[schoolIdx] === 0) return [];
  return result.active.map((a) => {
    const zero = { ...result.profile, weights: { ...result.profile.weights, [a.key]: 0 } };
    const dbl = { ...result.profile, weights: { ...result.profile.weights, [a.key]: a.weight * 2 } };
    return {
      key: a.key,
      weight: a.weight,
      rankIfZero: rankUnder(result, zero, schoolIdx),
      rankIfDoubled: rankUnder(result, dbl, schoolIdx),
    };
  });
}
