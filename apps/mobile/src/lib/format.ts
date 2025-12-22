import type { MetricDef, MetricFlag, MetricKey } from '@college/ranking-engine';
import { METRIC_BY_KEY } from '@college/ranking-engine';

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function usdCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `$${Math.round(v / 1e3)}K`;
  return `$${int.format(v)}`;
}

export function formatMetric(key: MetricKey, v: number | null | undefined, compact = false): string {
  if (v === null || v === undefined) return 'Unknown';
  const m: MetricDef = METRIC_BY_KEY[key];
  switch (m.unit) {
    case 'percent':
      return `${one.format(v * 100)}%`;
    case 'usd':
      // Scorecard reports a monthly average; shown per year (x12) so it reads like a salary.
      if (key === 'faculty_salary') return `${usdCompact(v * 12)}/yr`;
      return compact || Math.abs(v) >= 1e6 ? usdCompact(v) : `$${int.format(v)}`;
    case 'count':
      return int.format(v);
    case 'ratio':
      if (key === 'student_faculty_ratio') return `${int.format(v)}:1`;
      return v >= 100 ? int.format(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    case 'score':
      return int.format(v);
    case 'rating':
      return v.toFixed(2);
  }
}

/** Like formatMetric, but a flagged value never shows up as a misleading exact number. */
export function formatFlagged(
  key: MetricKey,
  v: number | null | undefined,
  flag: MetricFlag | undefined,
  parentName?: string,
): string {
  if (flag === 'imputed_zero') return 'Under $150K (not in NSF HERD)';
  if (flag === 'reported_with_parent') return parentName ? `Counted with ${parentName}` : 'Counted with parent campus';
  return formatMetric(key, v);
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function pctLabel(p: number): string {
  return `${ordinal(Math.max(1, Math.min(99, Math.round(p * 100))))} percentile`;
}

export function score1(v: number): string {
  return one.format(v);
}

export const FLAG_TEXT: Record<MetricFlag, string> = {
  imputed_zero: 'Not in NSF HERD, which surveys schools with $150K+ of R&D; ranked as the lowest tier',
  reported_with_parent: 'Included in another campus’s HERD figure; unknown on its own',
  system_level: 'Reported for the whole university system, including its medical center or branches',
  derived: 'Computed from other fields',
  manual: 'Entered by hand from the school’s own directory',
  suppressed: 'Withheld by the source for privacy (small cohort)',
};

export const SOURCE_LABEL: Record<string, string> = {
  scorecard: 'College Scorecard',
  urban_ipeds: 'IPEDS via Urban Institute',
  nsf_herd: 'NSF HERD FY2024',
  campuslabs_engage: 'Campus Labs Engage',
  manual_clubs: 'Manual entry',
  derived: 'Derived',
  crowd: 'Student reviews',
};

export function controlLabel(c: 'public' | 'private_nonprofit'): string {
  return c === 'public' ? 'Public' : 'Private nonprofit';
}

export function sizeLabel(n: number): string {
  return `${int.format(n)} undergrads`;
}

export { int as intFormat };
