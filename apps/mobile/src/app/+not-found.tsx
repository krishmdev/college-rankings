import { Link, Stack } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState title="This page doesn’t exist" action={<Link href="/">Back to the ranking</Link>} />
    </Screen>
  );
}
