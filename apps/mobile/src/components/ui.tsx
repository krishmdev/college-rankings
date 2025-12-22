import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { fonts, MAX_WIDTH, radius, space, type } from '@/theme/tokens';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'small' | 'micro' | 'label';
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'good' | 'warn' | 'critical';

export function T({
  variant = 'body',
  tone = 'primary',
  serif,
  bold,
  num,
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone; serif?: boolean; bold?: boolean; num?: boolean }) {
  const c = useTheme();
  // Micro text is small enough that the muted ink fails contrast; it gets secondary ink instead.
  if (variant === 'micro' && tone === 'muted') tone = 'secondary';
  const color = {
    primary: c.ink,
    secondary: c.inkSecondary,
    muted: c.inkMuted,
    accent: c.accent,
    good: c.good,
    warn: c.warn,
    critical: c.critical,
  }[tone];
  const base: TextStyle =
    variant === 'label'
      ? { ...type.micro, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600' }
      : { ...type[variant] };
  const family: TextStyle = serif
    ? { fontFamily: bold ? fonts.displayBold : fonts.display }
    : bold
      ? { fontWeight: '600' }
      : {};
  const nums: TextStyle = num ? { fontVariant: ['tabular-nums'] } : {};
  return <Text {...rest} style={[base, { color }, family, nums, style]} />;
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const c = useTheme();
  const { wide } = useLayout();
  const inner = (
    <View
      style={[
        { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: wide ? space.xl : space.lg },
        contentStyle,
      ]}>
      {children}
    </View>
  );
  if (!scroll) return <View style={{ flex: 1, backgroundColor: c.page }}>{inner}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.page }} contentContainerStyle={{ paddingBottom: space.xxxl }}>
      {inner}
    </ScrollView>
  );
}

export function Card({ style, children, ...rest }: ViewProps) {
  const c = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.hairline,
          padding: space.lg,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  small,
  disabled,
  accessibilityLabel,
  testID,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost';
  small?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  icon?: ReactNode;
}) {
  const c = useTheme();
  const bg = kind === 'primary' ? c.accent : kind === 'secondary' ? c.surfaceRaised : 'transparent';
  const fg = kind === 'primary' ? c.accentInk : c.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: small ? space.xs + 1 : space.sm + 1,
          paddingHorizontal: small ? space.md : space.lg,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: c.hairline,
          opacity: disabled ? 0.45 : pressed ? 0.75 : hovered ? 0.9 : 1,
          alignSelf: 'flex-start',
        },
      ]}>
      {icon}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 13 : 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({
  label,
  selected,
  onPress,
  accessibilityLabel,
  testID,
  dot,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  dot?: string;
}) {
  const c = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.accent : c.hairline,
        backgroundColor: selected ? c.accentWash : c.surfaceRaised,
        opacity: pressed ? 0.75 : 1,
      })}>
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
      <Text style={{ fontSize: 13, color: selected ? c.accent : c.inkSecondary, fontWeight: selected ? '600' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', backgroundColor: c.sunken, borderRadius: radius.md, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              paddingVertical: 6,
              paddingHorizontal: space.sm,
              borderRadius: radius.sm + 2,
              backgroundColor: on ? c.surfaceRaised : 'transparent',
              alignItems: 'center',
              ...(on && Platform.OS === 'web' ? { boxShadow: '0 1px 2px rgba(0,0,0,0.12)' } : {}),
            }}>
            <Text style={{ fontSize: 13, fontWeight: on ? '600' : '500', color: on ? c.ink : c.inkSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  const c = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline }, style]} />;
}

export function Row({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center' }, style]} />;
}

export function Stack({ gap = space.md, style, ...rest }: ViewProps & { gap?: number }) {
  return <View {...rest} style={[{ gap }, style]} />;
}

export function LinkText({ children, onPress, ...rest }: PressableProps & { children: string }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} {...rest}>
      <Text style={{ color: c.accent, fontWeight: '600', fontSize: 14 }}>{children}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
      <T variant="heading" serif>
        {title}
      </T>
      {body ? (
        <T tone="secondary" style={{ textAlign: 'center', maxWidth: 420 }}>
          {body}
        </T>
      ) : null}
      {action}
    </Card>
  );
}
