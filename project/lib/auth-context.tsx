'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { AppUser, UserRole } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error fetching app user:', error);
      return;
    }

    if (data) {
      setAppUser(data as AppUser);
    } else {
      // Auto-create app_users row if it doesn't exist
      const { data: authData } = await supabase.auth.getUser();
      const userProfile = authData?.user;

      if (userProfile) {
        const newAppUser = {
          id: userProfile.id,
          email: userProfile.email || '',
          full_name: userProfile.user_metadata?.full_name || '',
          role: 'admin' as UserRole,
          active: true,
        };
        const { data: inserted, error: insertError } = await supabase
          .from('app_users')
          .insert(newAppUser)
          .select('*')
          .maybeSingle();

        if (!insertError && inserted) {
          setAppUser(inserted as AppUser);
        } else if (insertError) {
          // Row was likely created by a concurrent call (e.g. another tab, or
          // the SIGNED_IN listener firing twice) — re-fetch instead of giving
          // up, so appUser doesn't stay stuck null.
          const { data: retry } = await supabase
            .from('app_users')
            .select('*')
            .eq('id', uid)
            .maybeSingle();
          if (retry) setAppUser(retry as AppUser);
        }
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        await fetchAppUser(session.user.id);
      }
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        // A background token refresh doesn't change who's signed in, so skip
        // the loading flash and the redundant app_users refetch for it.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) setUser(session.user);
          return;
        }

        // `loading` starts true only for the very first session check above;
        // without re-arming it here, a later sign-in/sign-out would leave
        // `loading` permanently false while appUser is still being fetched,
        // letting pages navigate before the profile is ready.
        setLoading(true);
        if (session?.user) {
          setUser(session.user);
          await fetchAppUser(session.user.id);
        } else {
          setUser(null);
          setAppUser(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAppUser]);

  // "Failed to fetch" means the browser never reached Supabase at all
  // (wrong/deleted project URL, network or DNS block), not a bad credential.
  const describeAuthError = (message: string) =>
    /failed to fetch|network/i.test(message)
      ? 'Could not reach the authentication server. Check your internet connection and the Supabase URL in .env.'
      : message;

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? describeAuthError(error.message) : null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) return { error: describeAuthError(error.message) };

    // The app_users row is created by fetchAppUser's auto-create path once
    // the SIGNED_IN auth event fires — inserting it here too would race
    // with that and could leave appUser stuck unresolved.
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAppUser(null);
  };

  const refreshAppUser = async () => {
    if (user) await fetchAppUser(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, appUser, loading, signIn, signUp, signOut, refreshAppUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
