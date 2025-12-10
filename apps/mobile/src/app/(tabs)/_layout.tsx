import { TabList, type TabListProps, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompareStore } from '@/state/compareStore';
import { MAX_WIDTH, space } from '@/theme/tokens';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

const TabButton = forwardRef<View, TabTriggerSlotProps & { label: string; badge?: number }>(
  function TabButton({ label, badge, isFocused, ...props }, ref) {
    const c = useTheme();
    const { wide } = useLayout();
    return (
      <Pressable
        ref={ref}
        {...props}
        accessibilityRole="tab"
        accessibilityState={{ selected: !!isFocused }}
        style={{
          flex: wide ? undefined : 1,
          alignItems: 'center',
          paddingVertical: wide ? space.sm : space.sm + 2,
          paddingHorizontal: wide ? space.md : 0,
          borderBottomWidth: wide ? 2 : 0,
          borderTopWidth: wide ? 0 : 2,
          borderColor: isFocused ? c.accent : 'transparent',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 14, fontWeight: isFocused ? '700' : '500', color: isFocused ? c.ink : c.inkSecondary }}>
            {label}
          </Text>
          {badge ? (
            <View style={{ minWidth: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.accent }}>
              <Text style={{ fontSize: 11, color: c.accentInk, fontWeight: '700', textAlign: 'center' }}>{badge}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  },
);

function Brand() {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginRight: 'auto' }}>
      <Text style={{ fontFamily: 'Fraunces_700Bold', fontSize: 20, color: c.ink }}>Your Rank</Text>
      <Text style={{ fontFamily: 'Fraunces_400Regular_Italic', fontSize: 14, color: c.inkMuted }}>
        colleges, by what you value
      </Text>
    </View>
  );
}

function Bar({ children, ...props }: TabListProps) {
  const c = useTheme();
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <View
      {...props}
      style={{
        backgroundColor: c.surface,
        borderColor: c.hairline,
        borderBottomWidth: wide ? 1 : 0,
        borderTopWidth: wide ? 0 : 1,
        paddingBottom: wide ? 0 : insets.bottom,
        paddingTop: wide ? insets.top : 0,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          maxWidth: MAX_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: wide ? space.xl : 0,
          gap: wide ? space.xs : 0,
        }}>
        {wide ? <Brand /> : null}
        {children}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const c = useTheme();
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const compareCount = useCompareStore((s) => s.ids.length);
  return (
    <Tabs
      style={{
        flex: 1,
        backgroundColor: c.page,
        paddingTop: wide ? 0 : insets.top,
        // Tab bar on top for wide screens, at the bottom on phones.
        flexDirection: wide ? 'column' : 'column-reverse',
      }}>
      <TabList asChild>
        <Bar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton label="Rank" />
          </TabTrigger>
          <TabTrigger name="compare" href="/compare" asChild>
            <TabButton label="Compare" badge={compareCount} />
          </TabTrigger>
          <TabTrigger name="profiles" href="/profiles" asChild>
            <TabButton label="Profiles" />
          </TabTrigger>
          <TabTrigger name="about" href="/about" asChild>
            <TabButton label="Method" />
          </TabTrigger>
        </Bar>
      </TabList>
      <TabSlot style={{ flex: 1 }} />
    </Tabs>
  );
}
