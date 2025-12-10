import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Filters, MetricKey, MissingStrategy, Profile } from '@college/ranking-engine';
import { decodeProfile, DEFAULT_PRESET_ID, encodeProfile, MAX_WEIGHT, presetById } from '@college/ranking-engine';

import { persistStorage } from './storage';

export interface SavedProfile {
  id: string;
  name: string;
  token: string;
  savedAt: string;
}

interface ProfileState {
  profile: Profile;
  /** Preset the profile came from, or null once the user edits it. */
  presetId: string | null;
  saved: SavedProfile[];
  setWeight: (key: MetricKey, w: number) => void;
  setDirection: (key: MetricKey, d: 'higher' | 'lower') => void;
  setMissing: (m: MissingStrategy) => void;
  setNormalizeWithin: (n: Profile['normalizeWithin']) => void;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  applyPreset: (id: string) => void;
  applyProfile: (p: Profile, presetId?: string | null) => void;
  resetWeights: () => void;
  saveCurrent: (name: string) => SavedProfile;
  removeSaved: (id: string) => void;
  /** Message shown after opening a shared link. Not persisted. */
  notice: string | null;
  applyShared: (token: string) => void;
  clearNotice: () => void;
}

const clone = (p: Profile): Profile => JSON.parse(JSON.stringify(p));
const initial = clone(presetById(DEFAULT_PRESET_ID)!.profile);

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: initial,
      presetId: DEFAULT_PRESET_ID,
      saved: [],
      setWeight: (key, w) =>
        set((s) => ({
          presetId: null,
          profile: {
            ...s.profile,
            weights: { ...s.profile.weights, [key]: Math.max(0, Math.min(MAX_WEIGHT, w)) },
          },
        })),
      setDirection: (key, d) =>
        set((s) => ({ presetId: null, profile: { ...s.profile, directions: { ...s.profile.directions, [key]: d } } })),
      setMissing: (m) => set((s) => ({ profile: { ...s.profile, missing: m } })),
      setNormalizeWithin: (n) => set((s) => ({ profile: { ...s.profile, normalizeWithin: n } })),
      setFilters: (patch) => set((s) => ({ profile: { ...s.profile, filters: { ...s.profile.filters, ...patch } } })),
      clearFilters: () => set((s) => ({ profile: { ...s.profile, filters: {} } })),
      applyPreset: (id) => {
        const preset = presetById(id);
        if (!preset) return;
        // Presets change what you weigh, not which schools you're looking at.
        set((s) => ({ presetId: id, profile: { ...clone(preset.profile), filters: s.profile.filters } }));
      },
      applyProfile: (p, presetId = null) => set({ profile: clone(p), presetId }),
      resetWeights: () => set((s) => ({ presetId: null, profile: { ...s.profile, weights: {} } })),
      saveCurrent: (name) => {
        const entry: SavedProfile = {
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          name: name.trim() || 'My profile',
          token: encodeProfile(get().profile),
          savedAt: new Date().toISOString(),
        };
        set((s) => ({ saved: [entry, ...s.saved].slice(0, 30) }));
        return entry;
      },
      removeSaved: (id) => set((s) => ({ saved: s.saved.filter((x) => x.id !== id) })),
      notice: null,
      applyShared: (token) => {
        try {
          set({ profile: decodeProfile(token), presetId: null, notice: 'Loaded a shared profile. Your previous weights were replaced.' });
        } catch (e) {
          set({ notice: `That profile link didn’t work: ${(e as Error).message}.` });
        }
      },
      clearNotice: () => set({ notice: null }),
    }),
    {
      name: 'college-rankings/profile/v1',
      storage: persistStorage,
      version: 1,
      partialize: (s) => ({ profile: s.profile, presetId: s.presetId, saved: s.saved }),
    },
  ),
);
