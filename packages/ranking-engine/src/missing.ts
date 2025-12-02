import type { MissingStrategy } from './types';

export const PENALIZE_SCORE = 0.25;
export const NEUTRAL_SCORE = 0.5;

export const MISSING_STRATEGIES: readonly { key: MissingStrategy; label: string; description: string }[] = [
  {
    key: 'penalize',
    label: 'Penalize',
    description: 'A missing metric counts as the 25th percentile, so not reporting never helps.',
  },
  {
    key: 'neutral',
    label: 'Neutral',
    description: 'A missing metric counts as the 50th percentile.',
  },
  {
    key: 'renormalize',
    label: 'Use what is known',
    description:
      "A missing metric is filled with the school's own average on the metrics it does report, " +
      'pulled toward the middle in proportion to how much of your profile is missing.',
  },
];

/**
 * Score used in place of a missing metric.
 *
 * For `renormalize`, `raw` is the weighted mean of the school's known metric scores and `coverage`
 * is the share of the profile's weight that is known. The fill value is `c·raw + (1−c)·0.5`.
 *
 * Why not the simpler `score = c·raw + (1−c)·0.5` over the whole score? Expanding it gives
 * `Σ_known w·s / Σw + Σ_missing w·0.5 / Σw`, which is exactly the neutral strategy. Shrinking the
 * *fill value* instead gives `score = (1 − (1−c)²)·raw + (1−c)²·0.5`: close to pure
 * renormalization when little is missing, close to neutral when most of the profile is missing.
 */
export function imputedScore(strategy: MissingStrategy, raw: number, coverage: number): number {
  switch (strategy) {
    case 'penalize':
      return PENALIZE_SCORE;
    case 'neutral':
      return NEUTRAL_SCORE;
    case 'renormalize':
      return coverage * raw + (1 - coverage) * NEUTRAL_SCORE;
  }
}
