import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { CrowdDimension, SchoolAggregates } from '@college/ranking-engine';
import { CROWD_DIMENSIONS } from '@college/ranking-engine';

import demo from './demoReviews.json';
import { supabase } from './supabase';

/** demo: no backend configured, synthetic reviews. live: backend data. unavailable: backend configured but unreachable. */
export type CrowdSource = 'demo' | 'live' | 'unavailable';

export interface CrowdData {
  aggregates: ReadonlyMap<number, SchoolAggregates>;
  source: CrowdSource;
}

export interface DemoReview {
  id: number;
  schoolId: number;
  synthetic: true;
  relationship: 'current_student' | 'recent_alum';
  gradYear: number;
  ratings: Record<CrowdDimension, number>;
  title: string;
  body: string;
}

export const DEMO_REVIEWS = (demo as { reviews: DemoReview[] }).reviews;

function demoAggregates(): Map<number, SchoolAggregates> {
  const sums = new Map<number, { n: number; sum: Record<CrowdDimension, number> }>();
  for (const r of DEMO_REVIEWS) {
    const cur = sums.get(r.schoolId) ?? { n: 0, sum: Object.fromEntries(CROWD_DIMENSIONS.map((d) => [d, 0])) as Record<CrowdDimension, number> };
    cur.n++;
    for (const d of CROWD_DIMENSIONS) cur.sum[d] += r.ratings[d];
    sums.set(r.schoolId, cur);
  }
  const out = new Map<number, SchoolAggregates>();
  for (const [id, { n, sum }] of sums) {
    out.set(id, Object.fromEntries(CROWD_DIMENSIONS.map((d) => [d, { n, avg: sum[d] / n }])) as SchoolAggregates);
  }
  return out;
}

type AggregateRow = { school_id: number; n: number } & Record<CrowdDimension, number>;

async function liveAggregates(): Promise<Map<number, SchoolAggregates>> {
  const { data, error } = await supabase!.from('school_rating_aggregates').select('*');
  if (error) throw error;
  const out = new Map<number, SchoolAggregates>();
  for (const row of data as AggregateRow[]) {
    out.set(row.school_id, Object.fromEntries(CROWD_DIMENSIONS.map((d) => [d, { n: row.n, avg: row[d] }])) as SchoolAggregates);
  }
  return out;
}

const DEMO: CrowdData = { aggregates: demoAggregates(), source: 'demo' };
const EMPTY: CrowdData = { aggregates: new Map(), source: 'unavailable' };

/**
 * Synthetic demo aggregates when no backend is configured. With a backend, only live data: if it
 * can't be reached the crowd metrics are empty (and the UI says so) rather than silently fake.
 */
export function useCrowdAggregates(): CrowdData {
  const live = useQuery({
    queryKey: ['aggregates'],
    queryFn: liveAggregates,
    enabled: supabase !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return useMemo<CrowdData>(() => {
    if (!supabase) return DEMO;
    if (live.data) return { aggregates: live.data, source: 'live' };
    return EMPTY;
  }, [live.data]);
}
