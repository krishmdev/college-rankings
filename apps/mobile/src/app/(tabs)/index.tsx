import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { METRIC_BY_KEY } from '@college/ranking-engine';

import { FilterPanel, MissingControl } from '@/components/FilterPanel';
import { GroupKey } from '@/components/GroupKey';
import { PresetBar } from '@/components/PresetBar';
import { RankList } from '@/components/RankList';
import { SearchBox } from '@/components/SearchBox';
import { Button, Divider, T } from '@/components/ui';
import { WeightPanel } from '@/components/WeightPanel';
import { useRanking } from '@/data/RankingProvider';
import { intFormat } from '@/lib/format';
import { useProfileStore } from '@/state/profileStore';
import { radius, space } from '@/theme/tokens';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

function useSharedProfileParam() {
  const params = useLocalSearchParams<{ p?: string }>();
  const router = useRouter();
  const applyShared = useProfileStore((s) => s.applyShared);
  const notice = useProfileStore((s) => s.notice);
  const clearNotice = useProfileStore((s) => s.clearNotice);
  useEffect(() => {
    if (!params.p) return;
    applyShared(params.p);
    router.setParams({ p: undefined });
  }, [params.p, applyShared, router]);
  return [notice, clearNotice] as const;
}

function Summary() {
  const { result, index, pending } = useRanking();
  const c = useTheme();
  const n = result.order.length;
  const active = result.active;
  const top = [...active].sort((a, b) => b.weight - a.weight).slice(0, 3);
  return (
    <View style={{ gap: 2 }}>
      <T variant="title" serif testID="rank-summary">
        {intFormat.format(n)} {n === 1 ? 'school' : 'schools'}
        {n < index.schools.length ? ` of ${intFormat.format(index.schools.length)}` : ''}
      </T>
      <Text style={{ color: c.inkSecondary, fontSize: 14, opacity: pending ? 0.6 : 1 }}>
        {active.length === 0
          ? 'Give something a weight to start ranking.'
          : `Ranked by ${active.length} thing${active.length === 1 ? '' : 's'} you care about, mostly ${top
              .map((a) => METRIC_BY_KEY[a.key].short.toLowerCase())
              .join(', ')}.`}
      </Text>
    </View>
  );
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  const c = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: c.accentWash,
      }}>
      <Text style={{ flex: 1, color: c.ink, fontSize: 14 }}>{text}</Text>
      <Button label="OK" kind="ghost" small onPress={onClose} />
    </View>
  );
}

// Keyboard users land on the weight panel first; this jumps past it to the list.
function SkipToResults() {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => (document.querySelector('[data-testid="search"]') as HTMLElement | null)?.focus()}
      style={{
        position: 'absolute',
        zIndex: 10,
        left: space.md,
        top: focused ? space.md : -100,
        padding: space.sm,
        borderRadius: radius.md,
        backgroundColor: c.accent,
      }}>
      <Text style={{ color: c.accentInk, fontWeight: '600' }}>Skip to results</Text>
    </Pressable>
  );
}

function Controls() {
  const { result } = useRanking();
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <T variant="label" tone="secondary">
          Start from
        </T>
        <PresetBar wrap />
      </View>
      <Divider />
      <View style={{ gap: space.sm }}>
        <T variant="heading" serif>
          What matters to you
        </T>
        <T variant="small" tone="muted">
          Each metric becomes a percentile against all four-year schools, then your weights mix them.
        </T>
      </View>
      <WeightPanel />
      <Divider />
      <MissingControl />
      <Divider />
      <FilterPanel weightedKeys={result.active.map((a) => a.key)} />
    </View>
  );
}

export default function RankScreen() {
  const c = useTheme();
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(false);
  const [notice, clearNotice] = useSharedProfileParam();
  const { result } = useRanking();

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.page }}>
        {Platform.OS === 'web' ? <SkipToResults /> : null}
        <ScrollView
          testID="controls"
          style={{ width: 380, flexGrow: 0, borderRightWidth: 1, borderRightColor: c.hairline, backgroundColor: c.page }}
          contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}>
          <Controls />
        </ScrollView>
        <View style={{ flex: 1 }}>
          <View style={{ padding: space.xl, paddingBottom: space.md, gap: space.md, backgroundColor: c.page }}>
            {notice ? <Notice text={notice} onClose={clearNotice} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.lg, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 280 }}>
                <Summary />
              </View>
              <View style={{ width: 300 }}>
                <SearchBox value={query} onChange={setQuery} placeholder="Find a school in this ranking" />
              </View>
            </View>
            <GroupKey />
          </View>
          <View style={{ flex: 1, marginHorizontal: space.xl, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.hairline }}>
            <RankList query={query} onClearQuery={() => setQuery('')} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.md }}>
        {notice ? <Notice text={notice} onClose={clearNotice} /> : null}
        <Summary />
        <PresetBar />
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <SearchBox value={query} onChange={setQuery} placeholder="Find a school" />
          <Button testID="open-controls" label="Weights & filters" kind="secondary" onPress={() => setSheet(true)} />
        </View>
      </View>
      <RankList query={query} onClearQuery={() => setQuery('')} />
      <Modal visible={sheet} animationType="slide" onRequestClose={() => setSheet(false)} presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.page, paddingTop: insets.top }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: space.lg,
              borderBottomWidth: 1,
              borderBottomColor: c.hairline,
            }}>
            <T variant="heading" serif>
              Weights and filters
            </T>
            <Button testID="close-controls" label={`Show ${intFormat.format(result.order.length)}`} onPress={() => setSheet(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl + insets.bottom }}>
            <Controls />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
