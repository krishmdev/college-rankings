// Generates every number the README and the Method screen quote about the ranking, from the
// committed snapshot. Run with `pnpm engine:report`; writes packages/dataset/data/report.json and
// docs/results/report.md. Nothing here is typed by hand.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MetricKey, Profile, School } from '../src';
import { buildIndex, METRIC_BY_KEY, PRESETS, presetById, rank, rankUnder, rows } from '../src';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const snap = JSON.parse(readFileSync(join(root, 'packages/dataset/data/snapshot.json'), 'utf8')) as {
  snapshotId: string;
  contentHash: string;
  schools: (School & { flags?: Record<string, string> })[];
};
const index = buildIndex(snap.schools);
const byId = new Map(snap.schools.map((s) => [s.id, s]));

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

// 1. Why percentiles: the research distribution breaks min-max and z-scores.
const research = snap.schools
  .map((s) => ({ s, v: s.values.research_total }))
  .filter((x): x is { s: (typeof snap.schools)[number]; v: number } => x.v !== null && x.v !== undefined);
const vals = research.map((x) => x.v);
const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
const max = Math.max(...vals);
const maxSchool = research.find((x) => x.v === max)!.s.name;
const med = median(vals);
const minMax = vals.map((v) => v / max);
const bu = byId.get(164988)!;
const buV = bu.values.research_total!;
const buPct = index.pct[index.metricIndex.get('research_total')!]![index.idToIdx.get(164988)!]!;
const researchStats = {
  schools_with_value: vals.length,
  imputed_zero_not_in_herd: snap.schools.filter((s) => s.flags?.research_total === 'imputed_zero').length,
  reported_with_parent: snap.schools.filter((s) => s.flags?.research_total === 'reported_with_parent').length,
  median_usd: med,
  mean_usd: round(mean, 0),
  sd_usd: round(sd, 0),
  max_usd: max,
  max_school: maxSchool,
  minmax_share_below_0_05: round(minMax.filter((x) => x < 0.05).length / minMax.length, 3),
  minmax_median_school: round(med / max, 6),
  minmax_schools_above_0_5: minMax.filter((x) => x > 0.5).length,
  z_boston_university: round((buV - mean) / sd, 2),
  z_median_school: round((med - mean) / sd, 2),
  percentile_boston_university: round(buPct, 3),
};

// 2. Top 10 per preset.
const presetTops = PRESETS.map((p) => ({
  id: p.id,
  name: p.name,
  top: rows(rank(index, p.profile), 0, 10).map((r) => ({ rank: r.rank, id: r.school.id, name: r.school.name, score: round(r.score, 1) })),
}));

// 3. Sensitivity of the U.S. News-style preset.
const usnews = presetById('usnews')!.profile;
const usResult = rank(index, usnews);
const scenarios: { label: string; profile: Profile }[] = [
  ...(['grad_rate', 'sat_avg', 'research_total', 'faculty_salary', 'instructional_spend_per_fte'] as MetricKey[]).map(
    (k) => ({ label: `no ${METRIC_BY_KEY[k].short.toLowerCase()}`, profile: { ...usnews, weights: { ...usnews.weights, [k]: 0 } } }),
  ),
  { label: 'add net price (w=5)', profile: { ...usnews, weights: { ...usnews.weights, net_price: 5 } } },
];
const sensitivityTable = rows(usResult, 0, 15).map((r) => {
  const i = index.idToIdx.get(r.school.id)!;
  return {
    id: r.school.id,
    name: r.school.name,
    rank: r.rank,
    scenarios: Object.fromEntries(scenarios.map((sc) => [sc.label, rankUnder(usResult, sc.profile, i)])),
  };
});
// Largest single-scenario move among the U.S. News-style top 50.
let biggest = { name: '', from: 0, to: 0, label: '' };
for (const r of rows(usResult, 0, 50)) {
  const i = index.idToIdx.get(r.school.id)!;
  for (const sc of scenarios) {
    const to = rankUnder(usResult, sc.profile, i);
    if (Math.abs(to - r.rank) > Math.abs(biggest.to - biggest.from)) biggest = { name: r.school.name, from: r.rank, to, label: sc.label };
  }
}

// 4. Missing-data strategies disagree when coverage is partial (clubs cover ~1 in 5 schools).
const campus = presetById('campus')!.profile;
const topIds = (p: Profile, n: number) => new Set(rows(rank(index, p), 0, n).map((r) => r.school.id));
const strategies = (['penalize', 'neutral', 'renormalize'] as const).map((m) => ({ m, ids: topIds({ ...campus, missing: m }, 50) }));
const overlap = (a: Set<number>, b: Set<number>) => [...a].filter((x) => b.has(x)).length;
const clubsKnownInTop50 = Object.fromEntries(
  strategies.map(({ m, ids }) => [m, [...ids].filter((id) => byId.get(id)!.values.clubs_count != null).length]),
);
const missingStrategies = {
  preset: 'campus (clubs + reviews, no reviews loaded)',
  top50_overlap_penalize_neutral: overlap(strategies[0]!.ids, strategies[1]!.ids),
  top50_overlap_neutral_renormalize: overlap(strategies[1]!.ids, strategies[2]!.ids),
  top50_overlap_penalize_renormalize: overlap(strategies[0]!.ids, strategies[2]!.ids),
  top50_with_known_club_count: clubsKnownInTop50,
};

const report = {
  snapshotId: snap.snapshotId,
  snapshotHash: snap.contentHash,
  schools: snap.schools.length,
  research: researchStats,
  presets: presetTops,
  usnewsSensitivity: { scenarios: scenarios.map((s) => s.label), rows: sensitivityTable, biggestMoveTop50: biggest },
  missingStrategies,
};

writeFileSync(join(root, 'packages/dataset/data/report.json'), JSON.stringify(report, null, 2) + '\n');

const usd = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`);
const md: string[] = [
  `# Ranking report for snapshot ${snap.snapshotId}`,
  '',
  `Generated by \`pnpm engine:report\` from \`packages/dataset/data/snapshot.json\` (hash ${snap.contentHash.slice(0, 12)}).`,
  '',
  '## Research spending distribution',
  '',
  `| | |`,
  `|---|---|`,
  `| Schools with a value | ${researchStats.schools_with_value} |`,
  `| Not in HERD (under $150K, ranked lowest) | ${researchStats.imputed_zero_not_in_herd} |`,
  `| Covered by a parent campus's figure (unknown) | ${researchStats.reported_with_parent} |`,
  `| Median | ${usd(researchStats.median_usd)} |`,
  `| Mean | ${usd(researchStats.mean_usd)} |`,
  `| Standard deviation | ${usd(researchStats.sd_usd)} |`,
  `| Max | ${usd(researchStats.max_usd)} (${researchStats.max_school}) |`,
  `| Min-max: share of schools below 0.05 | ${(researchStats.minmax_share_below_0_05 * 100).toFixed(1)}% |`,
  `| Min-max: schools above 0.5 | ${researchStats.minmax_schools_above_0_5} |`,
  `| Z-score: Boston University / median school | ${researchStats.z_boston_university} / ${researchStats.z_median_school} |`,
  `| Percentile: Boston University | ${researchStats.percentile_boston_university} |`,
  '',
  '## U.S. News-style preset: rank under one change',
  '',
  `| School | Rank | ${scenarios.map((s) => s.label).join(' | ')} |`,
  `|---|---|${scenarios.map(() => '---').join('|')}|`,
  ...sensitivityTable.map((r) => `| ${r.name} | ${r.rank} | ${scenarios.map((s) => r.scenarios[s.label]).join(' | ')} |`),
  '',
  `The largest rank change in the top 50 was ${biggest.name}, from #${biggest.from} to #${biggest.to} with ${biggest.label}.`,
  '',
  '## Missing-data strategies (Campus life preset, top 50)',
  '',
  `| | |`,
  `|---|---|`,
  `| Overlap penalize / neutral | ${missingStrategies.top50_overlap_penalize_neutral} of 50 |`,
  `| Overlap neutral / renormalize | ${missingStrategies.top50_overlap_neutral_renormalize} of 50 |`,
  `| Overlap penalize / renormalize | ${missingStrategies.top50_overlap_penalize_renormalize} of 50 |`,
  `| Top 50 with a known club count (penalize / neutral / renormalize) | ${clubsKnownInTop50.penalize} / ${clubsKnownInTop50.neutral} / ${clubsKnownInTop50.renormalize} |`,
  '',
  '## Top 10 per preset',
  '',
  ...presetTops.flatMap((p) => [`### ${p.name}`, '', ...p.top.map((t) => `${t.rank}. ${t.name} (${t.score})`), '']),
];
mkdirSync(join(root, 'docs/results'), { recursive: true });
writeFileSync(join(root, 'docs/results/report.md'), md.join('\n'));
console.log(JSON.stringify({ research: researchStats, biggest, missingStrategies }, null, 2));
