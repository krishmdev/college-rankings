import { TextInput } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const c = useTheme();
  return (
    <TextInput
      testID="search"
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      placeholderTextColor={c.inkMuted}
      value={value}
      onChangeText={onChange}
      autoCorrect={false}
      clearButtonMode="while-editing"
      style={{
        flex: 1,
        minWidth: 160,
        borderWidth: 1,
        borderColor: c.hairline,
        borderRadius: radius.pill,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        color: c.ink,
        backgroundColor: c.surfaceRaised,
        fontSize: 14,
      }}
    />
  );
}
