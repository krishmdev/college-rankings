import { View } from 'react-native';

import type { Contribution } from '@college/ranking-engine';
import { METRIC_BY_KEY } from '@college/ranking-engine';

import { useTheme } from '@/theme/useTheme';

/**
 * Stacked bar of points out of 100, one segment per weighted metric, colored by metric group.
 * Segments are separated by a 2px surface gap; the unfilled remainder is the track.
 */
export function ContributionBar({ items, height = 14 }: { items: Contribution[]; height?: number }) {
  const c = useTheme();
  const total = items.reduce((a, x) => a + x.points, 0);
  return (
    <View
      accessible
      accessibilityLabel={`Score ${total.toFixed(1)} of 100, from ${items.length} metrics`}
      style={{ flexDirection: 'row', height, borderRadius: 4, backgroundColor: c.pctTrack, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <View
          key={it.key}
          style={{
            width: `${it.points}%`,
            height: '100%',
            backgroundColor: c.group[METRIC_BY_KEY[it.key].group],
            opacity: it.imputed ? 0.35 : 1,
            borderRightWidth: i < items.length - 1 ? 2 : 0,
            borderRightColor: c.surface,
          }}
        />
      ))}
    </View>
  );
}
