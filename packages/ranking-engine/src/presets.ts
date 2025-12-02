import type { MetricKey, Profile } from './types';

export interface Preset {
  id: string;
  name: string;
  description: string;
  profile: Profile;
}

const base = (
  weights: Partial<Record<MetricKey, number>>,
  extra: Partial<Omit<Profile, 'weights'>> = {},
): Profile => ({
  weights,
  directions: {},
  missing: 'penalize',
  normalizeWithin: 'all',
  filters: {},
  ...extra,
});

/**
 * U.S. News National Universities weights (2024 edition onward; U.S. News says the 2026 edition
 * kept them), divided by 2 to fit the 0-10 sliders. Only ratios matter to the score.
 *
 * Replicable with public data (70 of 100 points):
 *   graduation 16 · retention 5 · social mobility 11 (Pell grad rate stands in for the Pell and
 *   first-gen measures) · borrower debt 5 · earnings 5 · financial resources 8 (instructional
 *   spend per FTE) · faculty salary 6 · student-faculty ratio 3 · full-time faculty 2 ·
 *   SAT/ACT 5 · bibliometrics 4 (total R&D stands in for citations).
 * Not replicable: peer assessment survey (20) and graduation-rate performance (10), which needs
 * U.S. News's predicted graduation model.
 */
export const US_NEWS_STYLE_WEIGHTS: Partial<Record<MetricKey, number>> = {
  grad_rate: 8,
  retention_rate: 2.5,
  pell_grad_rate: 5.5,
  median_debt: 2.5,
  median_earnings_10y: 2.5,
  instructional_spend_per_fte: 4,
  faculty_salary: 3,
  student_faculty_ratio: 1.5,
  ft_faculty_share: 1,
  sat_avg: 2.5,
  research_total: 2,
};

export const PRESETS: readonly Preset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Outcomes, cost, teaching and a little of everything else.',
    profile: base({
      grad_rate: 5,
      retention_rate: 3,
      median_earnings_10y: 4,
      net_price: 4,
      median_debt: 3,
      earnings_to_price: 3,
      student_faculty_ratio: 3,
      research_total: 2,
      clubs_per_1k_ug: 2,
    }),
  },
  {
    id: 'research',
    name: 'Research powerhouse',
    description: 'Where the lab money and faculty are.',
    profile: base({
      research_total: 10,
      research_per_student: 8,
      faculty_count: 5,
      faculty_salary: 3,
      grad_rate: 3,
    }),
  },
  {
    id: 'value',
    name: 'Best value',
    description: 'Low net price and debt, strong earnings for what you pay.',
    profile: base({
      earnings_to_price: 10,
      net_price: 8,
      median_debt: 6,
      net_price_low_income: 5,
      median_earnings_10y: 5,
      grad_rate: 4,
    }),
  },
  {
    id: 'small',
    name: 'Small and personal',
    description: 'Small classes, full-time faculty, smaller student body.',
    profile: base(
      {
        student_faculty_ratio: 10,
        undergrad_size: 6,
        ft_faculty_share: 5,
        instructional_spend_per_fte: 5,
        retention_rate: 4,
        grad_rate: 4,
      },
      { directions: { undergrad_size: 'lower' } },
    ),
  },
  {
    id: 'campus',
    name: 'Campus life',
    description: 'Lots of clubs and happy students. Club counts are partial, so missing data is neutral.',
    profile: base(
      {
        clubs_per_1k_ug: 8,
        clubs_count: 6,
        retention_rate: 5,
        crowd_social: 5,
        crowd_housing: 4,
        grad_rate: 3,
      },
      { missing: 'neutral' },
    ),
  },
  {
    id: 'usnews',
    name: 'U.S. News-style (approx.)',
    description: 'U.S. News weights where public data exists. No reputation survey.',
    profile: base(US_NEWS_STYLE_WEIGHTS, { directions: { sat_avg: 'higher' } }),
  },
];

export const DEFAULT_PRESET_ID = 'balanced';

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function emptyProfile(): Profile {
  return base({});
}
