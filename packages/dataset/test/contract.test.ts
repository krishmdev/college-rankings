import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildIndex, METRIC_BY_KEY, rank, rows } from '@college/ranking-engine';

import { parseSnapshot } from '../src';

const dataDir = join(__dirname, '..', 'data');
const raw = JSON.parse(readFileSync(join(dataDir, 'snapshot.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'));

describe('committed snapshot', () => {
  const snap = parseSnapshot(raw);

  it('matches the schema and its manifest', () => {
    expect(snap.universe.count).toBe(snap.schools.length);
    expect(manifest.contentHash).toBe(snap.contentHash);
    expect(manifest.snapshotId).toBe(snap.snapshotId);
  });

  it('has unique ids in ascending order', () => {
    const ids = snap.schools.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it('only uses metrics the engine knows, each with a source', () => {
    const sourceIds = new Set(snap.sources.map((s) => s.id));
    for (const m of snap.metrics) {
      expect(METRIC_BY_KEY[m.key]).toBeDefined();
      expect(sourceIds.has(m.source)).toBe(true);
    }
    const listed = new Set(snap.metrics.map((m) => m.key));
    for (const s of snap.schools) for (const k of Object.keys(s.values)) expect(listed.has(k as never)).toBe(true);
  });

  it('reports coverage that matches the data', () => {
    for (const m of snap.metrics) {
      const n = snap.schools.filter((s) => s.values[m.key] !== null && s.values[m.key] !== undefined).length;
      expect(m.coverage).toBeCloseTo(n / snap.schools.length, 3);
    }
  });

  it('keeps the HERD crosswalk fixes (JHU and Ohio State are not $0)', () => {
    const byId = new Map(snap.schools.map((s) => [s.id, s]));
    expect(byId.get(162928)!.values.research_total).toBeGreaterThan(4e9);
    expect(byId.get(204796)!.values.research_total).toBeGreaterThan(1.5e9);
    expect(byId.get(162928)!.flags?.research_total).toBe('system_level');
  });

  it('ranks end to end', () => {
    const r = rank(buildIndex(snap.schools), {
      weights: { research_total: 1 },
      directions: {},
      missing: 'penalize',
      normalizeWithin: 'all',
      filters: {},
    });
    expect(rows(r, 0, 1)[0]!.school.name).toBe('Johns Hopkins University');
  });
});
