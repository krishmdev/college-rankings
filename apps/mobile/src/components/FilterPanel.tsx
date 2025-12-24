import { useMemo, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import type { Control, Filters, Locale, MetricKey, Region, SizeBand } from '@college/ranking-engine';
import { isEmptyFilters, MISSING_STRATEGIES } from '@college/ranking-engine';

import { useProfileStore } from '@/state/profileStore';
import { useRanking } from '@/data/RankingProvider';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { LinkText, Pill, Segmented, T } from './ui';

function toggle<T>(list: T[] | undefined, v: T): T[] {
  const cur = list ?? [];
  return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
}

const REGIONS: { key: Region; label: string }[] = [
  { key: 'northeast', label: 'Northeast' },
  { key: 'midwest', label: 'Midwest' },
  { key: 'south', label: 'South' },
  { key: 'west', label: 'West' },
  { key: 'other', label: 'Territories' },
];
const SIZES: { key: SizeBand; label: string }[] = [
  { key: 'small', label: 'Under 5K' },
  { key: 'medium', label: '5K-15K' },
  { key: 'large', label: 'Over 15K' },
];
const LOCALES: { key: Locale; label: string }[] = [
  { key: 'city', label: 'City' },
  { key: 'suburb', label: 'Suburb' },
  { key: 'town', label: 'Town' },
  { key: 'rural', label: 'Rural' },
];
const PRICE_CAPS = [null, 15000, 20000, 30000, 40000] as const;
const ADMIT: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any', min: null, max: null },
  { label: 'Under 25%', min: null, max: 0.25 },
  { label: '25-50%', min: 0.25, max: 0.5 },
  { label: '50-75%', min: 0.5, max: 0.75 },
  { label: 'Over 75%', min: 0.75, max: null },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T variant="label" tone="secondary">
        {title}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 }}>{children}</View>
    </View>
  );
}

export function MissingControl() {
  const missing = useProfileStore((s) => s.profile.missing);
  const setMissing = useProfileStore((s) => s.setMissing);
  const desc = MISSING_STRATEGIES.find((m) => m.key === missing)!.description;
  return (
    <View style={{ gap: space.sm }}>
      <T variant="label" tone="secondary">
        When a school has no data
      </T>
      <Segmented
        label="Missing data strategy"
        options={MISSING_STRATEGIES.map((m) => ({ key: m.key, label: m.label }))}
        value={missing}
        onChange={setMissing}
      />
      <T variant="small" tone="muted">
        {desc}
      </T>
    </View>
  );
}

export function FilterPanel({ weightedKeys }: { weightedKeys: MetricKey[] }) {
  const c = useTheme();
  const { snapshot } = useRanking();
  const validStateCodes = useMemo(() => new Set(snapshot.schools.map((school) => school.state)), [snapshot]);
  const f = useProfileStore((s) => s.profile.filters);
  const normalizeWithin = useProfileStore((s) => s.profile.normalizeWithin);
  const setFilters = useProfileStore((s) => s.setFilters);
  const clearFilters = useProfileStore((s) => s.clearFilters);
  const setNormalizeWithin = useProfileStore((s) => s.setNormalizeWithin);
  const [statesText, setStatesText] = useState((f.states ?? []).join(', '));
  const set = (patch: Partial<Filters>) => setFilters(patch);
  const requireAll = !!f.requireData?.length;
  const admitIdx = ADMIT.findIndex((a) => (a.min ?? null) === (f.admitRateMin ?? null) && (a.max ?? null) === (f.admitRateMax ?? null));
  const unknownStateCodes = [...new Set(
    statesText
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter((code) => code.length >= 2 && !validStateCodes.has(code)),
  )];

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="heading" serif>
          Filters
        </T>
        {!isEmptyFilters(f) ? (
          <LinkText
            onPress={() => {
              clearFilters();
              setStatesText('');
            }}>
            Clear all
          </LinkText>
        ) : null}
      </View>
      <Section title="Type">
        {(['public', 'private_nonprofit'] as Control[]).map((k) => (
          <Pill
            key={k}
            label={k === 'public' ? 'Public' : 'Private nonprofit'}
            selected={f.control?.includes(k)}
            onPress={() => set({ control: toggle(f.control, k) })}
          />
        ))}
      </Section>
      <Section title="Region">
        {REGIONS.map((r) => (
          <Pill key={r.key} label={r.label} selected={f.regions?.includes(r.key)} onPress={() => set({ regions: toggle(f.regions, r.key) })} />
        ))}
      </Section>
      <View style={{ gap: space.sm }}>
        <T variant="label" tone="secondary">
          States
        </T>
        <TextInput
          testID="state-filter-input"
          accessibilityLabel="States, comma separated"
          placeholder="e.g. MA, NY, CA"
          placeholderTextColor={c.inkMuted}
          autoCapitalize="characters"
          value={statesText}
          onChangeText={(t) => {
            setStatesText(t);
            const codes = t
              .toUpperCase()
              .split(/[^A-Z]+/)
              .filter((code) => validStateCodes.has(code));
            set({ states: [...new Set(codes)] });
          }}
          style={{
            borderWidth: 1,
            borderColor: c.hairline,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            color: c.ink,
            backgroundColor: c.surfaceRaised,
            fontSize: 14,
          }}
        />
        {unknownStateCodes.length > 0 ? (
          <T testID="state-filter-error" variant="small" tone="critical">
            Unknown state codes: {unknownStateCodes.join(', ')}
          </T>
        ) : null}
      </View>
      <Section title="Undergraduate size">
        {SIZES.map((s) => (
          <Pill key={s.key} label={s.label} selected={f.sizes?.includes(s.key)} onPress={() => set({ sizes: toggle(f.sizes, s.key) })} />
        ))}
      </Section>
      <Section title="Setting">
        {LOCALES.map((l) => (
          <Pill key={l.key} label={l.label} selected={f.locales?.includes(l.key)} onPress={() => set({ locales: toggle(f.locales, l.key) })} />
        ))}
      </Section>
      <Section title="Average net price">
        {PRICE_CAPS.map((cap) => (
          <Pill
            key={String(cap)}
            testID={`price-cap-${cap ?? 'any'}`}
            label={cap === null ? 'Any' : `Under $${cap / 1000}K`}
            selected={(f.maxNetPrice ?? null) === cap}
            onPress={() => set({ maxNetPrice: cap })}
          />
        ))}
      </Section>
      {f.maxNetPrice != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Switch
            accessibilityLabel="Include schools with unknown net price"
            value={f.includeUnknownNetPrice !== false}
            onValueChange={(v) => set({ includeUnknownNetPrice: v })}
          />
          <Text style={{ color: c.inkSecondary, fontSize: 13 }}>Include schools with unknown price</Text>
        </View>
      ) : null}
      <Section title="Admission rate">
        {ADMIT.map((a, i) => (
          <Pill
            key={a.label}
            label={a.label}
            selected={i === (admitIdx < 0 ? 0 : admitIdx)}
            onPress={() => set({ admitRateMin: a.min, admitRateMax: a.max })}
          />
        ))}
      </Section>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Switch
          accessibilityLabel="Only schools with data for every weighted metric"
          value={requireAll}
          onValueChange={(v) => set({ requireData: v ? weightedKeys : [] })}
        />
        <Text style={{ color: c.inkSecondary, fontSize: 13, flex: 1 }}>
          Only schools with data for every metric I weigh
        </Text>
      </View>
      <View style={{ gap: space.sm }}>
        <T variant="label" tone="secondary">
          Compare against
        </T>
        <Segmented
          label="Percentile basis"
          options={[
            { key: 'all', label: 'All 4-year schools' },
            { key: 'filtered', label: 'Only these' },
          ]}
          value={normalizeWithin}
          onChange={setNormalizeWithin}
        />
      </View>
    </View>
  );
}
