import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Profile } from '../src';
import {
  base64UrlDecode,
  base64UrlEncode,
  bayesianAverage,
  crowdMetricValues,
  decodeProfile,
  encodeProfile,
  METRIC_KEYS,
  PRESETS,
  ProfileDecodeError,
} from '../src';

const arbProfile: fc.Arbitrary<Profile> = fc.record({
  weights: fc.dictionary(fc.constantFrom(...METRIC_KEYS), fc.integer({ min: 1, max: 100 }).map((x) => x / 10)),
  directions: fc.dictionary(fc.constantFrom('admit_rate', 'sat_avg', 'undergrad_size' as const), fc.constantFrom('higher' as const, 'lower' as const)),
  missing: fc.constantFrom('penalize' as const, 'neutral' as const, 'renormalize' as const),
  normalizeWithin: fc.constantFrom('all' as const, 'filtered' as const),
  filters: fc.record(
    {
      states: fc.uniqueArray(fc.constantFrom('MA', 'NY', 'CA', 'TX'), { minLength: 1 }).map((a) => a.sort()),
      regions: fc.uniqueArray(fc.constantFrom('northeast' as const, 'west' as const), { minLength: 1 }).map((a) => a.sort()),
      control: fc.constant(['public' as const]),
      sizes: fc.constant(['medium' as const, 'small' as const]),
      locales: fc.constant(['city' as const]),
      maxNetPrice: fc.integer({ min: 0, max: 80000 }),
      admitRateMin: fc.integer({ min: 0, max: 100 }).map((x) => x / 100),
      admitRateMax: fc.integer({ min: 0, max: 100 }).map((x) => x / 100),
      requireData: fc.constant(['grad_rate' as const]),
    },
    { requiredKeys: [] },
  ),
});

describe('profile codec', () => {
  it('round-trips arbitrary profiles', () => {
    fc.assert(
      fc.property(arbProfile, (p) => {
        const decoded = decodeProfile(encodeProfile(p));
        expect(decoded).toEqual(p);
      }),
    );
  });

  it('keeps every preset link short and URL-safe', () => {
    for (const preset of PRESETS) {
      const token = encodeProfile(preset.profile);
      expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
      expect(token.length).toBeLessThan(400);
      expect(decodeProfile(token)).toEqual(preset.profile);
    }
  });

  it('drops zero weights', () => {
    const p: Profile = { weights: { grad_rate: 0, net_price: 2 }, directions: {}, missing: 'penalize', normalizeWithin: 'all', filters: {} };
    expect(decodeProfile(encodeProfile(p)).weights).toEqual({ net_price: 2 });
  });

  it('rejects bad versions, corrupt payloads, unknown metrics and out-of-range weights', () => {
    expect(() => decodeProfile('v2.abc')).toThrow(ProfileDecodeError);
    expect(() => decodeProfile('v1.!!!')).toThrow(ProfileDecodeError);
    expect(() => decodeProfile('v1.' + base64UrlEncode('{"w":{"hacked":3}}'))).toThrow(ProfileDecodeError);
    expect(() => decodeProfile('v1.' + base64UrlEncode('{"w":{"grad_rate":11}}'))).toThrow(ProfileDecodeError);
    expect(() => decodeProfile('v1.' + base64UrlEncode('{"w":{},"x":1}'))).toThrow(ProfileDecodeError);
  });

  it('base64url matches the platform encoder', () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.integer({ min: 0, max: 127 }).map((c) => String.fromCharCode(c)) }), (s) => {
        const ours = base64UrlEncode(s);
        expect(ours).toBe(Buffer.from(s, 'latin1').toString('base64url'));
        expect(base64UrlDecode(ours)).toBe(s);
      }),
    );
  });
});

describe('bayesian average', () => {
  it('pulls small samples toward the prior', () => {
    expect(bayesianAverage(0, 5, 3)).toBe(3);
    expect(bayesianAverage(5, 5, 3)).toBe(4);
    expect(bayesianAverage(995, 5, 3)).toBeCloseTo(4.99, 2);
  });

  it('turns aggregates into crowd metrics, with <3 reviews treated as missing', () => {
    const aggs = new Map([
      [1, { overall: { n: 10, avg: 4.5 }, social: { n: 2, avg: 5 } }],
      [2, { overall: { n: 10, avg: 3.5 } }],
    ]);
    const v = crowdMetricValues(aggs);
    // prior for overall = (45 + 35) / 20 = 4
    expect(v.get(1)!.crowd_overall).toBeCloseTo((10 * 4.5 + 5 * 4) / 15, 12);
    expect(v.get(2)!.crowd_overall).toBeCloseTo((10 * 3.5 + 5 * 4) / 15, 12);
    expect(v.get(1)!.crowd_social).toBeNull();
    expect(v.get(2)!.crowd_housing).toBeNull();
  });
});
