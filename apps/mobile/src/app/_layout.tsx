import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { WebStyles } from '@/components/WebStyles';
import { RankingProvider } from '@/data/RankingProvider';
import { useSnapshot } from '@/data/useDataset';
import { space } from '@/theme/tokens';
import { useIsDark, useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function BackToRankings() {
  const c = useTheme();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="link" onPress={() => router.replace('/')} style={{ paddingHorizontal: space.lg }}>
      <Text style={{ color: c.accent, fontWeight: '600' }}>‹ Rankings</Text>
    </Pressable>
  );
}

function DatasetGate() {
  const c = useTheme();
  const snap = useSnapshot();
  if (snap.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: c.page }}>
        <ActivityIndicator color={c.accent} />
        <T tone="secondary">Loading 1,500 schools…</T>
      </View>
    );
  }
  if (snap.isError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, backgroundColor: c.page }}>
        <T variant="heading" serif>
          Couldn’t load the dataset
        </T>
        <T tone="secondary">{String(snap.error.message)}</T>
        <Button label="Try again" onPress={() => snap.refetch()} />
      </View>
    );
  }
  return (
    <RankingProvider snapshot={snap.data}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.ink, fontFamily: 'Fraunces_600SemiBold' },
          contentStyle: { backgroundColor: c.page },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="school/[id]/index"
          options={({ navigation }) => ({
            title: 'School',
            headerLeft: navigation.canGoBack() ? undefined : () => <BackToRankings />,
          })}
        />
      </Stack>
    </RankingProvider>
  );
}

export default function RootLayout() {
  const dark = useIsDark();
  const [client] = useState(() => new QueryClient());
  const [fontsLoaded, fontError] = useFonts({ Fraunces_400Regular_Italic, Fraunces_600SemiBold, Fraunces_700Bold });
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={client}>
        <WebStyles />
        <StatusBar style={dark ? 'light' : 'dark'} />
        <DatasetGate />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
