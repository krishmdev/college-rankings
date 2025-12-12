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

function AddSchool() {
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
    <View style={{ gap: space.xs, maxWidth: 420 }}>
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

function Row({ label, labelW, children, strong }: { label: string; labelW: number; children: React.ReactNode; strong?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: strong ? c.baseline : c.hairline, alignItems: 'center' }}>
      <View style={{ width: labelW, paddingVertical: space.sm, paddingRight: space.sm }}>
        <Text style={{ color: c.inkSecondary, fontSize: 13, fontWeight: strong ? '600' : '400' }}>{label}</Text>
      </View>
      {children}
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
  const colW = wide ? 220 : 150;
  const labelW = wide ? 240 : 150;

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
            action={<AddSchool />}
          />
        </View>
      </Screen>
    );
  }

  const bestOf = (key: MetricKey): number | null => {
    const m = METRICS.find((x) => x.key === key)!;
    const dir = m.direction === 'preference' ? (profile.directions[key] ?? m.defaultDirection) : m.direction;
    let best: number | null = null;
    let bestV = 0;
    for (const i of idxs) {
      const s = index.schools[i]!;
      if (s.flags?.[key] === 'imputed_zero' || s.flags?.[key] === 'reported_with_parent') continue;
      const v = s.values[key];
      if (v === null || v === undefined) continue;
      if (best === null || (dir === 'lower' ? v < bestV : v > bestV)) {
        best = i;
        bestV = v;
      }
    }
    return idxs.length > 1 ? best : null;
  };

  const cell = { width: colW, paddingVertical: space.sm, paddingHorizontal: space.sm } as const;
  return (
    <Screen>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <T variant="title" serif>
            Compare
          </T>
          <T tone="secondary" variant="small">
            Values from the snapshot; the best in each row is highlighted. Rank and score use your current weights.
          </T>
        </View>
        <AddSchool />
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <ScrollView horizontal contentContainerStyle={{ padding: space.lg }}>
            <View testID="compare-table">
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <View style={{ width: labelW }} />
                {idxs.map((i) => {
                  const s = index.schools[i]!;
                  return (
                    <View key={s.id} style={[cell, { gap: 4 }]}>
                      <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/school/[id]', params: { id: String(s.id) } })}>
                        <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 16, color: c.ink }} numberOfLines={2}>
                          {s.name}
                        </Text>
                      </Pressable>
                      <Text style={{ fontSize: 12, color: c.inkMuted }}>
                        {s.city}, {s.state}
                      </Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`} onPress={() => remove(s.id)}>
                        <Text style={{ fontSize: 12, color: c.accent, fontWeight: '600' }}>Remove</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <Row labelW={labelW} label="Rank for you" strong>
                {idxs.map((i) => (
                  <View key={i} style={cell}>
                    <T bold num serif variant="heading">
                      {result.rankOf[i] ? `#${result.rankOf[i]}` : 'filtered out'}
                    </T>
                  </View>
                ))}
              </Row>
              <Row labelW={labelW} label="Score">
                {idxs.map((i) => (
                  <View key={i} style={[cell, { gap: 6 }]}>
                    <T bold num>
                      {Number.isNaN(result.score[i]!) ? '—' : score1(result.score[i]!)}
                    </T>
                    {result.rankOf[i] ? <ContributionBar items={contributions(result, i).sort((a, b) => b.points - a.points)} height={8} /> : null}
                  </View>
                ))}
              </Row>
              <Row labelW={labelW} label="Undergraduates">
                {idxs.map((i) => (
                  <View key={i} style={cell}>
                    <T num>{intFormat.format(index.schools[i]!.ugSize)}</T>
                  </View>
                ))}
              </Row>
              {GROUPS.filter((g) => g.key !== 'crowd').map((g) => (
                <View key={g.key}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingBottom: space.xs }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.group[g.key] }} />
                    <T variant="label" tone="secondary">
                      {g.label}
                    </T>
                  </View>
                  {METRICS.filter((m) => m.group === g.key && m.key !== 'undergrad_size').map((m) => {
                    const best = bestOf(m.key);
                    return (
                      <Row key={m.key} labelW={labelW} label={m.label}>
                        {idxs.map((i) => {
                          const s = index.schools[i]!;
                          const isBest = best === i;
                          const parentId = s.reportedWith?.[m.key];
                          return (
                            <View
                              key={i}
                              accessibilityLabel={isBest ? `${m.label}: best of these` : undefined}
                              style={[cell, isBest ? { backgroundColor: c.accentWash, borderRadius: radius.sm } : null]}>
                              <T num bold={isBest} tone={s.values[m.key] == null && !s.flags?.[m.key] ? 'muted' : 'primary'} variant="small">
                                {formatFlagged(m.key, s.values[m.key], s.flags?.[m.key], parentId ? schoolById(parentId)?.name : undefined)}
                                {isBest ? '  best' : ''}
                              </T>
                            </View>
                          );
                        })}
                      </Row>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>
      </View>
    </Screen>
  );
}
