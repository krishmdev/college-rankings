import { Text, View } from 'react-native';

import type { Contribution } from '@college/ranking-engine';
import { METRIC_BY_KEY } from '@college/ranking-engine';

import { useTheme } from '@/theme/useTheme';

/** The top few metrics behind a school's score, as colored-dot chips with their points. */
export function ContributionChips({ items }: { items: Contribution[] }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {items.map((it) => {
        const m = METRIC_BY_KEY[it.key];
        return (
          <View
            key={it.key}
            accessible
            accessibilityLabel={`${m.short}: ${it.points.toFixed(1)} points${it.imputed ? ', estimated' : ''}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingVertical: 2,
              paddingHorizontal: 8,
              borderRadius: 999,
              backgroundColor: c.sunken,
            }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: it.imputed ? 'transparent' : c.group[m.group],
                borderWidth: it.imputed ? 1.5 : 0,
                borderColor: c.group[m.group],
              }}
            />
            <Text style={{ fontSize: 12, color: c.inkSecondary }}>
              {m.short}
              {it.imputed ? ' (est.)' : ''}
            </Text>
            <Text style={{ fontSize: 12, color: c.ink, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {it.points.toFixed(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
