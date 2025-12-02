import { describe, expect, it } from 'vitest';

import type { Filters } from '../src';
import { buildIndex, filterHash, matchesFilters, rank, regionOf, rows, sizeBandOf } from '../src';
import { profile, TWELVE } from './fixture';

const names = (f: Filters) => TWELVE.filter((s) => matchesFilters(s, f)).map((s) => s.name);

describe('filters', () => {
  it('maps states to census regions, territories to other', () => {
    expect(regionOf('MA')).toBe('northeast');
    expect(regionOf('TX')).toBe('south');
    expect(regionOf('DC')).toBe('south');
    expect(regionOf('PR')).toBe('other');
  });

  it('bands undergraduate size', () => {
    expect(sizeBandOf(4999)).toBe('small');
    expect(sizeBandOf(5000)).toBe('medium');
    expect(sizeBandOf(15000)).toBe('medium');
    expect(sizeBandOf(15001)).toBe('large');
  });

  it('filters by state, region, control, size and locale', () => {
    expect(names({ states: ['CA'] })).toEqual(['Fir Valley College', 'Ginkgo University']);
    expect(names({ regions: ['northeast'] })).toEqual(['Alder University', 'Cedar College', 'Kapok Institute']);
    expect(names({ control: ['public'], sizes: ['large'] })).toEqual([
      'Birch State University', 'Dogwood Tech', 'Elm State', 'Ginkgo University',
    ]);
    expect(names({ locales: ['town'] })).toEqual(['Hawthorn College', 'Juniper State']);
  });

  it('net price cap keeps unknown prices unless told not to', () => {
    expect(names({ maxNetPrice: 14000 })).toEqual(['Elm State', 'Hawthorn College', 'Ironwood University', 'Juniper State']);
    expect(names({ maxNetPrice: 14000, includeUnknownNetPrice: false })).toEqual([
      'Elm State', 'Ironwood University', 'Juniper State',
    ]);
  });

  it('admit-rate range drops unknown admit rates', () => {
    expect(names({ admitRateMax: 0.2 })).toEqual(['Alder University', 'Dogwood Tech', 'Kapok Institute']);
    expect(names({ admitRateMin: 0.85 })).toEqual(['Ironwood University', 'Juniper State']);
    expect(names({ admitRateMin: 0, admitRateMax: 1 })).toHaveLength(12);
  });

  it('require-data keeps only reporters', () => {
    expect(names({ requireData: ['clubs_count'] })).toHaveLength(6);
  });

  it('hashes filters independent of key and array order', () => {
    expect(filterHash({ states: ['NY', 'MA'], control: ['public'] })).toBe(filterHash({ control: ['public'], states: ['MA', 'NY'] }));
    expect(filterHash({ states: [], includeUnknownNetPrice: false })).toBe('{}');
  });
});

describe('ranking with filters', () => {
  const idx = buildIndex(TWELVE);

  it('ranks only schools that pass, against national percentiles by default', () => {
    const all = rank(idx, profile({ research_total: 1 }));
    const ca = rank(idx, profile({ research_total: 1 }, { filters: { states: ['CA'] } }));
    expect(rows(ca).map((r) => r.school.name)).toEqual(['Ginkgo University', 'Fir Valley College']);
    const g = idx.idToIdx.get(107)!;
    expect(ca.score[g]).toBe(all.score[g]);
    expect(ca.rankOf[idx.idToIdx.get(101)!]).toBe(0);
  });

  it('can recompute percentiles within the filtered set', () => {
    const p = profile({ research_total: 1 }, { filters: { states: ['CA'] }, normalizeWithin: 'filtered' });
    const r = rank(idx, p);
    // Two schools: Ginkgo is the higher of two -> p = 0.75.
    expect(r.score[idx.idToIdx.get(107)!]).toBeCloseTo(75, 10);
    expect(r.score[idx.idToIdx.get(106)!]).toBeCloseTo(25, 10);
  });

  it('caches filtered masks and percentiles', () => {
    const p = profile({ research_total: 1 }, { filters: { regions: ['west'] }, normalizeWithin: 'filtered' });
    rank(idx, p);
    const size = idx.cache.size;
    rank(idx, { ...p, weights: { grad_rate: 2 } });
    expect(idx.cache.size).toBe(size);
  });
});
