import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/useTheme';

/** Score out of 100 as a thin ring with the number inside. */
export function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const c = useTheme();
  const stroke = size >= 60 ? 5 : 3.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, score / 100));
  return (
    <View
      accessible
      accessibilityLabel={`Score ${score.toFixed(1)} out of 100`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.pctTrack} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * frac} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text
        style={{
          color: c.ink,
          fontWeight: '700',
          fontSize: size >= 60 ? 18 : 12,
          fontVariant: ['tabular-nums'],
        }}>
        {score.toFixed(1)}
      </Text>
    </View>
  );
}
