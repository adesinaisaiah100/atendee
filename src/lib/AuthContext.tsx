import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getStoredAuthSession,
  loginAdmin,
  signUpAdmin,
  logoutAdmin,
  verifyAdminPassword,
} from './auth';
import { hydrateFellowshipData } from './syncEngine';
import { supabase, isSupabaseConfigured } from './supabase';
import type { AdminUser, Fellowship } from '../types';

interface AuthContextType {
  user: AdminUser | null;
  fellowship: Fellowship | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    fellowshipName: string,
    username: string,
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [fellowship, setFellowship] = useState<Fellowship | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      try {
        const stored = getStoredAuthSession();
        if (stored) {
          setUser(stored.user);
          setFellowship(stored.fellowship);
          // Hydrate data in background
          hydrateFellowshipData(stored.fellowship.id).catch(console.error);
        }

        if (isSupabaseConfigured()) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session && stored) {
            // Token expired or invalid
            // we keep local session or refresh
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initSession();

    if (isSupabaseConfigured()) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const stored = getStoredAuthSession();
          if (stored) {
            setUser(stored.user);
            setFellowship(stored.fellowship);
          }
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await loginAdmin(identifier, password);
      if (res.success && res.data) {
        setUser(res.data.user);
        setFellowship(res.data.fellowship);
        // Hydrate all tenant records from Supabase in background
        hydrateFellowshipData(res.data.fellowship.id).catch(console.warn);
        return { success: true };
      }
      return { success: false, error: res.error };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    fellowshipName: string,
    username: string,
    email: string,
    password: string
  ) => {
    setIsLoading(true);
    try {
      const res = await signUpAdmin(fellowshipName, username, email, password);
      if (res.success && res.data) {
        setUser(res.data.user);
        setFellowship(res.data.fellowship);
        return { success: true };
      }
      return { success: false, error: res.error };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutAdmin();
      setUser(null);
      setFellowship(null);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    if (!user) return false;
    return verifyAdminPassword(user.email, password);
  };

  const refreshSession = async () => {
    const stored = getStoredAuthSession();
    if (stored) {
      setUser(stored.user);
      setFellowship(stored.fellowship);
      await hydrateFellowshipData(stored.fellowship.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        fellowship,
        isLoading,
        isAuthenticated: Boolean(user && fellowship),
        login,
        signup,
        logout,
        verifyPassword,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
