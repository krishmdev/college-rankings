import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, EmptyState, Screen, T } from '@/components/ui';
import { supabase } from '@/crowd/supabase';
import { useMembership, useSession } from '@/crowd/useSession';
import { useRanking } from '@/data/RankingProvider';
import { space } from '@/theme/tokens';

type Queued = { id: number; school_id: number; title: string; body: string; status: string; moderation_reason: string | null };

export default function Moderation() {
  const session = useSession();
  const membership = useMembership(session);
  const qc = useQueryClient();
  const { schoolById } = useRanking();
  const allowed = membership.data?.role === 'moderator' || membership.data?.role === 'admin';
  const queue = useQuery({
    queryKey: ['moderation'],
    enabled: !!supabase && allowed,
    queryFn: async () => {
      const { data, error } = await supabase!.from('reviews').select('id,school_id,title,body,status,moderation_reason').in('status', ['flagged', 'pending']).order('created_at').limit(50);
      if (error) throw error;
      return data as Queued[];
    },
  });
  if (!supabase || !allowed) return <Screen><Stack.Screen options={{ title: 'Moderation' }} /><EmptyState title="Moderators only" /></Screen>;

  const act = async (id: number, action: 'publish' | 'remove') => {
    await supabase!.rpc('moderate_review', { review_id: id, action, reason: action === 'remove' ? 'removed by moderator' : null });
    await qc.invalidateQueries({ queryKey: ['moderation'] });
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Moderation' }} />
      <View style={{ gap: space.md }}>
        {queue.data?.length === 0 ? <EmptyState title="Queue is empty" /> : null}
        {queue.data?.map((r) => (
          <Card key={r.id} style={{ gap: space.sm }}>
            <T bold>{r.title}</T>
            <T variant="micro" tone="muted">{schoolById(r.school_id)?.name} · {r.status}{r.moderation_reason ? ` · ${r.moderation_reason}` : ''}</T>
            <T variant="small" tone="secondary">{r.body}</T>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="Publish" small onPress={() => act(r.id, 'publish')} />
              <Button label="Remove" kind="secondary" small onPress={() => act(r.id, 'remove')} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
