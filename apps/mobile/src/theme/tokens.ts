import type { MetricGroup } from '@college/ranking-engine';

export interface Palette {
  page: string;
  surface: string;
  surfaceRaised: string;
  sunken: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  hairline: string;
  baseline: string;
  accent: string;
  accentInk: string;
  accentWash: string;
  good: string;
  warn: string;
  critical: string;
  focus: string;
  /** One color per metric group, in fixed order. Validated with the dataviz palette checker. */
  group: Record<MetricGroup, string>;
  /** Sequential ramp for percentile bars: track, fill. */
  pctTrack: string;
  pctFill: string;
}

// Group order matches the validated categorical order (blue, orange, aqua, yellow, magenta,
// green, violet, red), so adjacent groups in stacked bars stay distinguishable under CVD.
export const light: Palette = {
  page: '#f4f2ec',
  surface: '#fbfaf6',
  surfaceRaised: '#ffffff',
  sunken: '#ecebe4',
  ink: '#16150f',
  inkSecondary: '#52514e',
  inkMuted: '#75736d',
  hairline: '#e1e0d9',
  baseline: '#c3c2b7',
  accent: '#1f4e8c',
  accentInk: '#ffffff',
  accentWash: '#e3ebf6',
  good: '#006300',
  warn: '#8a5a00',
  critical: '#b42d2d',
  focus: '#2a78d6',
  group: {
    outcomes: '#2a78d6',
    cost: '#eb6834',
    teaching: '#1baf7a',
    research: '#eda100',
    campus: '#e87ba4',
    resources: '#008300',
    preference: '#4a3aa7',
    crowd: '#e34948',
  },
  pctTrack: '#e6e4dc',
  pctFill: '#2a78d6',
};

export const dark: Palette = {
  page: '#0f0f0e',
  surface: '#171715',
  surfaceRaised: '#1f1f1d',
  sunken: '#232321',
  ink: '#f6f5f0',
  inkSecondary: '#c3c2b7',
  inkMuted: '#9a988f',
  hairline: '#2c2c2a',
  baseline: '#383835',
  accent: '#86b6ef',
  accentInk: '#0d1b2e',
  accentWash: '#1b2a3e',
  good: '#0ca30c',
  warn: '#fab219',
  critical: '#e66767',
  focus: '#86b6ef',
  group: {
    outcomes: '#3987e5',
    cost: '#d95926',
    teaching: '#199e70',
    research: '#c98500',
    campus: '#d55181',
    resources: '#008300',
    preference: '#9085e9',
    crowd: '#e66767',
  },
  pctTrack: '#2c2c2a',
  pctFill: '#3987e5',
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 4, md: 8, lg: 12, pill: 999 } as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_400Regular_Italic',
} as const;

/** Type scale (size / line height). Body text uses the platform sans. */
export const type = {
  hero: { fontSize: 34, lineHeight: 40 },
  title: { fontSize: 26, lineHeight: 32 },
  heading: { fontSize: 19, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, lineHeight: 14 },
} as const;

export const WIDE_BREAKPOINT = 960;
export const MAX_WIDTH = 1280;
