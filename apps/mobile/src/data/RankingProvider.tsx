import { createContext, type ReactNode, useContext, useDeferredValue, useMemo } from 'react';

import type { MetricMeta, Snapshot, SnapshotSchool } from '@college/dataset';
import type { MetricKey, Profile, RankIndex, RankResult, School } from '@college/ranking-engine';
import { buildIndex, crowdMetricValues, rank } from '@college/ranking-engine';

import { type CrowdData, useCrowdAggregates } from '@/crowd/useAggregates';
import { useProfileStore } from '@/state/profileStore';

interface Ranking {
  snapshot: Snapshot;
  index: RankIndex;
  result: RankResult;
  /** The profile the result was computed for (lags the store slightly while sliders move). */
  profile: Profile;
  pending: boolean;
  crowd: CrowdData;
  metaByKey: ReadonlyMap<MetricKey, MetricMeta>;
  /** Share of schools with a value, per metric (0 when a metric has no data at all). */
  coverage: ReadonlyMap<MetricKey, number>;
  schoolById: (id: number) => SnapshotSchool | undefined;
  idxOf: (id: number) => number | undefined;
}

const Ctx = createContext<Ranking | null>(null);

function mergeCrowd(schools: SnapshotSchool[], crowd: CrowdData): School[] {
  if (crowd.aggregates.size === 0) return schools as School[];
  const values = crowdMetricValues(crowd.aggregates);
  return schools.map((s) => {
    const extra = values.get(s.id);
    return extra ? { ...s, values: { ...s.values, ...extra } } : s;
  }) as School[];
}

export function RankingProvider({ snapshot, children }: { snapshot: Snapshot; children: ReactNode }) {
  const crowd = useCrowdAggregates();
  const index = useMemo(() => buildIndex(mergeCrowd(snapshot.schools, crowd)), [snapshot, crowd]);
  const live = useProfileStore((s) => s.profile);
  const profile = useDeferredValue(live);
  const result = useMemo(() => rank(index, profile), [index, profile]);

  const value = useMemo<Ranking>(() => {
    const byId = new Map(snapshot.schools.map((s) => [s.id, s]));
    const metaByKey = new Map(snapshot.metrics.map((m) => [m.key, m]));
    const coverage = new Map(
      index.metrics.map((m, k) => {
        const arr = index.pct[k]!;
        let n = 0;
        for (let i = 0; i < arr.length; i++) if (!Number.isNaN(arr[i]!)) n++;
        return [m.key, arr.length ? n / arr.length : 0];
      }),
    );
    return {
      snapshot,
      index,
      result,
      profile,
      pending: profile !== live,
      crowd,
      metaByKey,
      coverage,
      schoolById: (id) => byId.get(id),
      idxOf: (id) => index.idToIdx.get(id),
    };
  }, [snapshot, index, result, profile, live, crowd]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRanking(): Ranking {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRanking outside RankingProvider');
  return v;
}
