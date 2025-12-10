// Native: the snapshot is bundled with the app.
export async function loadSnapshotJson(): Promise<unknown> {
  return require('@college/dataset/data/snapshot.json');
}
