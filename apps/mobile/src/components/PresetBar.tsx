import { ScrollView, View } from 'react-native';

import { PRESETS } from '@college/ranking-engine';

import { useProfileStore } from '@/state/profileStore';
import { space } from '@/theme/tokens';

import { Pill } from './ui';

export function PresetBar({ wrap }: { wrap?: boolean }) {
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
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs + 2 }}>
      {pills}
    </ScrollView>
  );
}
