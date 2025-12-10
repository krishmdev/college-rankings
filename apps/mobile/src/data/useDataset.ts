import { useQuery } from '@tanstack/react-query';

import type { Snapshot } from '@college/dataset';
import { parseSnapshot } from '@college/dataset';

import { loadSnapshotJson } from './loadSnapshot';

export function useSnapshot() {
  return useQuery<Snapshot>({
    queryKey: ['snapshot'],
    queryFn: async () => parseSnapshot(await loadSnapshotJson()),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
