import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { MetricKey } from '@college/ranking-engine';
import { contributions, GROUPS, METRICS } from '@college/ranking-engine';

import { ContributionBar } from '@/components/ContributionBar';
import { SearchBox } from '@/components/SearchBox';
import { Card, EmptyState, Screen, T } from '@/components/ui';
import { useRanking } from '@/data/RankingProvider';
import { formatFlagged, intFormat, score1 } from '@/lib/format';
import { MAX_COMPARE, useCompareStore } from '@/state/compareStore';
import { radius, space } from '@/theme/tokens';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

function AddSchool({ full }: { full?: boolean }) {
  const c = useTheme();
  const { index, result } = useRanking();
  const ids = useCompareStore((s) => s.ids);
  const toggle = useCompareStore((s) => s.toggle);
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return index.schools
      .filter((s) => !ids.includes(s.id))
      .filter((s) => s.name.toLowerCase().includes(needle) || s.aliases?.some((a) => a.toLowerCase().includes(needle)))
      .slice(0, 6);
  }, [q, index, ids]);
  if (ids.length >= MAX_COMPARE) return <T tone="muted" variant="small">Comparing the maximum of {MAX_COMPARE} schools.</T>;
  return (
    <View style={{ gap: space.xs, maxWidth: full ? undefined : 420, alignSelf: full ? 'stretch' : undefined, width: full ? '100%' : undefined }}>
      <SearchBox value={q} onChange={setQ} placeholder="Add a school to compare" />
      {matches.map((s) => {
        const i = index.idToIdx.get(s.id)!;
        const r = result.rankOf[i];
        return (
          <Pressable
            key={s.id}
            testID={`add-compare-${s.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Add ${s.name}`}
            onPress={() => {
              toggle(s.id);
              setQ('');
            }}
            style={({ pressed }) => ({
              padding: space.sm,
              borderRadius: radius.md,
              backgroundColor: pressed ? c.sunken : c.surfaceRaised,
              borderWidth: 1,
              borderColor: c.hairline,
            })}>
            <Text style={{ color: c.ink, fontSize: 14 }}>
              {s.name} <Text style={{ color: c.inkMuted }}>· {s.state}{r ? ` · #${r}` : ''}</Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CompareScreen() {
  const c = useTheme();
  const router = useRouter();
  const { wide } = useLayout();
  const { index, result, profile, schoolById } = useRanking();
  const ids = useCompareStore((s) => s.ids);
  const remove = useCompareStore((s) => s.remove);
  const idxs = ids.map((id) => index.idToIdx.get(id)).filter((i): i is number => i !== undefined);

  if (idxs.length === 0) {
    return (
      <Screen>
        <View style={{ gap: space.lg }}>
          <T variant="title" serif>
            Compare
          </T>
          <EmptyState
            title="Nothing to compare yet"
            body="Add up to four schools here, or use “Add to compare” on any school page."
            action={<AddSchool full />}
          />
        </View>
      </Screen>
    );
  }

  // "Best" only when it's clearly best: at least 5 percentile points ahead of the runner-up.
  const bestOf = (key: MetricKey): number | null => {
    if (idxs.length < 2) return null;
    const m = METRICS.find((x) => x.key === key)!;
    const dir = m.direction === 'preference' ? (profile.directions[key] ?? m.defaultDirection) : m.direction;
    const k = index.metricIndex.get(key)!;
    const scored = idxs
      .filter((i) => !['imputed_zero', 'reported_with_parent'].includes(index.schools[i]!.flags?.[key] ?? ''))
      .map((i) => ({ i, p: index.pct[k]![i]! }))
      .filter((x) => !Number.isNaN(x.p))
      .map((x) => ({ i: x.i, s: dir === 'lower' ? 1 - x.p : x.p }))
      .sort((a, b) => b.s - a.s);
    if (scored.length < 2) return null;
    return scored[0]!.s - scored[1]!.s >= 0.05 ? scored[0]!.i : null;
  };

  type RowSpec = { key: string; label: string; height: number; cell: (i: number) => React.ReactNode; strong?: boolean; group?: string };
  const rowsSpec: RowSpec[] = [
    {
      key: 'rank',
      label: 'Rank for you',
      height: 48,
      strong: true,
      cell: (i) => (
        <T bold num serif variant="heading">
          {result.rankOf[i] ? `#${result.rankOf[i]}` : 'filtered out'}
        </T>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      height: 56,
      cell: (i) => (
        <View style={{ gap: 6, alignSelf: 'stretch' }}>
          <T bold num>
            {Number.isNaN(result.score[i]!) ? '—' : score1(result.score[i]!)}
          </T>
          {result.rankOf[i] ? <ContributionBar items={contributions(result, i).sort((a, b) => b.points - a.points)} height={8} /> : null}
        </View>
      ),
    },
    { key: 'ug', label: 'Undergraduates', height: 44, cell: (i) => <T num variant="small">{intFormat.format(index.schools[i]!.ugSize)}</T> },
  ];
  for (const g of GROUPS.filter((x) => x.key !== 'crowd')) {
    rowsSpec.push({ key: `g-${g.key}`, label: g.label, height: 36, group: g.key, cell: () => null });
    for (const m of METRICS.filter((x) => x.group === g.key && x.key !== 'undergrad_size')) {
      const best = bestOf(m.key);
      rowsSpec.push({
        key: m.key,
        label: m.label,
        height: 48,
        cell: (i) => {
          const s = index.schools[i]!;
          const parentId = s.reportedWith?.[m.key];
          const isBest = best === i;
          return (
            <View
              accessibilityLabel={isBest ? `${m.label}: best of these` : undefined}
              style={isBest ? { backgroundColor: c.accentWash, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 } : null}>
              <T num bold={isBest} variant="small" tone={s.values[m.key] == null && !s.flags?.[m.key] ? 'muted' : 'primary'}>
                {formatFlagged(m.key, s.values[m.key], s.flags?.[m.key], parentId ? schoolById(parentId)?.name : undefined)}
                {isBest ? ' · best' : ''}
              </T>
            </View>
          );
        },
      });
    }
  }

  const headerH = 96;
  const labelW = wide ? 240 : 124;
  const colW = wide ? undefined : 150;
  const rowBorder = (strong?: boolean) => ({ borderTopWidth: 1, borderTopColor: strong ? c.baseline : c.hairline });

  const labelColumn = (
    <View style={{ width: labelW }}>
      <View style={{ height: headerH }} />
      {rowsSpec.map((r) =>
        r.group ? (
          <View key={r.key} style={{ height: r.height, flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingBottom: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.group[r.group as keyof typeof c.group] }} />
            <T variant="label" tone="secondary">
              {r.label}
            </T>
          </View>
        ) : (
          <View key={r.key} role="rowheader" style={[{ height: r.height, justifyContent: 'center', paddingRight: space.sm }, rowBorder(r.strong)]}>
            <Text numberOfLines={2} style={{ color: c.inkSecondary, fontSize: wide ? 13 : 12, fontWeight: r.strong ? '600' : '400' }}>
              {r.label}
            </Text>
          </View>
        ),
      )}
    </View>
  );

  const schoolColumns = idxs.map((i) => {
    const s = index.schools[i]!;
    return (
      <View key={s.id} style={{ width: colW, flex: wide ? 1 : undefined, paddingHorizontal: space.sm }}>
        <View role="columnheader" style={{ height: headerH, justifyContent: 'flex-end', gap: 3, paddingBottom: space.sm }}>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/school/[id]', params: { id: String(s.id) } })}>
            <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: wide ? 16 : 14, color: c.ink }} numberOfLines={2}>
              {s.name}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: c.inkSecondary }} numberOfLines={1}>
            {s.city}, {s.state}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`} onPress={() => remove(s.id)}>
            <Text style={{ fontSize: 12, color: c.accent, fontWeight: '600' }}>Remove</Text>
          </Pressable>
        </View>
        {rowsSpec.map((r) =>
          r.group ? (
            <View key={r.key} style={{ height: r.height }} />
          ) : (
            <View key={r.key} role="cell" style={[{ height: r.height, justifyContent: 'center', alignItems: 'flex-start' }, rowBorder(r.strong)]}>
              {r.cell(i)}
            </View>
          ),
        )}
      </View>
    );
  });

  return (
    <Screen>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <T variant="title" serif>
            Compare
          </T>
          <T tone="secondary" variant="small">
            Values from the snapshot. “Best” marks a clear leader in a row (5+ percentile points ahead). Rank and score use your
            current weights.
          </T>
        </View>
        <AddSchool />
        <Card style={{ padding: wide ? space.lg : space.sm, overflow: 'hidden' }}>
          <View testID="compare-table" role="table" accessibilityLabel="School comparison" style={{ flexDirection: 'row' }}>
            {labelColumn}
            {wide ? (
              <View style={{ flex: 1, flexDirection: 'row' }}>{schoolColumns}</View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexDirection: 'row' }}>
                {schoolColumns}
              </ScrollView>
            )}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
