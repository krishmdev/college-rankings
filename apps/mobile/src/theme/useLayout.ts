import { useWindowDimensions } from 'react-native';

import { WIDE_BREAKPOINT } from './tokens';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return { width, height, wide: width >= WIDE_BREAKPOINT, compact: width < 420 };
}
