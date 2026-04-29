import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  isLocalAuthBypassEnabled,
  isSupabaseConfigured,
} from '@/lib/supabase';
import type { Profile } from '@/types';

const BYPASS_USER_ID = '00000000-0000-0000-0000-000000000000';

const bypassProfile: Profile = {
  id: BYPASS_USER_ID,
  role: 'admin',
  name: 'Admin Local (bypass)',
  created_at: new Date().toISOString(),
};

const bypassSession = {
  access_token: 'bypass',
  refresh_token: 'bypass',
  expires_in: 999999,
  token_type: 'bearer',
  user: {
    id: BYPASS_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'admin@pipadriven.local',
    app_metadata: {},
    user_metadata: { name: 'Admin Local (bypass)' },
    created_at: new Date().toISOString(),
  },
} as unknown as Session;

function buildFallbackProfile(user: User): Profile {
  return {
    id: user.id,
    role: 'user',
    name:
      (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
      user.email ||
      'Usuário',
    created_at: user.created_at ?? new Date().toISOString(),
  };
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (isLocalAuthBypassEnabled) {
        setSession(bypassSession);
        setProfile(bypassProfile);
      } else {
        setSession(null);
        setProfile(null);
      }
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: realSession } }) => {
      if (realSession) {
        setSession(realSession);
        fetchProfile(realSession.user);
      } else {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, realSession) => {
      if (realSession) {
        setSession(realSession);
        fetchProfile(realSession.user);
      } else {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(user: User) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.warn('[Althius Driven] Perfil não encontrado; usando fallback seguro.', error.message);
    }

    setProfile(data ?? buildFallbackProfile(user));
    setLoading(false);
  }

  return (
    <AuthContext.Provider value={{ session, profile, role: profile?.role ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
