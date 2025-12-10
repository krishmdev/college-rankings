import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import type { MetricKey } from '@college/ranking-engine';
import { explain, GROUPS, METRIC_BY_KEY, METRICS, sensitivity } from '@college/ranking-engine';

import { ProvenanceBadge } from '@/components/Badges';
import { ContributionBar } from '@/components/ContributionBar';
import { PercentileBar } from '@/components/PercentileBar';
import { Reviews } from '@/components/Reviews';
import { ScoreRing } from '@/components/ScoreRing';
import { Button, Card, Divider, EmptyState, Screen, T } from '@/components/ui';
import { useRanking } from '@/data/RankingProvider';
import { controlLabel, formatFlagged, intFormat, pctLabel, score1 } from '@/lib/format';
import { MAX_COMPARE, useCompareStore } from '@/state/compareStore';
import { space } from '@/theme/tokens';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

function SchoolLink({ id, name }: { id: number; name: string }) {
  const c = useTheme();
  return (
    <Link href={{ pathname: '/school/[id]', params: { id: String(id) } }} asChild>
      <Pressable accessibilityRole="link">
        <Text style={{ color: c.accent, fontWeight: '600' }}>{name}</Text>
      </Pressable>
    </Link>
  );
}

function signed(x: number) {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}`;
}

export default function SchoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { wide } = useLayout();
  const { result, index, idxOf, schoolById, metaByKey } = useRanking();
  const schoolId = Number(id);
  const school = schoolById(schoolId);
  const i = idxOf(schoolId);
  const inCompare = useCompareStore((s) => s.ids.includes(schoolId));
  const compareFull = useCompareStore((s) => s.ids.length >= MAX_COMPARE);
  const toggleCompare = useCompareStore((s) => s.toggle);

  const ex = useMemo(() => (i === undefined ? null : explain(result, i)), [result, i]);
  // Sensitivity re-scores every school twice per weighted metric (~25 ms), so it waits for a tap.
  const [showSens, setShowSens] = useState(false);
  const sens = useMemo(
    () => (!showSens || i === undefined || !ex ? [] : sensitivity(result, i)),
    [showSens, result, i, ex],
  );

  if (!school || i === undefined) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Not found' }} />
        <EmptyState title="School not found" body={`No school with id ${id} in this snapshot.`} />
      </Screen>
    );
  }

  const nameOf = (idx: number) => index.schools[idx]!.name;
  const contributionsSorted = ex ? [...ex.contributions].sort((a, b) => b.points - a.points) : [];

  return (
    <Screen>
      <Stack.Screen options={{ title: school.name }} />
      <View style={{ gap: space.lg }}>
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
            <View style={{ flex: 1, gap: space.xs }}>
              <T variant={wide ? 'hero' : 'title'} serif bold accessibilityRole="header" testID="school-name">
                {school.name}
              </T>
              <T tone="secondary">
                {school.city}, {school.state} · {controlLabel(school.control)} · {intFormat.format(school.ugSize)}{' '}
                undergrads{school.locale ? ` · ${school.locale}` : ''}
              </T>
              {school.domain ? (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://${school.domain}`)}>
                  <Text style={{ color: c.accent, fontSize: 14 }}>{school.domain}</Text>
                </Pressable>
              ) : null}
            </View>
            {ex ? <ScoreRing score={ex.score} size={72} /> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' }}>
            {ex ? (
              <T variant="heading" serif testID="school-rank">
                #{ex.rank} of {intFormat.format(ex.of)} for you
              </T>
            ) : (
              <T tone="secondary">Outside your current filters.</T>
            )}
            <View style={{ flex: 1 }} />
            <Button
              testID="toggle-compare"
              label={inCompare ? 'In compare' : 'Add to compare'}
              kind={inCompare ? 'secondary' : 'primary'}
              small
              disabled={!inCompare && compareFull}
              onPress={() => toggleCompare(schoolId)}
            />
          </View>
        </Card>

        {ex && ex.contributions.length > 0 ? (
          <Card style={{ gap: space.md }} testID="why-card">
            <T variant="heading" serif>
              Why #{ex.rank}
            </T>
            <T tone="secondary" variant="small">
              Points out of 100, from each metric you weigh. Faded segments are estimates for missing data.
            </T>
            <ContributionBar items={contributionsSorted} />
            <View style={{ gap: 0 }}>
              <View style={{ flexDirection: 'row', paddingVertical: space.xs }}>
                <T variant="label" tone="muted" style={{ flex: 1 }}>
                  Metric
                </T>
                <T variant="label" tone="muted" style={{ width: 64, textAlign: 'right' }}>
                  Weight
                </T>
                <T variant="label" tone="muted" style={{ width: 84, textAlign: 'right' }}>
                  Standing
                </T>
                <T variant="label" tone="muted" style={{ width: 60, textAlign: 'right' }}>
                  Points
                </T>
              </View>
              {contributionsSorted.map((ct) => {
                const m = METRIC_BY_KEY[ct.key];
                return (
                  <View
                    key={ct.key}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.hairline }}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.group[m.group] }} />
                      <Text style={{ color: c.ink, fontSize: 14, flexShrink: 1 }}>{m.label}</Text>
                    </View>
                    <T variant="small" tone="secondary" num style={{ width: 64, textAlign: 'right' }}>
                      {Math.round(ct.share * 100)}%
                    </T>
                    <T variant="small" tone={ct.imputed ? 'warn' : 'secondary'} num style={{ width: 84, textAlign: 'right' }}>
                      {ct.imputed
                        ? 'no data, est.'
                        : school.flags?.[ct.key] === 'imputed_zero'
                          ? 'under $150K'
                          : `top ${Math.max(1, Math.round((1 - ct.s) * 100))}%`}
                    </T>
                    <T variant="small" bold num style={{ width: 60, textAlign: 'right' }}>
                      {ct.points.toFixed(1)}
                    </T>
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.baseline }}>
                <T bold style={{ flex: 1 }}>
                  Score
                </T>
                <T bold num style={{ width: 60, textAlign: 'right' }}>
                  {score1(ex.score)}
                </T>
              </View>
            </View>

            {ex.above || ex.below ? <Divider /> : null}
            {[ex.above, ex.below].map((nb, j) =>
              nb ? (
                <View key={j} style={{ gap: 4 }}>
                  <Text style={{ color: c.ink, fontSize: 14 }}>
                    {j === 0 ? 'Behind ' : 'Ahead of '}
                    <SchoolLink id={index.schools[nb.schoolIdx]!.id} name={`#${nb.rank} ${nameOf(nb.schoolIdx)}`} /> by{' '}
                    {Math.abs(nb.gap).toFixed(1)} points.
                  </Text>
                  <T variant="small" tone="secondary">
                    Biggest differences:{' '}
                    {nb.deltas
                      .filter((d) => Math.abs(d.points) >= 0.05)
                      .slice(0, 3)
                      .map((d) => `${METRIC_BY_KEY[d.key].short} ${signed(d.points)}`)
                      .join(', ') || 'none'}
                  </T>
                </View>
              ) : null,
            )}

            <Divider />
            {!showSens ? (
              <Button
                testID="show-sensitivity"
                label="How much does each weight matter here?"
                kind="ghost"
                small
                onPress={() => setShowSens(true)}
              />
            ) : null}
            {sens.length ? (
              <View style={{ gap: space.xs }}>
                <T variant="label" tone="secondary">
                  How much each weight matters here
                </T>
                {sens.map((s) => (
                  <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ flex: 1, color: c.inkSecondary, fontSize: 13 }}>{METRIC_BY_KEY[s.key].label}</Text>
                    <T variant="small" tone="secondary" num style={{ width: 110, textAlign: 'right' }}>
                      drop it: #{s.rankIfZero}
                    </T>
                    <T variant="small" tone="secondary" num style={{ width: 110, textAlign: 'right' }}>
                      double it: #{s.rankIfDoubled}
                    </T>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ gap: space.lg }} testID="metrics-card">
          <View style={{ gap: 2 }}>
            <T variant="heading" serif>
              The numbers
            </T>
            <T variant="small" tone="secondary">
              Bars show standing against all {intFormat.format(index.schools.length)} four-year schools. The tick marks the
              middle school.
            </T>
          </View>
          {GROUPS.filter((g) => g.key !== 'crowd').map((g) => {
            const metrics = METRICS.filter((m) => m.group === g.key && metaByKey.has(m.key));
            if (!metrics.length) return null;
            return (
              <View key={g.key} style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.group[g.key] }} />
                  <T variant="label" tone="secondary">
                    {g.label}
                  </T>
                </View>
                <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: 'wrap', gap: space.lg }}>
                  {metrics.map((m) => {
                    const k = index.metricIndex.get(m.key as MetricKey)!;
                    const raw = index.pct[k]![i]!;
                    const p = Number.isNaN(raw) ? null : m.direction === 'lower' ? 1 - raw : raw;
                    const v = school.values[m.key];
                    const meta = metaByKey.get(m.key)!;
                    const flag = school.flags?.[m.key];
                    const parentId = school.reportedWith?.[m.key];
                    const parent = parentId ? schoolById(parentId) : undefined;
                    const standing =
                      p === null
                        ? 'No data'
                        : m.direction === 'preference'
                          ? `Higher than ${Math.round(raw * 100)}%`
                          : `Better than ${Math.round(p * 100)}%`;
                    return (
                      <View key={m.key} style={{ gap: 4, width: wide ? '47%' : '100%' }} testID={`metric-${m.key}`}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                          <Text style={{ color: c.inkSecondary, fontSize: 13, flexShrink: 1 }}>{m.label}</Text>
                          <T bold num>
                            {formatFlagged(m.key, v, flag, parent?.name)}
                          </T>
                        </View>
                        <PercentileBar p={p} label={`${m.label}: ${p === null ? 'no data' : pctLabel(p)}`} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' }}>
                          <T variant="micro" tone="muted" num>
                            {standing}
                          </T>
                          <ProvenanceBadge source={meta.source} flag={flag} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </Card>

        <Reviews schoolId={schoolId} schoolName={school.name} />
      </View>
    </Screen>
  );
}
