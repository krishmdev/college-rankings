import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { midRankPercentiles } from '../src';

describe('midRankPercentiles', () => {
  it('uses mid-ranks for ties', () => {
    expect([...midRankPercentiles([10, 20, 20, 30])]).toEqual([0.125, 0.5, 0.5, 0.875]);
  });

  it('puts a block of zeros at one shared percentile', () => {
    // 5 of 8 schools report $0 research: they all sit at (0 + 0.5*5)/8.
    const p = midRankPercentiles([0, 0, 0, 0, 0, 1e6, 5e7, 4e9]);
    expect([...p.slice(0, 5)]).toEqual(Array(5).fill(2.5 / 8));
    expect(p[5]).toBe(5.5 / 8);
    expect(p[7]).toBe(7.5 / 8);
  });

  it('returns NaN for missing values and excludes them from N', () => {
    const p = midRankPercentiles([null, 5, undefined, 7, Number.NaN]);
    expect(Number.isNaN(p[0]!)).toBe(true);
    expect(Number.isNaN(p[2]!)).toBe(true);
    expect(Number.isNaN(p[4]!)).toBe(true);
    expect(p[1]).toBe(0.25);
    expect(p[3]).toBe(0.75);
  });

  it('gives 0.5 when every value is equal', () => {
    expect([...midRankPercentiles([3, 3, 3])]).toEqual([0.5, 0.5, 0.5]);
  });

  it('respects a mask', () => {
    const p = midRankPercentiles([1, 2, 3, 4], new Uint8Array([1, 0, 1, 0]));
    expect(p[0]).toBe(0.25);
    expect(p[2]).toBe(0.75);
    expect(Number.isNaN(p[1]!)).toBe(true);
  });

  it('is monotone, bounded, and averages to 0.5', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -5, max: 5 }), { minLength: 1, maxLength: 60 }), (xs) => {
        const p = midRankPercentiles(xs);
        let sum = 0;
        for (let i = 0; i < xs.length; i++) {
          expect(p[i]).toBeGreaterThan(0);
          expect(p[i]).toBeLessThan(1);
          sum += p[i]!;
          for (let j = 0; j < xs.length; j++) {
            if (xs[i]! < xs[j]!) expect(p[i]).toBeLessThan(p[j]!);
            if (xs[i] === xs[j]) expect(p[i]).toBe(p[j]);
          }
        }
        expect(sum / xs.length).toBeCloseTo(0.5, 12);
      }),
    );
  });

  it('is invariant to monotone transforms (no units, no outlier leverage)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 40 }), (xs) => {
        const a = midRankPercentiles(xs);
        const b = midRankPercentiles(xs.map((x) => Math.sqrt(x) * 3 + 7));
        expect([...b]).toEqual([...a]);
      }),
    );
  });
});
