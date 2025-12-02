import type { Filters, Region, School, SizeBand } from './types';

const REGION_STATES: Record<Exclude<Region, 'other'>, readonly string[]> = {
  northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
  midwest: ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
  south: [
    'DE', 'DC', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV',
    'AL', 'KY', 'MS', 'TN', 'AR', 'LA', 'OK', 'TX',
  ],
  west: ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY', 'AK', 'CA', 'HI', 'OR', 'WA'],
};

const STATE_REGION = new Map<string, Region>();
for (const [region, states] of Object.entries(REGION_STATES)) {
  for (const s of states) STATE_REGION.set(s, region as Region);
}

/** Census region; territories (PR, GU, VI, ...) are 'other'. */
export function regionOf(state: string): Region {
  return STATE_REGION.get(state) ?? 'other';
}

export const SIZE_BANDS: Record<SizeBand, { label: string; min: number; max: number }> = {
  small: { label: 'Small (under 5,000)', min: 0, max: 4999 },
  medium: { label: 'Medium (5,000-15,000)', min: 5000, max: 15000 },
  large: { label: 'Large (over 15,000)', min: 15001, max: Infinity },
};

export function sizeBandOf(ugSize: number): SizeBand {
  if (ugSize < 5000) return 'small';
  if (ugSize <= 15000) return 'medium';
  return 'large';
}

export function matchesFilters(school: School, f: Filters): boolean {
  if (f.states?.length && !f.states.includes(school.state)) return false;
  if (f.regions?.length && !f.regions.includes(regionOf(school.state))) return false;
  if (f.control?.length && !f.control.includes(school.control)) return false;
  if (f.sizes?.length && !f.sizes.includes(sizeBandOf(school.ugSize))) return false;
  if (f.locales?.length && (school.locale === null || !f.locales.includes(school.locale))) return false;

  if (f.maxNetPrice !== undefined && f.maxNetPrice !== null) {
    const price = school.values.net_price;
    if (price === null || price === undefined) {
      if (f.includeUnknownNetPrice === false) return false;
    } else if (price > f.maxNetPrice) {
      return false;
    }
  }

  const hasMin = f.admitRateMin !== undefined && f.admitRateMin !== null && f.admitRateMin > 0;
  const hasMax = f.admitRateMax !== undefined && f.admitRateMax !== null && f.admitRateMax < 1;
  if (hasMin || hasMax) {
    const rate = school.values.admit_rate;
    if (rate === null || rate === undefined) return false;
    if (hasMin && rate < f.admitRateMin!) return false;
    if (hasMax && rate > f.admitRateMax!) return false;
  }

  if (f.requireData?.length) {
    for (const key of f.requireData) {
      const v = school.values[key];
      if (v === null || v === undefined) return false;
    }
  }
  return true;
}

export function isEmptyFilters(f: Filters): boolean {
  return filterHash(f) === '{}';
}

/** Stable key for caching filtered percentiles. */
export function filterHash(f: Filters): string {
  const norm: Record<string, unknown> = {};
  const keys = Object.keys(f).sort() as (keyof Filters)[];
  for (const k of keys) {
    const v = f[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      norm[k] = [...v].sort();
    } else {
      norm[k] = v;
    }
  }
  if (norm.maxNetPrice === undefined) delete norm.includeUnknownNetPrice;
  return JSON.stringify(norm);
}
