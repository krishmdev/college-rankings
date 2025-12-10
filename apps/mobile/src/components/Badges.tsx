import { Text, View } from 'react-native';

import type { MetricFlag } from '@college/ranking-engine';

import { FLAG_TEXT, SOURCE_LABEL } from '@/lib/format';
import { useTheme } from '@/theme/useTheme';

export function CoverageBadge({ coverage }: { coverage: number }) {
  const c = useTheme();
  if (coverage >= 0.999) return null;
  const pct = Math.round(coverage * 100);
  const low = coverage < 0.6;
  return (
    <View
      accessible
      accessibilityLabel={`Data for ${pct}% of your weights`}
      style={{
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: low ? c.warn : c.hairline,
      }}>
      <Text style={{ fontSize: 11, color: low ? c.warn : c.inkMuted, fontVariant: ['tabular-nums'] }}>
        {pct}% data
      </Text>
    </View>
  );
}

export function ProvenanceBadge({ source, flag }: { source: string; flag?: MetricFlag }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: c.sunken }}>
        <Text style={{ fontSize: 11, color: c.inkSecondary }}>{SOURCE_LABEL[source] ?? source}</Text>
      </View>
      {flag ? (
        <View
          style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: c.warn }}>
          <Text style={{ fontSize: 11, color: c.warn }}>{FLAG_TEXT[flag]}</Text>
        </View>
      ) : null}
    </View>
  );
}
