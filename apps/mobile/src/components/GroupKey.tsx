import { Text, View } from 'react-native';

import { GROUPS, METRIC_BY_KEY } from '@college/ranking-engine';

import { useRanking } from '@/data/RankingProvider';
import { useTheme } from '@/theme/useTheme';

/** Color key for the groups the current profile weighs. */
export function GroupKey() {
  const c = useTheme();
  const { result } = useRanking();
  const groups = new Set(result.active.map((a) => METRIC_BY_KEY[a.key].group));
  if (!groups.size) return null;
  return (
    <View accessibilityLabel="Color key" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {GROUPS.filter((g) => groups.has(g.key)).map((g) => (
        <View key={g.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.group[g.key] }} />
          <Text style={{ fontSize: 12, color: c.inkSecondary }}>{g.label}</Text>
        </View>
      ))}
    </View>
  );
}
