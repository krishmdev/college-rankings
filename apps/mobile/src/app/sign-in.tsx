import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Card, EmptyState, Screen, T } from '@/components/ui';
import { supabase } from '@/crowd/supabase';
import { useMembership, useSession } from '@/crowd/useSession';
import { useRanking } from '@/data/RankingProvider';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

// Email + 6-digit code. Codes instead of magic links avoid deep-link and baseUrl problems.
export default function SignIn() {
  const c = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const membership = useMembership(session);
  const { schoolById } = useRanking();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Sign in' }} />
        <EmptyState
          title="Reviews and sign-in are off in this offline demo"
          body="Rankings work fully offline. Signing in with a school email and writing reviews need the review server, which this build doesn’t connect to."
          action={<Button label="Back to rankings" kind="secondary" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }
  const input = {
    borderWidth: 1,
    borderColor: c.hairline,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: c.ink,
    backgroundColor: c.surfaceRaised,
    fontSize: 16,
  } as const;

  const send = async () => {
    setBusy(true);
    setError(null);
    // Check the domain first so we never send a code that can't work.
    const { data: ok, error: rpcError } = await supabase!.rpc('is_school_email', { email: email.trim() });
    if (rpcError) {
      setBusy(false);
      setError('Couldn’t reach the review server. Check your connection and try again.');
      return;
    }
    if (!ok) {
      setBusy(false);
      setError('That domain isn’t on the list of supported schools. Use your school email.');
      return;
    }
    const { error: e } = await supabase!.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (e) setError(e.message);
    else setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    const { error: e } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (e) return setError(e.message);
    await qc.invalidateQueries({ queryKey: ['membership'] });
    router.back();
  };

  if (session) {
    const school = membership.data?.schoolId ? schoolById(membership.data.schoolId) : undefined;
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Account' }} />
        <Card style={{ gap: space.md, maxWidth: 480 }}>
          <T variant="heading" serif>
            Signed in
          </T>
          <T tone="secondary">{session.user.email}</T>
          <T tone="secondary">
            {membership.data?.status === 'active' && school
              ? `Verified at ${school.name}.`
              : membership.data?.status === 'pending'
                ? 'Your school email isn’t confirmed yet.'
                : 'No active school affiliation.'}
          </T>
          <Button label="Sign out" kind="secondary" onPress={() => supabase!.auth.signOut()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <Card style={{ gap: space.md, maxWidth: 480 }}>
        <T variant="heading" serif>
          Sign in with your school email
        </T>
        <T tone="secondary" variant="small">
          Accounts are school-email only, for good. Your email decides which school you can review.
        </T>
        {step === 'email' ? (
          <View style={{ gap: space.sm }}>
            <TextInput accessibilityLabel="School email" placeholder="you@school.edu" placeholderTextColor={c.inkMuted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={input} />
            <Button label={busy ? 'Sending…' : 'Send code'} disabled={busy || !email.includes('@')} onPress={send} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <T variant="small" tone="secondary">
              We sent a 6-digit code to {email}.
            </T>
            <TextInput accessibilityLabel="6-digit code" placeholder="123456" placeholderTextColor={c.inkMuted} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} style={input} />
            <Button label={busy ? 'Checking…' : 'Verify'} disabled={busy || code.length !== 6} onPress={verify} />
          </View>
        )}
        {error ? <T tone="critical" variant="small">{error}</T> : null}
      </Card>
    </Screen>
  );
}
