import type { SchoolAggregates } from '@college/ranking-engine';

export type CrowdSource = 'none' | 'demo' | 'live';

export interface CrowdData {
  aggregates: ReadonlyMap<number, SchoolAggregates>;
  source: CrowdSource;
}

const EMPTY: CrowdData = { aggregates: new Map(), source: 'none' };

export function useCrowdAggregates(): CrowdData {
  return EMPTY;
}
