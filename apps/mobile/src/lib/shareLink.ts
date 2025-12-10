import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type { Profile } from '@college/ranking-engine';
import { encodeProfile } from '@college/ranking-engine';

export function shareUrl(profile: Profile): string {
  const token = encodeProfile(profile);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const base = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '');
    return `${window.location.origin}${base}/?p=${token}`;
  }
  return Linking.createURL('/', { queryParams: { p: token } });
}

/** Accepts a full link or a bare `v1.` token. */
export function tokenFromInput(input: string): string | null {
  const s = input.trim();
  if (s.startsWith('v1.')) return s;
  const m = s.match(/[?&]p=(v1\.[A-Za-z0-9_-]+)/);
  return m ? m[1]! : null;
}
