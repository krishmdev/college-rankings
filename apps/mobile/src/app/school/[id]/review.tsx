import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { CrowdDimension } from '@college/ranking-engine';
import { CROWD_DIMENSIONS } from '@college/ranking-engine';

import { Button, Card, EmptyState, Screen, Segmented, T } from '@/components/ui';
import { supabase } from '@/crowd/supabase';
import { useRanking } from '@/data/RankingProvider';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function RatingInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={{ width: 110, color: c.inkSecondary, fontSize: 14 }}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} of 5`}
            accessibilityState={{ checked: value === n }}
            onPress={() => onChange(n)}
            style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: n <= value ? c.accent : c.sunken }}>
            <Text style={{ color: n <= value ? c.accentInk : c.inkSecondary, fontWeight: '700' }}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const LABELS: Record<CrowdDimension, string> = {
  overall: 'Overall', academics: 'Academics', social: 'Social life', career: 'Career', housing: 'Housing', safety: 'Safety', value: 'Value',
};

export default function WriteReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { schoolById } = useRanking();
  const school = schoolById(Number(id));
  const [ratings, setRatings] = useState<Record<CrowdDimension, number>>(
    Object.fromEntries(CROWD_DIMENSIONS.map((d) => [d, 0])) as Record<CrowdDimension, number>,
  );
  const [relationship, setRelationship] = useState<'current_student' | 'recent_alum'>('current_student');
  const [gradYear, setGradYear] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabase || !school) return <Screen><EmptyState title="Reviews need the backend" /></Screen>;
  const complete = CROWD_DIMENSIONS.every((d) => ratings[d] > 0) && title.trim().length >= 3 && body.trim().length >= 50 && /^20\d\d$/.test(gradYear);
  const input = { borderWidth: 1, borderColor: c.hairline, borderRadius: radius.md, padding: space.md, color: c.ink, backgroundColor: c.surfaceRaised, fontSize: 15 } as const;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase!
      .from('reviews')
      .insert({
        school_id: school.id,
        relationship,
        grad_year: Number(gradYear),
        ...Object.fromEntries(CROWD_DIMENSIONS.map((d) => [`rating_${d}`, ratings[d]])),
        title: title.trim(),
        body: body.trim(),
      })
      .select('status,moderation_reason')
      .single();
    setBusy(false);
    if (e) return setError(e.code === '42501' ? 'Only verified students of this school can review it.' : e.message);
    await qc.invalidateQueries({ queryKey: ['reviews', school.id] });
    await qc.invalidateQueries({ queryKey: ['aggregates'] });
    if (data.status === 'flagged') setError(`Saved, but held for a moderator: ${data.moderation_reason}.`);
    else router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `Review ${school.name}` }} />
      <Card style={{ gap: space.md, maxWidth: 640 }}>
        <T variant="heading" serif>{school.name}</T>
        <Segmented label="Relationship" options={[{ key: 'current_student', label: 'Current student' }, { key: 'recent_alum', label: 'Recent alum' }]} value={relationship} onChange={setRelationship} />
        <TextInput accessibilityLabel="Graduation year" placeholder="Class year, e.g. 2027" placeholderTextColor={c.inkMuted} keyboardType="number-pad" maxLength={4} value={gradYear} onChangeText={setGradYear} style={input} />
        {CROWD_DIMENSIONS.map((d) => (
          <RatingInput key={d} label={LABELS[d]} value={ratings[d]} onChange={(v) => setRatings((r) => ({ ...r, [d]: v }))} />
        ))}
        <TextInput accessibilityLabel="Title" placeholder="Title" placeholderTextColor={c.inkMuted} maxLength={120} value={title} onChangeText={setTitle} style={input} />
        <TextInput accessibilityLabel="Review" placeholder="What should someone deciding on this school know? (50+ characters)" placeholderTextColor={c.inkMuted} multiline maxLength={5000} value={body} onChangeText={setBody} style={[input, { minHeight: 140, textAlignVertical: 'top' }]} />
        <T variant="micro" tone="muted">Links, emails and phone numbers send a review to moderation. Five reviews per day at most.</T>
        <Button label={busy ? 'Posting…' : 'Post review'} disabled={!complete || busy} onPress={submit} />
        {error ? <T tone="critical" variant="small">{error}</T> : null}
      </Card>
    </Screen>
  );
}
