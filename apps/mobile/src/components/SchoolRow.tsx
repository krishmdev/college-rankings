import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Contribution } from '@college/ranking-engine';

import { controlLabel } from '@/lib/format';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CoverageBadge } from './Badges';
import { ContributionBar } from './ContributionBar';
import { ContributionChips } from './ContributionChips';
import { ScoreRing } from './ScoreRing';

export interface RowData {
  id: number;
  rank: number;
  name: string;
  place: string;
  control: 'public' | 'private_nonprofit';
  score: number;
  coverage: number;
  top: Contribution[];
  /** All contributions, for the composition bar on wide screens. */
  all?: Contribution[];
}

export const ROW_HEIGHT = 92;

export const SchoolRow = memo(function SchoolRow({ row, compact }: { row: RowData; compact: boolean }) {
  const c = useTheme();
  const router = useRouter();
  return (
    <Pressable
        onPress={() => router.push({ pathname: '/school/[id]', params: { id: String(row.id) } })}
        testID={`school-row-${row.id}`}
        accessibilityRole="link"
        accessibilityLabel={`Rank ${row.rank}, ${row.name}, score ${row.score.toFixed(1)}`}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
          height: ROW_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: compact ? space.sm : space.md,
          paddingHorizontal: compact ? space.sm : space.lg,
          backgroundColor: pressed || hovered ? c.sunken : c.surface,
          borderBottomWidth: 1,
          borderBottomColor: c.hairline,
        })}>
        <Text
          style={{
            width: compact ? 36 : 48,
            textAlign: 'right',
            fontSize: compact ? 18 : 22,
            color: row.rank <= 10 ? c.ink : c.inkSecondary,
            fontFamily: 'Fraunces_600SemiBold',
            fontVariant: ['tabular-nums'],
          }}>
          {row.rank}
        </Text>
        <ScoreRing score={row.score} size={compact ? 40 : 46} />
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, fontSize: compact ? 15 : 16, color: c.ink, fontFamily: 'Fraunces_600SemiBold' }}>
              {row.name}
            </Text>
            <CoverageBadge coverage={row.coverage} />
          </View>
          <Text numberOfLines={1} style={{ fontSize: 12, color: c.inkMuted }}>
            {row.place} · {controlLabel(row.control)}
          </Text>
          <ContributionChips items={compact ? row.top.slice(0, 2) : row.top} />
        </View>
        {row.all ? (
          <View style={{ width: 300 }}>
            <ContributionBar
              items={row.all}
              height={12}
              caption={`${row.all.length} metrics · ${Math.round(row.coverage * 100)}% measured · hover for detail`}
            />
          </View>
        ) : null}
      </Pressable>
  );
});
