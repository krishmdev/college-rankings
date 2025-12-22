import { View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

/**
 * National percentile as a single-hue bar on a recessive track, with a hairline tick at the
 * median so "above or below the typical school" reads at a glance. Missing data shows an empty
 * hatched-looking track instead of a zero-length bar.
 */
export function PercentileBar({ p, height = 8, label }: { p: number | null; height?: number; label: string }) {
  const c = useTheme();
  const pct = p === null ? null : Math.max(0.02, Math.min(1, p));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={p === null ? { text: 'unknown' } : { min: 0, max: 100, now: Math.round(p * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: c.pctTrack,
        overflow: 'hidden',
        opacity: p === null ? 0.5 : 1,
      }}>
      {pct !== null ? (
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: c.pctFill, borderRadius: height / 2 }} />
      ) : null}
      <View
        style={{ position: 'absolute', left: '50%', marginLeft: -1, top: 0, bottom: 0, width: 2, backgroundColor: c.ink, opacity: 0.45 }}
      />
    </View>
  );
}
