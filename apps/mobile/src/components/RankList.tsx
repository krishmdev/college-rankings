import { useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { contributions } from '@college/ranking-engine';

import { useRanking } from '@/data/RankingProvider';
import { useLayout } from '@/theme/useLayout';
import { useTheme } from '@/theme/useTheme';

import { ROW_HEIGHT, type RowData, SchoolRow } from './SchoolRow';
import { EmptyState } from './ui';

function matches(q: string, name: string, aliases?: string[]) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return name.toLowerCase().includes(needle) || !!aliases?.some((a) => a.toLowerCase().includes(needle));
}

export function RankList({ query, header }: { query: string; header?: React.ReactElement }) {
  const c = useTheme();
  const { compact, wide, width } = useLayout();
  const showBar = width >= 1200;
  const { result, index } = useRanking();

  // Positions are cheap; contributions are computed lazily per rendered row.
  const order = useMemo(() => {
    const out: number[] = [];
    for (let r = 0; r < result.order.length; r++) {
      const i = result.order[r]!;
      const s = index.schools[i]!;
      if (matches(query, s.name, s.aliases)) out.push(i);
    }
    return out;
  }, [result, index, query]);

  const renderItem = ({ item }: { item: number }) => {
    const s = index.schools[item]!;
    const all = contributions(result, item).sort((a, b) => b.points - a.points);
    const row: RowData = {
      id: s.id,
      rank: result.rankOf[item]!,
      name: s.name,
      place: `${s.city}, ${s.state}`,
      control: s.control,
      score: result.score[item]!,
      coverage: result.coverage[item]!,
      top: all.slice(0, 3).filter((x) => x.points > 0),
      all: showBar ? all : undefined,
    };
    return <SchoolRow row={row} compact={compact} />;
  };

  return (
    <FlatList
      testID="rank-list"
      data={order}
      keyExtractor={(i) => String(index.schools[i]!.id)}
      renderItem={renderItem}
      getItemLayout={(_, i) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * i, index: i })}
      initialNumToRender={14}
      windowSize={7}
      maxToRenderPerBatch={20}
      extraData={result}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={{ padding: 16 }}>
          <EmptyState
            title="No schools match"
            body={query ? `Nothing matches “${query}” with these filters.` : 'Loosen a filter to see schools again.'}
          />
        </View>
      }
      style={{ flex: 1, backgroundColor: wide ? c.surface : c.page }}
    />
  );
}
