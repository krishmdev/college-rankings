import fc from 'fast-check';

import type { MetricKey, Profile, School } from '../src';

type V = Partial<Record<MetricKey, number | null>>;

const s = (
  id: number,
  name: string,
  state: string,
  control: School['control'],
  ugSize: number,
  locale: School['locale'],
  values: V,
): School => ({ id, name, city: 'X', state, control, locale, domain: null, ugSize, values });

/** Twelve hand-built schools covering ties, zeros, missing values and every filter dimension. */
export const TWELVE: School[] = [
  s(101, 'Alder University', 'MA', 'private_nonprofit', 4000, 'city', {
    grad_rate: 0.95, net_price: 28000, research_total: 900e6, clubs_count: 450, student_faculty_ratio: 6, admit_rate: 0.07,
  }),
  s(102, 'Birch State University', 'OH', 'public', 38000, 'city', {
    grad_rate: 0.84, net_price: 17000, research_total: 1500e6, clubs_count: 1300, student_faculty_ratio: 19, admit_rate: 0.53,
  }),
  s(103, 'Cedar College', 'VT', 'private_nonprofit', 1800, 'rural', {
    grad_rate: 0.88, net_price: 31000, research_total: 0, clubs_count: null, student_faculty_ratio: 9, admit_rate: 0.3,
  }),
  s(104, 'Dogwood Tech', 'GA', 'public', 18000, 'city', {
    grad_rate: 0.9, net_price: 15000, research_total: 1200e6, clubs_count: 760, student_faculty_ratio: 19, admit_rate: 0.17,
  }),
  s(105, 'Elm State', 'TX', 'public', 30000, 'suburb', {
    grad_rate: 0.62, net_price: 12000, research_total: 40e6, clubs_count: null, student_faculty_ratio: 22, admit_rate: 0.8,
  }),
  s(106, 'Fir Valley College', 'CA', 'private_nonprofit', 2500, 'suburb', {
    grad_rate: 0.75, net_price: 35000, research_total: 0, clubs_count: 120, student_faculty_ratio: 11, admit_rate: 0.45,
  }),
  s(107, 'Ginkgo University', 'CA', 'public', 32000, 'city', {
    grad_rate: 0.92, net_price: 16000, research_total: 950e6, clubs_count: null, student_faculty_ratio: 18, admit_rate: null,
  }),
  s(108, 'Hawthorn College', 'IA', 'private_nonprofit', 1600, 'town', {
    grad_rate: 0.7, net_price: null, research_total: 0, clubs_count: null, student_faculty_ratio: 12, admit_rate: 0.6,
  }),
  s(109, 'Ironwood University', 'PR', 'private_nonprofit', 6000, 'city', {
    grad_rate: 0.45, net_price: 9000, research_total: 5e6, clubs_count: null, student_faculty_ratio: 20, admit_rate: 0.9,
  }),
  s(110, 'Juniper State', 'WA', 'public', 14000, 'town', {
    grad_rate: 0.6, net_price: 14000, research_total: 0, clubs_count: 300, student_faculty_ratio: 21, admit_rate: 0.85,
  }),
  s(111, 'Kapok Institute', 'NY', 'private_nonprofit', 5000, 'city', {
    grad_rate: 0.9, net_price: 30000, research_total: 300e6, clubs_count: 300, student_faculty_ratio: 8, admit_rate: 0.1,
  }),
  s(112, 'Larch University', 'MI', 'public', 9000, 'suburb', {
    grad_rate: null, net_price: 19000, research_total: null, clubs_count: null, student_faculty_ratio: null, admit_rate: null,
  }),
];

export const profile = (weights: Profile['weights'], extra: Partial<Profile> = {}): Profile => ({
  weights,
  directions: {},
  missing: 'penalize',
  normalizeWithin: 'all',
  filters: {},
  ...extra,
});

export const FIXTURE_KEYS: MetricKey[] = [
  'grad_rate', 'net_price', 'research_total', 'clubs_count', 'student_faculty_ratio', 'admit_rate',
];

/** Random universes: small integer values so ties are common. */
export const arbUniverse = (keys: MetricKey[] = FIXTURE_KEYS, minLength = 2) =>
  fc
    .array(
      fc.record({
        name: fc.constantFrom('Alpha', 'Beta', 'Gamma', 'Delta', 'Alpha'),
        values: fc.tuple(...keys.map(() => fc.option(fc.integer({ min: 0, max: 6 }), { nil: null }))),
      }),
      { minLength, maxLength: 25 },
    )
    .map((rows) =>
      rows.map(
        (r, i): School => ({
          id: i + 1,
          name: r.name,
          city: 'X',
          state: 'MA',
          control: 'public',
          locale: 'city',
          domain: null,
          ugSize: 1000,
          values: Object.fromEntries(keys.map((k, j) => [k, r.values[j]])) as V,
        }),
      ),
    );

export const arbWeights = (keys: MetricKey[] = FIXTURE_KEYS) =>
  fc
    .tuple(...keys.map(() => fc.integer({ min: 0, max: 10 })))
    .map((ws) => Object.fromEntries(keys.map((k, j) => [k, ws[j]])) as Profile['weights']);

export const arbMissing = fc.constantFrom<Profile['missing']>('penalize', 'neutral', 'renormalize');
