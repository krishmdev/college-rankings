// Timing check for the 5 ms target: 2,500 schools x every registry metric weighted.
// Run through `pnpm engine:bench` (wrapped in the compute lease); writes BENCH_OUT if set.
import { writeFileSync } from 'node:fs';

import { expect, it } from 'vitest';

import type { School } from '../src';
import { buildIndex, encodeProfile, METRICS, rank, sensitivity } from '../src';

function lcg(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

function synthetic(n: number, seed = 42): School[] {
  const rnd = lcg(seed);
  return Array.from({ length: n }, (_, i) => ({
    id: 100000 + i,
    name: `School ${i}`,
    city: 'X',
    state: 'MA',
    control: 'public',
    locale: 'city',
    domain: null,
    ugSize: 1000 + Math.floor(rnd() * 40000),
    // Heavy-tailed values with ~10% missing, and a third of research at exactly zero.
    values: Object.fromEntries(
      METRICS.map((m) => {
        if (rnd() < 0.1) return [m.key, null];
        if (m.key === 'research_total' && rnd() < 0.33) return [m.key, 0];
        return [m.key, Math.round(Math.exp(rnd() * 10))];
      }),
    ),
  }));
}

function timeIt(fn: () => void, iterations: number): { p50: number; p95: number; mean: number } {
  for (let i = 0; i < 20; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    t.push(performance.now() - t0);
  }
  t.sort((a, b) => a - b);
  const q = (p: number) => t[Math.min(t.length - 1, Math.floor(p * t.length))]!;
  return { p50: q(0.5), p95: q(0.95), mean: t.reduce((a, b) => a + b, 0) / t.length };
}

it('ranks 2,500 schools x all metrics in under 5 ms (p50)', () => {
  const schools = synthetic(2500);
  const index = buildIndex(schools);
  const weights = Object.fromEntries(METRICS.map((m, i) => [m.key, 1 + (i % 10)]));
  const results: Record<string, unknown> = {};
  for (const missing of ['penalize', 'neutral', 'renormalize'] as const) {
    const profile = { weights, directions: {}, missing, normalizeWithin: 'all' as const, filters: {} };
    results[`rank_${missing}_ms`] = timeIt(() => rank(index, profile), 300);
  }
  const filtered = {
    weights,
    directions: {},
    missing: 'penalize' as const,
    normalizeWithin: 'filtered' as const,
    filters: { sizes: ['medium' as const, 'large' as const] },
  };
  results.rank_filtered_cached_ms = timeIt(() => rank(index, filtered), 300);
  results.build_index_ms = timeIt(() => buildIndex(schools), 30);
  const base = rank(index, { ...filtered, normalizeWithin: 'all', filters: {} });
  results.sensitivity_one_school_ms = timeIt(() => sensitivity(base, base.order[100]!), 30);

  const out = {
    schools: schools.length,
    metrics: METRICS.length,
    weighted_metrics: Object.keys(weights).length,
    profile_token: encodeProfile(base.profile),
    node: process.version,
    target_p50_ms: 5,
    ...results,
  };
  if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  expect((results.rank_penalize_ms as { p50: number }).p50).toBeLessThan(5);
});
