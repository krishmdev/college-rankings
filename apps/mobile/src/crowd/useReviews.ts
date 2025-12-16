import { useQuery } from '@tanstack/react-query';

import type { CrowdDimension } from '@college/ranking-engine';

import { DEMO_REVIEWS } from './useAggregates';
import { supabase } from './supabase';

export interface ReviewView {
  id: number;
  synthetic: boolean;
  relationship: 'current_student' | 'recent_alum';
  gradYear: number;
  ratings: Record<CrowdDimension, number>;
  title: string;
  body: string;
  createdAt?: string;
}

type Row = {
  id: number;
  relationship: ReviewView['relationship'];
  grad_year: number;
  title: string;
  body: string;
  created_at: string;
} & Record<`rating_${CrowdDimension}`, number>;

async function fetchLive(schoolId: number): Promise<ReviewView[]> {
  const { data, error } = await supabase!
    .from('reviews')
    .select('*')
    .eq('school_id', schoolId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as Row[]).map((r) => ({
    id: r.id,
    synthetic: false,
    relationship: r.relationship,
    gradYear: r.grad_year,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    ratings: {
      overall: r.rating_overall,
      academics: r.rating_academics,
      social: r.rating_social,
      career: r.rating_career,
      housing: r.rating_housing,
      safety: r.rating_safety,
      value: r.rating_value,
    },
  }));
}

export function useReviews(schoolId: number) {
  return useQuery({
    queryKey: ['reviews', schoolId, supabase !== null],
    queryFn: async (): Promise<{ reviews: ReviewView[]; source: 'demo' | 'live' }> => {
      if (supabase) {
        try {
          return { reviews: await fetchLive(schoolId), source: 'live' };
        } catch {
          // Backend configured but unreachable: fall through to the labeled demo data.
        }
      }
      return { reviews: DEMO_REVIEWS.filter((r) => r.schoolId === schoolId), source: 'demo' };
    },
  });
}
