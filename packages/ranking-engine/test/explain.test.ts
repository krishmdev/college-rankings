import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildIndex, explain, rank, rankUnder, sensitivity, topContributions } from '../src';
import { arbMissing, arbUniverse, arbWeights, profile, TWELVE } from './fixture';

describe('explain', () => {
  const idx = buildIndex(TWELVE);
  const p = profile({ grad_rate: 4, net_price: 2, research_total: 3, clubs_count: 1 });
  const r = rank(idx, p);

  it('describes the rank, neighbors and per-metric gaps', () => {
    const i = r.order[4]!;
    const e = explain(r, i)!;
    expect(e.rank).toBe(5);
    expect(e.of).toBe(12);
    expect(e.above!.rank).toBe(4);
    expect(e.below!.rank).toBe(6);
    expect(e.above!.gap).toBeLessThanOrEqual(0);
    expect(e.below!.gap).toBeGreaterThanOrEqual(0);
    const summed = e.above!.deltas.reduce((acc, d) => acc + d.points, 0);
    expect(summed).toBeCloseTo(e.above!.gap, 9);
  });

  it('has no neighbor above #1 or below the last school', () => {
    expect(explain(r, r.order[0]!)!.above).toBeNull();
    expect(explain(r, r.order[11]!)!.below).toBeNull();
  });

  it('marks imputed metrics', () => {
    const cedar = idx.idToIdx.get(103)!;
    const clubs = explain(r, cedar)!.contributions.find((c) => c.key === 'clubs_count')!;
    expect(clubs.imputed).toBe(true);
    expect(clubs.s).toBe(0.25);
  });

  it('returns null for a filtered-out school', () => {
    const f = rank(idx, { ...p, filters: { states: ['CA'] } });
    expect(explain(f, idx.idToIdx.get(101)!)).toBeNull();
  });

  it('lists top contributions largest first', () => {
    const top = topContributions(r, r.order[0]!, 3);
    expect(top).toHaveLength(3);
    expect(top[0]!.points).toBeGreaterThanOrEqual(top[1]!.points);
  });
});

describe('sensitivity', () => {
  it('rankUnder agrees with a full re-rank', () => {
    fc.assert(
      fc.property(arbUniverse(), arbWeights(), arbWeights(), arbMissing, fc.nat(), (schools, w1, w2, missing, pick) => {
        const idx = buildIndex(schools);
        const r1 = rank(idx, profile(w1, { missing }));
        const p2 = profile(w2, { missing });
        const r2 = rank(idx, p2);
        const i = pick % schools.length;
        expect(rankUnder(r1, p2, i)).toBe(r2.rankOf[i]);
      }),
    );
  });

  it('reports rank when each weighted metric is zeroed or doubled', () => {
    const idx = buildIndex(TWELVE);
    const p = profile({ grad_rate: 1, research_total: 5 });
    const r = rank(idx, p);
    const cedar = idx.idToIdx.get(103)!;
    const sens = sensitivity(r, cedar);
    expect(sens.map((s) => s.key)).toEqual(['grad_rate', 'research_total']);
    const research = sens.find((s) => s.key === 'research_total')!;
    expect(research.rankIfZero).toBe(rank(idx, profile({ grad_rate: 1 })).rankOf[cedar]);
    expect(research.rankIfDoubled).toBe(rank(idx, profile({ grad_rate: 1, research_total: 10 })).rankOf[cedar]);
    expect(research.rankIfZero).toBeLessThan(r.rankOf[cedar]!);
  });
});
