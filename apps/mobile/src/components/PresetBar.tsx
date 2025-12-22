import { ScrollView, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PRESETS } from '@college/ranking-engine';

import { useProfileStore } from '@/state/profileStore';
import { useTheme } from '@/theme/useTheme';
import { space } from '@/theme/tokens';

import { Pill } from './ui';

export function PresetBar({ wrap }: { wrap?: boolean }) {
  const c = useTheme();
  const presetId = useProfileStore((s) => s.presetId);
  const applyPreset = useProfileStore((s) => s.applyPreset);
  const pills = (
    <>
      {PRESETS.map((p) => (
        <Pill
          key={p.id}
          testID={`preset-${p.id}`}
          label={p.name}
          selected={presetId === p.id}
          accessibilityLabel={`Preset: ${p.name}. ${p.description}`}
          onPress={() => applyPreset(p.id)}
        />
      ))}
      {presetId === null ? <Pill label="Custom" selected /> : null}
    </>
  );
  if (wrap) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 }}>{pills}</View>;
  // Right-edge fade hints that the row scrolls.
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs + 2, paddingRight: 32 }}>
        {pills}
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={c.page} stopOpacity="0" />
              <Stop offset="1" stopColor={c.page} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>
    </View>
  );
}
