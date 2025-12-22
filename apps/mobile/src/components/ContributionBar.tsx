import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Contribution } from '@college/ranking-engine';
import { METRIC_BY_KEY } from '@college/ranking-engine';

import { useTheme } from '@/theme/useTheme';

export function describeContribution(it: Contribution): string {
  const m = METRIC_BY_KEY[it.key];
  const standing = it.imputed ? 'no data, estimated' : `top ${Math.max(1, Math.round((1 - it.s) * 100))}%`;
  return `${m.short}: +${it.points.toFixed(1)} pts, ${standing}`;
}

/**
 * Stacked bar of points out of 100, one segment per weighted metric, colored by metric group.
 * Segments are separated by a 2px surface gap; the unfilled remainder is the track. Hovering or
 * pressing a segment reports it through `onFocusSegment` (or the built-in caption).
 */
export function ContributionBar({
  items,
  height = 14,
  caption,
}: {
  items: Contribution[];
  height?: number;
  /** Text shown under the bar when no segment is active; omit to hide the caption line. */
  caption?: string;
}) {
  const c = useTheme();
  const [active, setActive] = useState<Contribution | null>(null);
  const total = items.reduce((a, x) => a + x.points, 0);
  return (
    <View style={{ gap: 4 }}>
      <View
        accessible
        accessibilityLabel={`Score ${total.toFixed(1)} of 100: ${items.map(describeContribution).join('; ')}`}
        style={{ flexDirection: 'row', height, borderRadius: 4, backgroundColor: c.pctTrack, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <Pressable
            key={it.key}
            onHoverIn={() => setActive(it)}
            onHoverOut={() => setActive((a) => (a === it ? null : a))}
            onPressIn={() => setActive(it)}
            style={{
              width: `${it.points}%`,
              height: '100%',
              backgroundColor: c.group[METRIC_BY_KEY[it.key].group],
              opacity: it.imputed ? 0.35 : active && active !== it ? 0.55 : 1,
              borderRightWidth: i < items.length - 1 ? 2 : 0,
              borderRightColor: c.surface,
            }}
          />
        ))}
      </View>
      {caption !== undefined || active ? (
        <Text numberOfLines={1} style={{ fontSize: 11, color: c.inkSecondary, fontVariant: ['tabular-nums'] }}>
          {active ? describeContribution(active) : caption}
        </Text>
      ) : null}
    </View>
  );
}
