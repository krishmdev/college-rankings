import Constants from 'expo-constants';

import manifest from '@college/dataset/data/manifest.json';

function baseUrl(): string {
  const fromEnv = process.env.EXPO_BASE_URL;
  const fromConfig = Constants.expoConfig?.experiments?.baseUrl;
  return (fromEnv ?? fromConfig ?? '').replace(/\/$/, '');
}

// Web fetches the JSON from /data (copied there by scripts/copy-snapshot.mjs) so it isn't
// inlined into the JS bundle. The content hash busts caches and catches a stale copy.
export async function loadSnapshotJson(): Promise<unknown> {
  const res = await fetch(`${baseUrl()}/data/snapshot.json?v=${manifest.contentHash.slice(0, 16)}`);
  if (!res.ok) throw new Error(`snapshot request failed (${res.status})`);
  const json = (await res.json()) as { contentHash?: string };
  if (json.contentHash !== manifest.contentHash) {
    throw new Error('the served snapshot does not match this build; run `pnpm web` again to recopy it');
  }
  return json;
}
