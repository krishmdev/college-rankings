import { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { MetricGroup, MetricKey } from '@college/ranking-engine';
import { GROUPS, METRICS } from '@college/ranking-engine';

import { useRanking } from '@/data/RankingProvider';
import { useProfileStore } from '@/state/profileStore';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { T } from './ui';
import { WeightSlider } from './WeightSlider';

const MetricRow = memo(function MetricRow({ k, coverage }: { k: MetricKey; coverage: number | null }) {
  const c = useTheme();
  const m = METRICS.find((x) => x.key === k)!;
  const weight = useProfileStore((s) => s.profile.weights[k] ?? 0);
  const direction = useProfileStore((s) => s.profile.directions[k] ?? m.defaultDirection ?? 'higher');
  const setWeight = useProfileStore((s) => s.setWeight);
  const setDirection = useProfileStore((s) => s.setDirection);
  const color = c.group[m.group];
  const unavailable = coverage === null;
  return (
    <View style={{ gap: 2, opacity: unavailable ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm }}>
        <Text style={{ fontSize: 14, color: c.ink, flexShrink: 1 }} numberOfLines={1}>
          {m.label}
        </Text>
        <Text
          accessibilityLabel={unavailable ? 'No data' : `${Math.round((coverage ?? 0) * 100)}% of schools report this`}
          style={{ fontSize: 12, color: c.inkMuted, fontVariant: ['tabular-nums'], flexShrink: 0 }}>
          {unavailable ? 'no data' : `${Math.round(coverage * 100)}% known`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <WeightSlider
          testID={`weight-${k}`}
          label={`Weight for ${m.label}`}
          value={weight}
          onChange={(v) => setWeight(k, v)}
          color={color}
        />
        <Text
          style={{
            width: 30,
            textAlign: 'right',
            fontSize: 14,
            fontWeight: '600',
            color: weight > 0 ? c.ink : c.inkMuted,
            fontVariant: ['tabular-nums'],
          }}>
          {weight % 1 === 0 ? weight.toFixed(0) : weight.toFixed(1)}
        </Text>
      </View>
      {m.direction === 'preference' ? (
        <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: c.inkMuted }}>Prefer</Text>
          {(['lower', 'higher'] as const).map((d) => (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ checked: direction === d }}
              accessibilityLabel={`Prefer ${d} ${m.short}`}
              onPress={() => setDirection(k, d)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: direction === d ? c.accentWash : 'transparent',
              }}>
              <Text style={{ fontSize: 12, color: direction === d ? c.accent : c.inkSecondary, fontWeight: '600' }}>
                {d}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});

function GroupSection({ group, label }: { group: MetricGroup; label: string }) {
  const c = useTheme();
  const { coverage, crowd } = useRanking();
  const metrics = METRICS.filter((m) => m.group === group);
  const active = useProfileStore((s) => metrics.filter((m) => (s.profile.weights[m.key] ?? 0) > 0).length);
  const [open, setOpen] = useState(group !== 'crowd' && group !== 'preference');
  const synthetic = group === 'crowd' && crowd.source === 'demo';
  const coverageOf = (k: MetricKey) => {
    const v = coverage.get(k) ?? 0;
    return v > 0 ? v : null;
  };
  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${active} weighted`}
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 2 }}>
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.group[group] }} />
        <T variant="label" tone="secondary" style={{ flex: 1 }}>
          {label}
          {synthetic ? ' · synthetic demo' : ''}
        </T>
        {active > 0 ? (
          <Text style={{ fontSize: 12, color: c.accent, fontWeight: '600' }}>{active} on</Text>
        ) : null}
        <Text style={{ fontSize: 12, color: c.inkMuted, width: 12 }}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? (
        <View style={{ gap: space.md, paddingLeft: 18 }}>
          {metrics.map((m) => (
            <MetricRow key={m.key} k={m.key} coverage={coverageOf(m.key)} />
          ))}
          {group === 'crowd' ? (
            <T variant="small" tone={crowd.source === 'live' ? 'secondary' : 'warn'}>
              {crowd.source === 'demo'
                ? 'Synthetic demo data: these weights rank on generated ratings, not real students.'
                : crowd.source === 'unavailable'
                  ? 'The review server isn’t reachable, so these weights have no effect right now.'
                  : 'Ratings from students who verified a school email.'}
            </T>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function WeightPanel() {
  return (
    <View style={{ gap: space.lg }}>
      {GROUPS.map((g) => (
        <GroupSection key={g.key} group={g.key} label={g.label} />
      ))}
    </View>
  );
}
