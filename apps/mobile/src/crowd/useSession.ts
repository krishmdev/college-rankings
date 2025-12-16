import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from './supabase';

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export interface Membership {
  schoolId: number | null;
  status: 'pending' | 'active' | 'revoked' | null;
  role: 'student' | 'moderator' | 'admin';
}

/** The signed-in user's server-owned affiliation and role (read-only for the client). */
export function useMembership(session: Session | null) {
  return useQuery({
    queryKey: ['membership', session?.user.id],
    enabled: !!supabase && !!session,
    queryFn: async (): Promise<Membership> => {
      const [aff, prof] = await Promise.all([
        supabase!.from('school_affiliations').select('school_id,status').in('status', ['pending', 'active']).maybeSingle(),
        supabase!.from('profiles').select('role').maybeSingle(),
      ]);
      return {
        schoolId: aff.data?.school_id ?? null,
        status: (aff.data?.status as Membership['status']) ?? null,
        role: (prof.data?.role as Membership['role']) ?? 'student',
      };
    },
  });
}
