import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { CROWD_DIMENSIONS, MIN_REVIEWS } from '@college/ranking-engine';

import { useCrowdAggregates } from '@/crowd/useAggregates';
import { useReviews } from '@/crowd/useReviews';
import { useMembership, useSession } from '@/crowd/useSession';
import { supabase } from '@/crowd/supabase';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Button, Card, T } from './ui';

const DIM_LABEL: Record<string, string> = {
  overall: 'Overall',
  academics: 'Academics',
  social: 'Social life',
  career: 'Career support',
  housing: 'Housing',
  safety: 'Safety',
  value: 'Value',
};

function Stars({ value }: { value: number }) {
  const c = useTheme();
  const halves = Math.round(value * 2);
  const full = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  return (
    <Text accessibilityLabel={`${(halves / 2).toFixed(1)} out of 5`} style={{ color: c.accent, fontSize: 13, letterSpacing: 1 }}>
      {'●'.repeat(full)}
      {half ? '◐' : ''}
      <Text style={{ color: c.pctTrack }}>{'●'.repeat(5 - full - (half ? 1 : 0))}</Text>
    </Text>
  );
}

export function SyntheticBadge() {
  const c = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: c.warn }}>
      <Text style={{ fontSize: 11, color: c.warn, fontWeight: '600' }}>Synthetic demo data</Text>
    </View>
  );
}

export function Reviews({ schoolId, schoolName }: { schoolId: number; schoolName: string }) {
  const c = useTheme();
  const router = useRouter();
  const { data, isPending, isError } = useReviews(schoolId);
  const crowd = useCrowdAggregates();
  const session = useSession();
  const membership = useMembership(session);
  const agg = crowd.aggregates.get(schoolId);
  const synthetic = data?.source === 'demo';
  const canWrite = !!supabase && membership.data?.status === 'active' && membership.data.schoolId === schoolId;

  return (
    <Card style={{ gap: space.md }} testID="reviews-card">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <T variant="heading" serif style={{ flex: 1 }}>
          Student reviews
        </T>
        {synthetic ? <SyntheticBadge /> : null}
      </View>
      {synthetic ? (
        <T variant="small" tone="secondary">
          No backend is connected, so these are generated examples, not real students. With Supabase configured, only
          people who verify a {schoolName} email can review it.
        </T>
      ) : null}

      {agg && agg.overall ? (
        <View style={{ gap: 6 }}>
          <T variant="small" tone="muted">
            {agg.overall.n} review{agg.overall.n === 1 ? '' : 's'}.{' '}
            {agg.overall.n < MIN_REVIEWS
              ? `Ratings start counting in the ranking once a school has ${MIN_REVIEWS} reviews.`
              : 'These are plain averages. In the ranking, schools with few reviews are pulled toward the national average so one or two ratings can’t dominate.'}
          </T>
          {CROWD_DIMENSIONS.map((d) => {
            const a = agg[d];
            if (!a) return null;
            return (
              <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Text style={{ width: 110, color: c.inkSecondary, fontSize: 13 }}>{DIM_LABEL[d]}</Text>
                <Stars value={a.avg} />
                <T variant="small" num tone="secondary">
                  {a.avg.toFixed(1)}
                </T>
              </View>
            );
          })}

        </View>
      ) : null}

      {isPending ? <T tone="muted">Loading reviews…</T> : null}
      {isError ? <T tone="critical">Couldn’t load reviews.</T> : null}
      {data && data.reviews.length === 0 ? <T tone="muted">No reviews yet.</T> : null}
      {data?.reviews.slice(0, 6).map((r) => (
        <View key={r.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: c.hairline, paddingTop: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Stars value={r.ratings.overall} />
            <Text style={{ color: c.ink, fontWeight: '600', fontSize: 14, flex: 1 }}>{r.title}</Text>
          </View>
          <T variant="small" tone="secondary">
            {r.body}
          </T>
          <T variant="micro" tone="muted">
            {r.relationship === 'current_student' ? 'Current student' : 'Recent alum'}, class of {r.gradYear}
            {r.synthetic ? ' · synthetic' : ''}
          </T>
        </View>
      ))}

      {supabase ? (
        canWrite ? (
          <Button testID="write-review" label="Write a review" onPress={() => router.push({ pathname: '/school/[id]/review', params: { id: String(schoolId) } })} />
        ) : session ? (
          <T variant="small" tone="muted">
            {membership.data?.status === 'pending'
              ? 'Confirm your school email to review.'
              : `Only verified ${schoolName} students can review it.`}
          </T>
        ) : (
          <Button label="Sign in with your school email to review" kind="secondary" onPress={() => router.push('/sign-in')} />
        )
      ) : null}
    </Card>
  );
}
