import { createElement } from 'react';

import { MAX_WEIGHT } from '@college/ranking-engine';

import { useTheme } from '@/theme/useTheme';

import type { WeightSliderProps } from './WeightSlider';

// A native <input type="range"> on web: keyboard and screen-reader support for free, and it
// fires on every step without the gesture layer the native slider needs.
export function WeightSlider({ value, onChange, label, color, testID }: WeightSliderProps) {
  const c = useTheme();
  const fill = (value / MAX_WEIGHT) * 100;
  return createElement('input', {
    type: 'range',
    min: 0,
    max: MAX_WEIGHT,
    step: 0.5,
    value,
    'aria-label': label,
    'aria-valuetext': `${value} of ${MAX_WEIGHT}`,
    'data-testid': testID,
    onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value)),
    className: 'weight-slider',
    style: {
      flex: 1,
      minWidth: 80,
      accentColor: color,
      background: `linear-gradient(to right, ${color} ${fill}%, ${c.pctTrack} ${fill}%)`,
      ['--thumb' as string]: color,
    },
  });
}
