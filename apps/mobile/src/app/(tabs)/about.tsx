import { Linking, Pressable, Text, View } from 'react-native';

import report from '@college/dataset/data/report.json';
import { METRIC_BY_KEY, US_NEWS_STYLE_WEIGHTS } from '@college/ranking-engine';

import { Card, Screen, T } from '@/components/ui';
import { useRanking } from '@/data/RankingProvider';
import { SOURCE_LABEL, usdCompact } from '@/lib/format';
import { space } from '@/theme/tokens';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: space.md }}>
      <T variant="heading" serif accessibilityRole="header">
        {title}
      </T>
      {children}
    </Card>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <T tone="secondary" style={{ maxWidth: 760 }}>
      {children}
    </T>
  );
}

function Formula({ children }: { children: string }) {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.sunken, borderRadius: 6, paddingHorizontal: space.md, paddingVertical: space.sm, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: 'monospace', fontSize: 13, color: c.ink }}>{children}</Text>
    </View>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  const c = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
        {head.map((h, i) => (
          <T key={h} variant="label" tone="muted" style={{ flex: i === 0 ? 2 : 1, textAlign: i === 0 ? 'left' : 'right' }}>
            {h}
          </T>
        ))}
      </View>
      {rows.map((r, j) => (
        <View key={j} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.hairline, paddingVertical: 5 }}>
          {r.map((cell, i) => (
            <T key={i} variant="small" num tone={i === 0 ? 'primary' : 'secondary'} style={{ flex: i === 0 ? 2 : 1, textAlign: i === 0 ? 'left' : 'right' }}>
              {String(cell)}
            </T>
          ))}
        </View>
      ))}
    </View>
  );
}

const USN_FACTORS: [string, number, string][] = [
  ['Graduation rates', 16, 'grad_rate'],
  ['First-year retention', 5, 'retention_rate'],
  ['Graduation rate performance', 10, ''],
  ['Social mobility (Pell, first-gen)', 11, 'pell_grad_rate'],
  ['Borrower debt', 5, 'median_debt'],
  ['Earnings vs. high school grads', 5, 'median_earnings_10y'],
  ['Peer assessment survey', 20, ''],
  ['Financial resources per student', 8, 'instructional_spend_per_fte'],
  ['Faculty salaries', 6, 'faculty_salary'],
  ['Student-faculty ratio', 3, 'student_faculty_ratio'],
  ['Full-time faculty', 2, 'ft_faculty_share'],
  ['SAT/ACT scores', 5, 'sat_avg'],
  ['Bibliometrics (citations)', 4, 'research_total'],
];

export default function AboutScreen() {
  const c = useTheme();
  const { wide } = useLayout();
  const { snapshot } = useRanking();
  const r = report.research;
  const us = report.usnewsSensitivity;
  const ms = report.missingStrategies;
  return (
    <Screen>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <T variant={wide ? 'hero' : 'title'} serif bold>
            How the ranking works
          </T>
          <T tone="secondary" style={{ maxWidth: 760 }}>
            You decide what matters. The app turns public data on {snapshot.universe.count.toLocaleString('en-US')} four-year
            colleges into percentiles, mixes them with your weights, and shows its work for every school.
          </T>
        </View>

        <Section title="From raw numbers to a score">
          <P>Each metric becomes a mid-rank percentile across every school that reports it, so ties (like the hundreds of schools with little or no research) share one value:</P>
          <Formula>p = (schools below + ½ · schools tied) / schools reporting</Formula>
          <P>For metrics where lower is better (net price, debt, class ratio) the app uses 1 − p. Your score is the weighted average, out of 100:</P>
          <Formula>score = 100 · Σ wᵢ·sᵢ / Σ wᵢ</Formula>
          <P>Only ratios between weights matter, so doubling every slider changes nothing. The contributions 100·wᵢ·sᵢ/Σw add up exactly to the score; that’s the “Why #N” breakdown on each school page. Ties are broken by score, then data coverage, then name, so the same profile always gives the same order.</P>
        </Section>

        <Section title="Why percentiles and not raw values">
          <P>
            {`Research spending is the clearest case. Across ${r.schools_with_value.toLocaleString('en-US')} schools with a value, the median is ${usdCompact(r.median_usd)}, the mean ${usdCompact(r.mean_usd)}, and the top (${r.max_school}) ${usdCompact(r.max_usd)}. Scaled min-max, ${(r.minmax_share_below_0_05 * 100).toFixed(0)}% of schools land below 0.05 and only ${r.minmax_schools_above_0_5} above 0.5, so the research slider would only reorder a few dozen schools. As z-scores, Boston University is +${r.z_boston_university} while the median school is ${r.z_median_school}; one heavy-tailed metric would swamp the rest. As a percentile, BU is ${r.percentile_boston_university}, and every metric is spread evenly from 0 to 1, so a weight of 5 means the same thing on every slider.`}
          </P>
          <P>The cost: magnitude is thrown away ($2B and $1B differ only by rank), and percentiles depend on which schools are in the universe. The snapshot is fixed and versioned, which keeps results reproducible.</P>
        </Section>

        <Section title="When a school has no data">
          <P>
            Penalize (the default) fills a missing metric at the 25th percentile. That assumes “below average”, not “worst”: a school that would land in the bottom quarter on that metric can come out ahead by not reporting it. If that matters to you, turn on “only schools with data for every metric I weigh” in the filters.
          </P>
          <P>Neutral fills at the 50th percentile.</P>
          <P>
            Use what is known fills a missing metric with the school’s own average on the metrics it does report, pulled toward the middle by how much of your profile is missing. With c the share of your weight that has data and raw the weighted mean of the known scores:
          </P>
          <Formula>fill = c · raw + (1 − c) · 0.5   ⇒   score = (1 − (1 − c)²) · raw + (1 − c)² · 0.5</Formula>
          <P>
            The original design shrank the whole score instead, score = c·raw + (1 − c)·0.5. Expanding c·raw gives Σ(known w·s)/Σw, and (1 − c)·0.5 gives Σ(missing w)·0.5/Σw, which is exactly the neutral strategy. Shrinking the fill value is what makes this option different.
          </P>
          <P>
            {`How much this matters: with the Campus life preset (club counts cover about 1 in 5 schools), penalize and neutral agree on ${ms.top50_overlap_penalize_neutral} of the top 50, while “use what is known” shares ${ms.top50_overlap_penalize_renormalize} of them.`}
          </P>
        </Section>

        <Section title="Compared with U.S. News">
          <P>
            U.S. News sets one weighting for everyone and leans on a reputation survey. The “U.S. News-style” preset copies their National Universities weights where public data exists, using the weights they have published since the 2024 edition and say the 2026 edition kept. usnews.com blocked automated fetches while this was built, so the weights come from secondary summaries and should be checked against their methodology page.
          </P>
          <Table
            head={['U.S. News factor', 'Their weight', 'Here']}
            rows={USN_FACTORS.map(([name, w, key]) => [
              name,
              `${w}%`,
              key ? `${METRIC_BY_KEY[key as keyof typeof METRIC_BY_KEY].short} (${US_NEWS_STYLE_WEIGHTS[key as keyof typeof US_NEWS_STYLE_WEIGHTS]})` : 'not replicable',
            ])}
          />
          <P>{`Small changes move schools a lot. Among the top 50 under this preset, the biggest single move is ${us.biggestMoveTop50.name}: #${us.biggestMoveTop50.from} to #${us.biggestMoveTop50.to} when you ${us.biggestMoveTop50.label.replace('add', 'add a')}.`}</P>
          <Table
            head={['School', 'Rank', ...us.scenarios.slice(0, wide ? 6 : 3)]}
            rows={us.rows.slice(0, 10).map((row) => [row.name, row.rank, ...us.scenarios.slice(0, wide ? 6 : 3).map((s) => (row.scenarios as Record<string, number>)[s]!)])}
          />
        </Section>

        <Section title="Data sources and coverage">
          <P>{`Snapshot ${snapshot.snapshotId}. Universe: ${snapshot.universe.rule}.`}</P>
          <Table
            head={['Metric', 'Source', 'Coverage']}
            rows={snapshot.metrics.map((m) => [METRIC_BY_KEY[m.key].label, SOURCE_LABEL[m.source] ?? m.source, `${(m.coverage * 100).toFixed(1)}%`])}
          />
          {snapshot.sources
            .filter((s) => s.homepage)
            .map((s) => (
              <Pressable key={s.id} accessibilityRole="link" onPress={() => Linking.openURL(s.homepage)}>
                <Text style={{ color: c.accent, fontSize: 13 }}>
                  {s.name} <Text style={{ color: c.inkMuted }}>· {s.license}</Text>
                </Text>
              </Pressable>
            ))}
          <P>
            Research comes from NSF HERD, which surveys schools with at least $150K of R&D. A school missing from HERD is ranked as the lowest tier and shown as “under $150K”, never as $0. Branch campuses and medical centers whose R&D is reported in a parent’s figure are marked unknown instead.
          </P>
          <P>Club counts come from public Campus Labs Engage directories, crawled at no more than two requests per second; only counts are stored. Schools on other platforms show as unknown.</P>
        </Section>

        <Section title="What this can’t tell you">
          <P>Every number is a school-wide average. Your major, your aid package, and your own fit aren’t in here. Student reviews in offline mode are synthetic and labeled as such; verified reviews need the Supabase backend.</P>
        </Section>
      </View>
    </Screen>
  );
}
