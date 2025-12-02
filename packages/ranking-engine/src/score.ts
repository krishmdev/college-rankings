import { filterHash, isEmptyFilters, matchesFilters } from './filters';
import { imputedScore } from './missing';
import { midRankPercentiles } from './percentile';
import { METRICS } from './registry';
import type { MetricDef, MetricKey, Profile, School } from './types';

export interface RankIndex {
  /** Schools in canonical order (ascending id). Input order never matters. */
  readonly schools: readonly School[];
  readonly metrics: readonly MetricDef[];
  readonly metricIndex: ReadonlyMap<MetricKey, number>;
  /** National percentile per metric (registry order), NaN where the value is missing. */
  readonly pct: readonly Float64Array[];
  readonly idToIdx: ReadonlyMap<number, number>;
  /** Lower-cased names for tie-breaks; code-unit order so results don't depend on locale. */
  readonly sortName: readonly string[];
  /** Filtered-percentile cache keyed by filter hash. */
  readonly cache: Map<string, { mask: Uint8Array; pct: Float64Array[] }>;
}

export function buildIndex(input: readonly School[], metrics: readonly MetricDef[] = METRICS): RankIndex {
  const schools = [...input].sort((a, b) => a.id - b.id);
  for (let i = 1; i < schools.length; i++) {
    if (schools[i]!.id === schools[i - 1]!.id) throw new Error(`duplicate school id ${schools[i]!.id}`);
  }
  const pct = metrics.map((m) => midRankPercentiles(schools.map((s) => s.values[m.key] ?? null)));
  return {
    schools,
    metrics,
    metricIndex: new Map(metrics.map((m, i) => [m.key, i])),
    pct,
    idToIdx: new Map(schools.map((s, i) => [s.id, i])),
    sortName: schools.map((s) => s.name.toLowerCase()),
    cache: new Map(),
  };
}

export interface ActiveMetric {
  k: number;
  key: MetricKey;
  weight: number;
  lowerIsBetter: boolean;
}

/** Metrics with a positive weight, in registry order, with the profile's direction resolved. */
export function activeMetrics(index: RankIndex, profile: Profile): ActiveMetric[] {
  const out: ActiveMetric[] = [];
  index.metrics.forEach((m, k) => {
    const w = profile.weights[m.key] ?? 0;
    if (!(w > 0) || !Number.isFinite(w)) return;
    const dir =
      m.direction === 'preference' ? (profile.directions[m.key] ?? m.defaultDirection ?? 'higher') : m.direction;
    out.push({ k, key: m.key, weight: w, lowerIsBetter: dir === 'lower' });
  });
  return out;
}

export interface RankResult {
  index: RankIndex;
  profile: Profile;
  active: ActiveMetric[];
  totalWeight: number;
  /** Percentile arrays used for this ranking (national or filtered). */
  pct: readonly Float64Array[];
  /** 1 where the school passes the filters. */
  mask: Uint8Array;
  /** Score 0-100 per school index; NaN for filtered-out schools. */
  score: Float64Array;
  /** Share of the profile's weight backed by real data, per school index. */
  coverage: Float64Array;
  /** School indexes, best first. Only schools passing the filters. */
  order: Int32Array;
  /** 1-based rank per school index; 0 for filtered-out schools. */
  rankOf: Int32Array;
}

function percentilesFor(index: RankIndex, profile: Profile): { mask: Uint8Array; pct: readonly Float64Array[] } {
  const f = profile.filters;
  const n = index.schools.length;
  if (isEmptyFilters(f)) return { mask: new Uint8Array(n).fill(1), pct: index.pct };
  const key = filterHash(f);
  let entry = index.cache.get(key);
  if (!entry) {
    const mask = new Uint8Array(n);
    index.schools.forEach((s, i) => {
      mask[i] = matchesFilters(s, f) ? 1 : 0;
    });
    entry = { mask, pct: [] };
    if (index.cache.size > 32) index.cache.clear();
    index.cache.set(key, entry);
  }
  if (profile.normalizeWithin !== 'filtered') return { mask: entry.mask, pct: index.pct };
  if (entry.pct.length === 0) {
    const mask = entry.mask;
    entry.pct = index.metrics.map((m) => midRankPercentiles(index.schools.map((s) => s.values[m.key] ?? null), mask));
  }
  return entry;
}

/** Oriented metric score s in [0,1] (higher is better), or NaN when missing. */
export function metricScore(pct: readonly Float64Array[], a: ActiveMetric, i: number): number {
  const p = pct[a.k]![i]!;
  if (Number.isNaN(p)) return NaN;
  return a.lowerIsBetter ? 1 - p : p;
}

export interface ScoreParts {
  score: number;
  coverage: number;
  /** Per active metric: the score used (real or imputed) and whether it was imputed. */
  s: Float64Array;
  imputed: Uint8Array;
}

export function scoreSchool(
  pct: readonly Float64Array[],
  active: readonly ActiveMetric[],
  totalWeight: number,
  strategy: Profile['missing'],
  i: number,
  withParts = false,
): ScoreParts {
  const s = withParts ? new Float64Array(active.length) : EMPTY_F64;
  const imputed = withParts ? new Uint8Array(active.length) : EMPTY_U8;
  if (totalWeight <= 0) return { score: 0, coverage: 1, s, imputed };

  let known = 0;
  let knownWeight = 0;
  for (let j = 0; j < active.length; j++) {
    const a = active[j]!;
    const v = metricScore(pct, a, i);
    if (!Number.isNaN(v)) {
      known += a.weight * v;
      knownWeight += a.weight;
      if (withParts) s[j] = v;
    } else if (withParts) {
      imputed[j] = 1;
    }
  }
  const coverage = knownWeight / totalWeight;
  const raw = knownWeight > 0 ? known / knownWeight : 0.5;
  const fill = imputedScore(strategy, raw, coverage);
  const total = known + (totalWeight - knownWeight) * fill;
  if (withParts) {
    for (let j = 0; j < active.length; j++) if (imputed[j]) s[j] = fill;
  }
  return { score: (100 * total) / totalWeight, coverage, s, imputed };
}

const EMPTY_F64 = new Float64Array(0);
const EMPTY_U8 = new Uint8Array(0);

const TIE_EPS = 1e9;

/** Deterministic order: score (rounded to 1e-9), then coverage, then name, then id. */
export function compareSchools(index: RankIndex, score: Float64Array, coverage: Float64Array, a: number, b: number): number {
  const sa = Math.round(score[a]! * TIE_EPS);
  const sb = Math.round(score[b]! * TIE_EPS);
  if (sa !== sb) return sb - sa;
  const ca = Math.round(coverage[a]! * TIE_EPS);
  const cb = Math.round(coverage[b]! * TIE_EPS);
  if (ca !== cb) return cb - ca;
  const na = index.sortName[a]!;
  const nb = index.sortName[b]!;
  if (na !== nb) return na < nb ? -1 : 1;
  return index.schools[a]!.id - index.schools[b]!.id;
}

export function rank(index: RankIndex, profile: Profile): RankResult {
  const { mask, pct } = percentilesFor(index, profile);
  const active = activeMetrics(index, profile);
  const totalWeight = active.reduce((acc, a) => acc + a.weight, 0);
  const n = index.schools.length;
  const score = new Float64Array(n).fill(NaN);
  const coverage = new Float64Array(n).fill(NaN);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const r = scoreSchool(pct, active, totalWeight, profile.missing, i);
    score[i] = r.score;
    coverage[i] = r.coverage;
    count++;
  }
  const order = new Int32Array(count);
  let c = 0;
  for (let i = 0; i < n; i++) if (mask[i]) order[c++] = i;
  order.sort((a, b) => compareSchools(index, score, coverage, a, b));
  const rankOf = new Int32Array(n);
  for (let r = 0; r < order.length; r++) rankOf[order[r]!] = r + 1;
  return { index, profile, active, totalWeight, pct, mask, score, coverage, order, rankOf };
}

export interface RankedRow {
  rank: number;
  school: School;
  score: number;
  coverage: number;
}

export function rows(result: RankResult, offset = 0, limit = result.order.length): RankedRow[] {
  const out: RankedRow[] = [];
  const end = Math.min(result.order.length, offset + limit);
  for (let r = offset; r < end; r++) {
    const i = result.order[r]!;
    out.push({ rank: r + 1, school: result.index.schools[i]!, score: result.score[i]!, coverage: result.coverage[i]! });
  }
  return out;
}
