// Metro picks loadSnapshot.native.ts or loadSnapshot.web.ts; this file only gives TypeScript a
// module to resolve. It is never bundled.
export async function loadSnapshotJson(): Promise<unknown> {
  throw new Error('no snapshot loader for this platform');
}
