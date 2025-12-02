import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { School } from '../src';
import { buildIndex, contributions, rank, rows } from '../src';
import { arbMissing, arbUniverse, arbWeights, profile, TWELVE } from './fixture';

const mini = (vals: [number, number | null, number | null][]): School[] =>
  vals.map(([id, grad, price]) => ({
    id,
    name: `S${id}`,
    city: 'X',
    state: 'MA',
    control: 'public',
    locale: 'city',
    domain: null,
    ugSize: 1000,
    values: { grad_rate: grad, net_price: price },
  }));

describe('hand-computed scores', () => {
  // grad_rate percentiles over the two reporters: A 0.75, B 0.25, C missing.
  // net_price (lower is better): raw p A 5/6, B 1/2, C 1/6, so s = A 1/6, B 1/2, C 5/6.
  const idx = buildIndex(mini([[1, 0.9, 30000], [2, 0.8, 20000], [3, null, 10000]]));
  const w = { grad_rate: 3, net_price: 1 };
  const score = (missing: 'penalize' | 'neutral' | 'renormalize') => {
    const r = rank(idx, profile(w, { missing }));
    return [0, 1, 2].map((i) => r.score[i]!);
  };

  it('penalize fills missing with 0.25', () => {
    const [a, b, c] = score('penalize');
    expect(a).toBeCloseTo((100 * (3 * 0.75 + 1 / 6)) / 4, 10);
    expect(b).toBeCloseTo((100 * (3 * 0.25 + 0.5)) / 4, 10);
    expect(c).toBeCloseTo((100 * (3 * 0.25 + 5 / 6)) / 4, 10);
  });

  it('neutral fills missing with 0.5', () => {
    const [, , c] = score('neutral');
    expect(c).toBeCloseTo((100 * (3 * 0.5 + 5 / 6)) / 4, 10);
  });

  it('renormalize shrinks the school average toward 0.5 by coverage', () => {
    // coverage c = 1/4, raw = 5/6, fill = c*raw + (1-c)*0.5
    const [, , c] = score('renormalize');
    const fill = 0.25 * (5 / 6) + 0.75 * 0.5;
    expect(c).toBeCloseTo((100 * (5 / 6 + 3 * fill)) / 4, 10);
    expect(c).toBeCloseTo(100 * ((1 - 0.75 ** 2) * (5 / 6) + 0.75 ** 2 * 0.5), 10);
  });

  it('renormalize is not the same as neutral', () => {
    expect(score('renormalize')[2]).not.toBeCloseTo(score('neutral')[2]!, 3);
  });

  it('complete schools score the same under every strategy', () => {
    for (const m of ['penalize', 'neutral', 'renormalize'] as const) {
      expect(score(m)[0]).toBeCloseTo(score('penalize')[0]!, 12);
    }
  });

  it('reports coverage as the share of weight with real data', () => {
    const r = rank(idx, profile(w));
    expect(r.coverage[2]).toBe(0.25);
    expect(r.coverage[0]).toBe(1);
  });
});

describe('ranking the twelve-school fixture', () => {
  const idx = buildIndex(TWELVE);

  it('ranks research-only by R&D, with $0 ties broken by name', () => {
    const r = rank(idx, profile({ research_total: 1 }));
    const names = rows(r).map((x) => x.school.name);
    expect(names.slice(0, 5)).toEqual([
      'Birch State University',
      'Dogwood Tech',
      'Ginkgo University',
      'Alder University',
      'Kapok Institute',
    ]);
    // Four schools report exactly $0 and share p = (0 + 0.5*4)/11 = 0.18. Larch doesn't report and
    // is filled at the 25th percentile, which lands it just above the zeros: penalize means
    // "assume below average", not "assume the worst".
    expect(names[7]).toBe('Larch University');
    expect(names.slice(8)).toEqual(['Cedar College', 'Fir Valley College', 'Hawthorn College', 'Juniper State']);
  });

  it('handles lower-is-better and preference directions', () => {
    const cheap = rows(rank(idx, profile({ net_price: 1 })));
    expect(cheap[0]!.school.name).toBe('Ironwood University');
    const selective = rows(rank(idx, profile({ admit_rate: 1 })));
    expect(selective[0]!.school.name).toBe('Alder University');
    const open = rows(rank(idx, profile({ admit_rate: 1 }, { directions: { admit_rate: 'higher' } })));
    expect(open[0]!.school.name).toBe('Ironwood University');
  });

  it('with no weights every score is 0 and order is alphabetical', () => {
    const r = rank(idx, profile({}));
    expect(rows(r).every((x) => x.score === 0)).toBe(true);
    expect(rows(r)[0]!.school.name).toBe('Alder University');
  });

  it('rejects duplicate ids', () => {
    expect(() => buildIndex([TWELVE[0]!, TWELVE[0]!])).toThrow(/duplicate/);
  });
});

describe('properties', () => {
  it('is deterministic under input shuffling', () => {
    fc.assert(
      fc.property(arbUniverse(), arbWeights(), arbMissing, fc.integer(), (schools, weights, missing, seed) => {
        const shuffled = fc.sample(fc.shuffledSubarray(schools, { minLength: schools.length }), { seed, numRuns: 1 })[0]!;
        const a = rows(rank(buildIndex(schools), profile(weights, { missing })));
        const b = rows(rank(buildIndex(shuffled), profile(weights, { missing })));
        expect(b.map((x) => [x.school.id, x.score])).toEqual(a.map((x) => [x.school.id, x.score]));
      }),
    );
  });

  it('is invariant to scaling all weights', () => {
    fc.assert(
      fc.property(arbUniverse(), arbWeights(), arbMissing, fc.constantFrom(0.25, 0.5, 2, 4, 8), (schools, w, missing, k) => {
        const idx = buildIndex(schools);
        const scaled = Object.fromEntries(Object.entries(w).map(([key, v]) => [key, v! * k]));
        const a = rows(rank(idx, profile(w, { missing })));
        const b = rows(rank(idx, profile(scaled, { missing })));
        expect(b.map((x) => x.school.id)).toEqual(a.map((x) => x.school.id));
        b.forEach((x, i) => expect(x.score).toBeCloseTo(a[i]!.score, 9));
      }),
    );
  });

  it('keeps scores within 1e-9 for arbitrary positive scale factors', () => {
    fc.assert(
      fc.property(arbUniverse(), arbWeights(), fc.double({ min: 0.01, max: 100, noNaN: true }), (schools, w, k) => {
        const idx = buildIndex(schools);
        const scaled = Object.fromEntries(Object.entries(w).map(([key, v]) => [key, v! * k]));
        const a = rank(idx, profile(w));
        const b = rank(idx, profile(scaled));
        a.score.forEach((v, i) => expect(Math.abs(v - b.score[i]!)).toBeLessThan(1e-9));
      }),
    );
  });

  it('never lowers a school when it improves on a weighted metric', () => {
    fc.assert(
      fc.property(arbUniverse(), arbWeights(), arbMissing, fc.nat(), fc.integer({ min: 1, max: 4 }), (schools, w, missing, pick, bump) => {
        const i = pick % schools.length;
        const before = rank(buildIndex(schools), profile(w, { missing }));
        const improved = schools.map((s, j) =>
          j === i && s.values.grad_rate !== null && s.values.grad_rate !== undefined
            ? { ...s, values: { ...s.values, grad_rate: s.values.grad_rate + bump } }
            : s,
        );
        const after = rank(buildIndex(improved), profile(w, { missing }));
        expect(after.score[i]!).toBeGreaterThanOrEqual(before.score[i]! - 1e-9);
        expect(after.rankOf[i]!).toBeLessThanOrEqual(before.rankOf[i]!);
      }),
    );
  });

  it('a school that dominates another with full data scores at least as high', () => {
    fc.assert(
      fc.property(arbUniverse(['grad_rate', 'research_total', 'net_price']), arbWeights(['grad_rate', 'research_total', 'net_price']), arbMissing, (schools, w, missing) => {
        const r = rank(buildIndex(schools), profile(w, { missing }));
        const full = (s: School) => ['grad_rate', 'research_total', 'net_price'].every((k) => s.values[k as 'grad_rate'] != null);
        for (let a = 0; a < schools.length; a++) {
          for (let b = 0; b < schools.length; b++) {
            const A = r.index.schools[a]!;
            const B = r.index.schools[b]!;
            if (!full(A) || !full(B)) continue;
            const dominates =
              A.values.grad_rate! >= B.values.grad_rate! &&
              A.values.research_total! >= B.values.research_total! &&
              A.values.net_price! <= B.values.net_price!;
            if (dominates) expect(r.score[a]!).toBeGreaterThanOrEqual(r.score[b]! - 1e-9);
          }
        }
      }),
    );
  });

  it('contributions sum to the score under every strategy', () => {
    fc.assert(
      fc.property(arbUniverse(), arbWeights(), arbMissing, (schools, w, missing) => {
        const r = rank(buildIndex(schools), profile(w, { missing }));
        for (let i = 0; i < schools.length; i++) {
          const total = contributions(r, i).reduce((acc, c) => acc + c.points, 0);
          expect(total).toBeCloseTo(r.score[i]!, 9);
        }
      }),
    );
  });

  it('scores stay within 0-100', () => {
    fc.assert(
      fc.property(arbUniverse(), arbWeights(), arbMissing, (schools, w, missing) => {
        const r = rank(buildIndex(schools), profile(w, { missing }));
        r.score.forEach((v) => {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        });
      }),
    );
  });

  it('penalize never ranks a non-reporter above an identical school that reports a good value', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 6 }), (good) => {
        const base = mini([[1, 0.5, 100], [2, 0.6, 200], [3, 0.7, 300]]);
        const withGood: School = { ...base[0]!, id: 10, name: 'Reporter', values: { grad_rate: good, net_price: 150 } };
        const silent: School = { ...base[0]!, id: 11, name: 'Silent', values: { grad_rate: null, net_price: 150 } };
        const r = rank(buildIndex([...base, withGood, silent]), profile({ grad_rate: 1, net_price: 1 }));
        const byId = new Map(rows(r).map((x) => [x.school.id, x.rank]));
        expect(byId.get(10)!).toBeLessThan(byId.get(11)!);
      }),
    );
  });
});
