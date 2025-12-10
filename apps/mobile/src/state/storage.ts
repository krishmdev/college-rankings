import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// AsyncStorage maps to localStorage on web. During static rendering there is no window, so
// zustand's persist just skips hydration there.
export const persistStorage = createJSONStorage(() => AsyncStorage);
