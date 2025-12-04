import { z } from 'zod';

import { METRIC_FLAGS, METRIC_KEYS } from '@college/ranking-engine';

const metricKey = z.enum(METRIC_KEYS);

export const MetricFlagSchema = z.enum(METRIC_FLAGS);

export const SchoolSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  city: z.string(),
  state: z.string().regex(/^[A-Z]{2}$/),
  control: z.enum(['public', 'private_nonprofit']),
  locale: z.enum(['city', 'suburb', 'town', 'rural']).nullable(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lon: z.number().min(-180).max(180).nullable().optional(),
  domain: z.string().nullable(),
  ugSize: z.number().int().nonnegative(),
  values: z.partialRecord(metricKey, z.number().nullable()),
  flags: z.partialRecord(metricKey, MetricFlagSchema).optional(),
  reportedWith: z.partialRecord(metricKey, z.number().int().positive()).optional(),
});

export const MetricMetaSchema = z.object({
  key: metricKey,
  source: z.string(),
  fields: z.string(),
  vintage: z.string(),
  note: z.string(),
  coverage: z.number().min(0).max(1),
});

export const SourceSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  publisher: z.string(),
  license: z.string(),
  homepage: z.string(),
  url: z.string().optional(),
  file: z.string().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  retrieved: z.string().optional(),
});

export const SnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  snapshotId: z.string(),
  generatedAt: z.string(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  universe: z.object({ rule: z.string(), count: z.number().int() }),
  sources: z.array(SourceSchema),
  metrics: z.array(MetricMetaSchema),
  schools: z.array(SchoolSchema),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
export type SnapshotSchool = z.infer<typeof SchoolSchema>;
export type MetricMeta = z.infer<typeof MetricMetaSchema>;
export type SnapshotSource = z.infer<typeof SourceSchema>;

export function parseSnapshot(json: unknown): Snapshot {
  return SnapshotSchema.parse(json);
}
