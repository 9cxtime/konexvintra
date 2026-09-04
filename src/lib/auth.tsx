import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Profile {
  full_name: string;
  company: string;
  email_connected: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('full_name, company, email_connected').eq('id', userId).maybeSingle();
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => {
          await loadProfile(newSession.user.id);
          setLoading(false);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Configuration manquante' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? 'Email ou mot de passe incorrect.' : null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!supabase) return { error: 'Configuration manquante' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error ? 'Cet email est déjà utilisé ou invalide.' : null };
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!supabase || !session?.user) return { error: 'Non connecté' };
    const { error } = await supabase.from('profiles').update(updates).eq('id', session.user.id);
    if (!error) await refreshProfile();
    return { error: error ? 'Erreur lors de la mise à jour.' : null };
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signIn, signUp, signOut, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
