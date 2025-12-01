import type { ExpoConfig } from 'expo/config';

// WEB_BASE_URL is set to /college-rankings for the GitHub Pages export; local dev serves from /.
const baseUrl = process.env.WEB_BASE_URL ?? '';

const config: ExpoConfig = {
  name: 'College Rankings',
  slug: 'college-rankings',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'collegerank',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#1F3A5F',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
    baseUrl,
  },
};

export default config;
