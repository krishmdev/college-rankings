import Slider from '@react-native-community/slider';

import { MAX_WEIGHT } from '@college/ranking-engine';

import { useTheme } from '@/theme/useTheme';

export interface WeightSliderProps {
  value: number;
  onChange: (v: number) => void;
  label: string;
  color: string;
  testID?: string;
}

export function WeightSlider({ value, onChange, label, color, testID }: WeightSliderProps) {
  const c = useTheme();
  return (
    <Slider
      testID={testID}
      accessibilityLabel={label}
      style={{ flex: 1, height: 32 }}
      minimumValue={0}
      maximumValue={MAX_WEIGHT}
      step={0.5}
      value={value}
      onValueChange={onChange}
      minimumTrackTintColor={color}
      maximumTrackTintColor={c.pctTrack}
      thumbTintColor={color}
    />
  );
}
