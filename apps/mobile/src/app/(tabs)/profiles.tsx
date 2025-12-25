import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, Text, TextInput, View } from 'react-native';

import type { Profile } from '@college/ranking-engine';
import { METRIC_BY_KEY, METRICS, PRESETS, rank, rows } from '@college/ranking-engine';

import { Button, Card, Divider, Screen, T } from '@/components/ui';
import { supabase } from '@/crowd/supabase';
import { useMembership, useSession } from '@/crowd/useSession';
import { useRanking } from '@/data/RankingProvider';
import { shareUrl, tokenFromInput } from '@/lib/shareLink';
import { useProfileStore } from '@/state/profileStore';
import { radius, space } from '@/theme/tokens';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

function WeightChips({ profile }: { profile: Profile }) {
  const c = useTheme();
  const weighted = METRICS.filter((m) => (profile.weights[m.key] ?? 0) > 0).sort(
    (a, b) => (profile.weights[b.key] ?? 0) - (profile.weights[a.key] ?? 0),
  );
  if (!weighted.length) return <T tone="muted" variant="small">No weights set.</T>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {weighted.map((m) => (
        <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.sunken }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.group[m.group] }} />
          <Text style={{ fontSize: 12, color: c.inkSecondary }}>{m.short}</Text>
          <Text style={{ fontSize: 12, color: c.ink, fontWeight: '600' }}>{profile.weights[m.key]}</Text>
        </View>
      ))}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const c = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.inkMuted}
      {...props}
      style={{
        flex: 1,
        minWidth: 180,
        borderWidth: 1,
        borderColor: c.hairline,
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        color: c.ink,
        backgroundColor: c.surfaceRaised,
        fontSize: 14,
      }}
    />
  );
}

export default function ProfilesScreen() {
  const c = useTheme();
  const router = useRouter();
  const { wide } = useLayout();
  const { index } = useRanking();
  const profile = useProfileStore((s) => s.profile);
  const saved = useProfileStore((s) => s.saved);
  const saveCurrent = useProfileStore((s) => s.saveCurrent);
  const removeSaved = useProfileStore((s) => s.removeSaved);
  const applyPreset = useProfileStore((s) => s.applyPreset);
  const applyShared = useProfileStore((s) => s.applyShared);
  const notice = useProfileStore((s) => s.notice);
  const [name, setName] = useState('');
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const url = shareUrl(profile);
  const session = useSession();
  const membership = useMembership(session);

  const presetTops = useMemo(
    () => Object.fromEntries(PRESETS.map((p) => [p.id, rows(rank(index, { ...p.profile, filters: {} }), 0, 3)])),
    [index],
  );

  const copy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(key);
  };

  return (
    <Screen>
      <View style={{ gap: space.lg }}>
        <T variant="title" serif>
          Profiles
        </T>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg, alignItems: 'flex-start' }}>
          <View style={{ flex: wide ? 1 : undefined, gap: space.lg, width: '100%' }}>
            <Card style={{ gap: space.md }}>
              <T variant="heading" serif>
                Your current weights
              </T>
              <WeightChips profile={profile} />
              <Divider />
              <T variant="label" tone="secondary">
                Share link
              </T>
              <Text selectable testID="share-url" style={{ fontSize: 12, color: c.inkSecondary, fontFamily: 'monospace' }} numberOfLines={1} ellipsizeMode="middle">
                {url ?? 'This profile can’t be shared: one of its filters is out of range.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <Button testID="copy-link" label={copied === 'current' ? 'Copied' : 'Copy link'} small disabled={!url} onPress={() => url && copy(url, 'current')} />
                <Button label="Share…" kind="secondary" small disabled={!url} onPress={() => url && Share.share({ message: url }).catch(() => {})} />
              </View>
              <Divider />
              <T variant="label" tone="secondary">
                Save on this device
              </T>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                <Input testID="profile-name" accessibilityLabel="Profile name" placeholder="Name, e.g. Cheap + research" value={name} onChangeText={setName} />
                <Button
                  testID="save-profile"
                  label="Save"
                  small
                  onPress={() => {
                    saveCurrent(name);
                    setName('');
                  }}
                />
              </View>
            </Card>

            <Card style={{ gap: space.md }}>
              <T variant="heading" serif>
                Saved profiles
              </T>
              {saved.length === 0 ? (
                <T tone="muted" variant="small">
                  Nothing saved yet. Saved profiles stay in this browser or on this phone.
                </T>
              ) : (
                saved.map((p) => (
                  <View key={p.id} style={{ gap: space.xs }} testID={`saved-${p.name}`}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink }}>{p.name}</Text>
                    <T tone="muted" variant="micro">
                      Saved {new Date(p.savedAt).toLocaleDateString()}
                    </T>
                    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                      <Button
                        label="Use"
                        small
                        onPress={() => {
                          applyShared(p.token);
                          router.navigate('/');
                        }}
                      />
                      <Button label={copied === p.id ? 'Copied' : 'Copy link'} kind="secondary" small onPress={() => copy((url ?? shareUrl({ weights: {}, directions: {}, missing: 'penalize', normalizeWithin: 'all', filters: {} })!).replace(/\?p=.*$/, `?p=${p.token}`), p.id)} />
                      <Button label="Delete" kind="ghost" small onPress={() => removeSaved(p.id)} />
                    </View>
                  </View>
                ))
              )}
              <Divider />
              <T variant="label" tone="secondary">
                Open a shared link
              </T>
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                <Input testID="import-input" accessibilityLabel="Paste a profile link" placeholder="Paste a link or v1. code" value={importText} onChangeText={setImportText} />
                <Button
                  testID="import-button"
                  label="Load"
                  small
                  disabled={!importText.trim()}
                  onPress={() => {
                    const token = tokenFromInput(importText);
                    applyShared(token ?? importText.trim());
                    if (token) {
                      setImportText('');
                      router.navigate('/');
                    }
                  }}
                />
              </View>
              {notice && !notice.startsWith('Loaded') ? (
                <T tone="critical" variant="small">
                  {notice}
                </T>
              ) : null}
            </Card>
          </View>

          <View style={{ flex: wide ? 1 : undefined, gap: space.md, width: '100%' }}>
            <Card style={{ gap: space.sm }}>
              <T variant="heading" serif>
                Account
              </T>
              {supabase ? (
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                  <T tone="secondary" variant="small" style={{ flex: 1 }}>
                    {session ? session.user.email : 'Sign in with a school email to write reviews.'}
                  </T>
                  <Button label={session ? 'Account' : 'Sign in'} small kind="secondary" onPress={() => router.push('/sign-in')} />
                  {membership.data?.role === 'moderator' || membership.data?.role === 'admin' ? (
                    <Button label="Moderation" small kind="ghost" onPress={() => router.push('/moderation')} />
                  ) : null}
                </View>
              ) : (
                <T tone="muted" variant="small">
                  Offline build: no backend, so reviews shown are synthetic demo data and sign-in is off.
                </T>
              )}
            </Card>
            <T variant="heading" serif>
              Presets
            </T>
            {PRESETS.map((p) => (
              <Card key={p.id} style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: c.ink }}>{p.name}</Text>
                    <T tone="secondary" variant="small">
                      {p.description}
                    </T>
                  </View>
                  <Button
                    testID={`use-preset-${p.id}`}
                    label="Use"
                    small
                    onPress={() => {
                      applyPreset(p.id);
                      router.navigate('/');
                    }}
                  />
                </View>
                <WeightChips profile={p.profile} />
                <T tone="muted" variant="micro">
                  Top 3 nationally: {presetTops[p.id]!.map((r) => r.school.name).join(' · ')}
                </T>
              </Card>
            ))}
            <T tone="muted" variant="micro">
              {`Weights are relative: doubling every weight changes nothing. ${METRIC_BY_KEY.sat_avg.short} and admit rate are directional preferences you choose.`}
            </T>
          </View>
        </View>
      </View>
    </Screen>
  );
}
