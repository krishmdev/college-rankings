import { z } from 'zod';

import { isMetricKey } from './registry';
import type { Filters, MetricKey, Profile } from './types';
import { MAX_WEIGHT, METRIC_KEYS } from './types';

/**
 * Shareable profile links: `v1.` + base64url(compact JSON). Only non-zero weights and non-default
 * settings are written, so a typical link is well under 200 characters.
 */
const PREFIX = 'v1.';

const metricKey = z.enum(METRIC_KEYS);
const compactSchema = z
  .object({
    w: z.record(z.string(), z.number().min(0).max(MAX_WEIGHT)),
    d: z.record(z.string(), z.enum(['h', 'l'])).optional(),
    m: z.enum(['p', 'n', 'r']).optional(),
    n: z.literal('f').optional(),
    f: z
      .object({
        st: z.array(z.string().regex(/^[A-Z]{2}$/)).max(60).optional(),
        rg: z.array(z.enum(['northeast', 'midwest', 'south', 'west', 'other'])).optional(),
        c: z.array(z.enum(['public', 'private_nonprofit'])).optional(),
        sz: z.array(z.enum(['small', 'medium', 'large'])).optional(),
        lc: z.array(z.enum(['city', 'suburb', 'town', 'rural'])).optional(),
        np: z.number().min(0).max(200000).optional(),
        nu: z.literal(0).optional(),
        a0: z.number().min(0).max(1).optional(),
        a1: z.number().min(0).max(1).optional(),
        rq: z.array(metricKey).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

type Compact = z.infer<typeof compactSchema>;

const round1 = (x: number) => Math.round(x * 10) / 10;

export function toCompact(p: Profile): Compact {
  const w: Record<string, number> = {};
  for (const key of METRIC_KEYS) {
    const v = p.weights[key];
    if (v !== undefined && v > 0) w[key] = round1(v);
  }
  const out: Compact = { w };
  const d: Record<string, 'h' | 'l'> = {};
  for (const key of METRIC_KEYS) {
    const v = p.directions[key];
    if (v) d[key] = v === 'higher' ? 'h' : 'l';
  }
  if (Object.keys(d).length) out.d = d;
  if (p.missing !== 'penalize') out.m = p.missing === 'neutral' ? 'n' : 'r';
  if (p.normalizeWithin === 'filtered') out.n = 'f';
  const f = p.filters;
  const cf: NonNullable<Compact['f']> = {};
  if (f.states?.length) cf.st = [...f.states].sort();
  if (f.regions?.length) cf.rg = [...f.regions].sort();
  if (f.control?.length) cf.c = [...f.control].sort();
  if (f.sizes?.length) cf.sz = [...f.sizes].sort();
  if (f.locales?.length) cf.lc = [...f.locales].sort();
  if (f.maxNetPrice !== undefined && f.maxNetPrice !== null) {
    cf.np = f.maxNetPrice;
    if (f.includeUnknownNetPrice === false) cf.nu = 0;
  }
  if (f.admitRateMin !== undefined && f.admitRateMin !== null) cf.a0 = f.admitRateMin;
  if (f.admitRateMax !== undefined && f.admitRateMax !== null) cf.a1 = f.admitRateMax;
  if (f.requireData?.length) cf.rq = [...f.requireData].sort();
  if (Object.keys(cf).length) out.f = cf;
  return out;
}

export function fromCompact(c: Compact): Profile {
  const weights: Partial<Record<MetricKey, number>> = {};
  for (const [k, v] of Object.entries(c.w)) {
    if (!isMetricKey(k)) throw new Error(`unknown metric ${k}`);
    weights[k] = v;
  }
  const directions: Partial<Record<MetricKey, 'higher' | 'lower'>> = {};
  for (const [k, v] of Object.entries(c.d ?? {})) {
    if (!isMetricKey(k)) throw new Error(`unknown metric ${k}`);
    directions[k] = v === 'h' ? 'higher' : 'lower';
  }
  const filters: Filters = {};
  const f = c.f ?? {};
  if (f.st) filters.states = f.st;
  if (f.rg) filters.regions = f.rg;
  if (f.c) filters.control = f.c;
  if (f.sz) filters.sizes = f.sz;
  if (f.lc) filters.locales = f.lc;
  if (f.np !== undefined) {
    filters.maxNetPrice = f.np;
    if (f.nu === 0) filters.includeUnknownNetPrice = false;
  }
  if (f.a0 !== undefined) filters.admitRateMin = f.a0;
  if (f.a1 !== undefined) filters.admitRateMax = f.a1;
  if (f.rq) filters.requireData = f.rq;
  return {
    weights,
    directions,
    missing: c.m === 'n' ? 'neutral' : c.m === 'r' ? 'renormalize' : 'penalize',
    normalizeWithin: c.n === 'f' ? 'filtered' : 'all',
    filters,
  };
}

export function encodeProfile(p: Profile): string {
  return PREFIX + base64UrlEncode(JSON.stringify(toCompact(p)));
}

export class ProfileDecodeError extends Error {}

export function decodeProfile(token: string): Profile {
  if (!token.startsWith(PREFIX)) throw new ProfileDecodeError('unsupported profile version');
  let json: unknown;
  try {
    json = JSON.parse(base64UrlDecode(token.slice(PREFIX.length)));
  } catch {
    throw new ProfileDecodeError('profile link is corrupted');
  }
  const parsed = compactSchema.safeParse(json);
  if (!parsed.success) throw new ProfileDecodeError('profile link has invalid fields');
  try {
    return fromCompact(parsed.data);
  } catch (e) {
    throw new ProfileDecodeError((e as Error).message);
  }
}

// The compact JSON is ASCII-only (metric keys, enums, numbers), so a byte-per-char base64 is
// enough and avoids depending on Buffer/btoa, which differ between Node, Hermes and browsers.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64UrlEncode(ascii: string): string {
  let out = '';
  for (let i = 0; i < ascii.length; i += 3) {
    const a = ascii.charCodeAt(i);
    const b = i + 1 < ascii.length ? ascii.charCodeAt(i + 1) : NaN;
    const c = i + 2 < ascii.length ? ascii.charCodeAt(i + 2) : NaN;
    if (a > 127 || b > 127 || c > 127) throw new Error('non-ASCII input');
    const bits = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += ALPHABET[(bits >> 18) & 63]! + ALPHABET[(bits >> 12) & 63]!;
    if (!Number.isNaN(b)) out += ALPHABET[(bits >> 6) & 63]!;
    if (!Number.isNaN(c)) out += ALPHABET[bits & 63]!;
  }
  return out;
}

export function base64UrlDecode(s: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('bad base64url');
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    let bits = 0;
    for (let j = 0; j < 4; j++) bits = (bits << 6) | (j < chunk.length ? ALPHABET.indexOf(chunk[j]!) : 0);
    out += String.fromCharCode((bits >> 16) & 255);
    if (chunk.length > 2) out += String.fromCharCode((bits >> 8) & 255);
    if (chunk.length > 3) out += String.fromCharCode(bits & 255);
  }
  return out;
}
