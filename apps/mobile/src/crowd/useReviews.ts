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
  // public_reviews has no author ids and only published rows.
  const { data, error } = await supabase!
    .from('public_reviews')
    .select('id,relationship,grad_year,title,body,created_at,rating_overall,rating_academics,rating_social,rating_career,rating_housing,rating_safety,rating_value')
    .eq('school_id', schoolId)
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
      if (supabase) return { reviews: await fetchLive(schoolId), source: 'live' };
      return { reviews: DEMO_REVIEWS.filter((r) => r.schoolId === schoolId), source: 'demo' };
    },
  });
}
