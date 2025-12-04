export const METRIC_KEYS = [
  'grad_rate',
  'retention_rate',
  'median_earnings_10y',
  'pell_grad_rate',
  'net_price',
  'net_price_low_income',
  'median_debt',
  'earnings_to_price',
  'faculty_count',
  'student_faculty_ratio',
  'ft_faculty_share',
  'instructional_spend_per_fte',
  'faculty_salary',
  'research_total',
  'research_per_student',
  'clubs_count',
  'clubs_per_1k_ug',
  'admit_rate',
  'sat_avg',
  'undergrad_size',
  'endowment_per_student',
  'crowd_overall',
  'crowd_academics',
  'crowd_social',
  'crowd_career',
  'crowd_housing',
  'crowd_safety',
  'crowd_value',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricGroup =
  | 'outcomes'
  | 'cost'
  | 'teaching'
  | 'research'
  | 'campus'
  | 'preference'
  | 'resources'
  | 'crowd';

/** `preference` metrics have no built-in better direction; the profile picks one. */
export type Direction = 'higher' | 'lower' | 'preference';

export type MetricUnit = 'percent' | 'usd' | 'count' | 'ratio' | 'score' | 'rating';

export interface MetricDef {
  key: MetricKey;
  label: string;
  short: string;
  group: MetricGroup;
  direction: Direction;
  /** Default direction for preference metrics. */
  defaultDirection?: 'higher' | 'lower';
  unit: MetricUnit;
  description: string;
}

export type Control = 'public' | 'private_nonprofit';
export type Locale = 'city' | 'suburb' | 'town' | 'rural';
export const METRIC_FLAGS = [
  'imputed_zero',
  'system_level',
  'reported_with_parent',
  'derived',
  'manual',
  'suppressed',
] as const;
export type MetricFlag = (typeof METRIC_FLAGS)[number];

export interface School {
  id: number;
  name: string;
  aliases?: string[];
  city: string;
  state: string;
  control: Control;
  locale: Locale | null;
  lat?: number | null;
  lon?: number | null;
  domain: string | null;
  ugSize: number;
  values: Partial<Record<MetricKey, number | null>>;
  flags?: Partial<Record<MetricKey, MetricFlag>>;
  /** Metric -> id of the school whose reported figure includes this one. */
  reportedWith?: Partial<Record<MetricKey, number>>;
}

export type MissingStrategy = 'penalize' | 'neutral' | 'renormalize';
export type Region = 'northeast' | 'midwest' | 'south' | 'west' | 'other';
export type SizeBand = 'small' | 'medium' | 'large';

export interface Filters {
  states?: string[];
  regions?: Region[];
  control?: Control[];
  sizes?: SizeBand[];
  locales?: Locale[];
  /** Annual net price cap in USD. */
  maxNetPrice?: number | null;
  /** When a net-price cap is set, keep schools whose net price is unknown. Defaults to true. */
  includeUnknownNetPrice?: boolean;
  /** Admit rate bounds as fractions (0-1). Schools with unknown admit rate are dropped when set. */
  admitRateMin?: number | null;
  admitRateMax?: number | null;
  /** Only keep schools that report every listed metric. */
  requireData?: MetricKey[];
}

export interface Profile {
  weights: Partial<Record<MetricKey, number>>;
  directions: Partial<Record<MetricKey, 'higher' | 'lower'>>;
  missing: MissingStrategy;
  /** 'all' ranks against national percentiles; 'filtered' recomputes percentiles inside the filter. */
  normalizeWithin: 'all' | 'filtered';
  filters: Filters;
}

export const MAX_WEIGHT = 10;
