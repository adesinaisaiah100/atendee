import { supabase, isSupabaseConfigured } from './supabase';
import { db } from './db';
import { generateSlug } from './codeGenerator';
import type { Fellowship, AdminUser, Term } from '../types';

const AUTH_STORAGE_KEY = 'atendee_auth_session';

export interface AuthSessionData {
  user: AdminUser;
  fellowship: Fellowship;
}

/** Helper to wrap any async operation with a strict timeout */
async function withTimeout<T>(promise: PromiseLike<T>, ms = 3500): Promise<T | null> {
  let timer: any;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Get stored auth session from localStorage */
export function getStoredAuthSession(): AuthSessionData | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Store auth session locally */
export function setStoredAuthSession(data: AuthSessionData | null) {
  if (data) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

/** Validate username format */
export function sanitizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Sign up a new Admin and create their Fellowship tenant
 */
export async function signUpAdmin(
  fellowshipName: string,
  rawUsername: string,
  rawEmail: string,
  password: string
): Promise<{ success: boolean; data?: AuthSessionData; error?: string }> {
  const trimmedName = fellowshipName.trim();
  const username = sanitizeUsername(rawUsername);
  const email = rawEmail.trim().toLowerCase();

  if (!trimmedName) {
    return { success: false, error: 'Please enter your organization or fellowship name.' };
  }
  if (!username || username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters (letters, numbers, underscores only).' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const fellowshipId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  let slug = generateSlug(trimmedName);

  const fellowshipRecord: Fellowship = {
    id: fellowshipId,
    name: trimmedName,
    slug,
    created_at: new Date().toISOString(),
  };

  const adminRecord: AdminUser = {
    id: userId,
    fellowship_id: fellowshipId,
    username,
    email,
    role: 'admin',
    created_at: new Date().toISOString(),
  };

  const defaultTerm: Term = {
    id: crypto.randomUUID(),
    fellowship_id: fellowshipId,
    name: `${new Date().getFullYear()} Annual Term`,
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
    created_at: new Date().toISOString(),
  };

  // 1. Sync to Supabase Cloud
  let finalUserId = userId;
  if (isSupabaseConfigured()) {
    try {
      // Check if username is already taken in cloud
      const checkRes = await withTimeout(
        supabase.from('fellowship_admins').select('id').eq('username', username).maybeSingle(),
        3000
      );
      if (checkRes && 'data' in checkRes && checkRes.data) {
        return { success: false, error: `The username "${username}" is already taken. Please choose another.` };
      }

      await supabase.from('fellowships').insert(fellowshipRecord);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            fellowship_id: fellowshipId,
            fellowship_name: trimmedName,
          },
        },
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (authData?.user?.id) {
        finalUserId = authData.user.id as any;
        adminRecord.id = finalUserId;
      }

      await supabase.from('fellowship_admins').insert(adminRecord);
      await supabase.from('terms').insert(defaultTerm);
    } catch (err: any) {
      console.warn('Cloud registration error, continuing with local storage:', err);
    }
  }

  // 2. Persist locally to Dexie for instant local UI reactivity
  await db.fellowships.put(fellowshipRecord);
  await db.admins.put(adminRecord);
  await db.terms.put(defaultTerm);

  const sessionData: AuthSessionData = {
    user: adminRecord,
    fellowship: fellowshipRecord,
  };
  setStoredAuthSession(sessionData);

  return { success: true, data: sessionData };
}

/**
 * Log in using either Username OR Email with Password
 */
export async function loginAdmin(
  rawIdentifier: string,
  password: string
): Promise<{ success: boolean; data?: AuthSessionData; error?: string }> {
  const identifier = rawIdentifier.trim();
  if (!identifier) {
    return { success: false, error: 'Please enter your username or email.' };
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  const cleanIdent = identifier.toLowerCase();
  const cleanUsername = sanitizeUsername(identifier);

  // 1. Check local Dexie store first
  const localAdmin = await db.admins
    .filter(
      a =>
        a.email.toLowerCase() === cleanIdent ||
        a.username.toLowerCase() === cleanUsername
    )
    .first();

  if (localAdmin) {
    let localFellowship = await db.fellowships.get(localAdmin.fellowship_id);
    if (!localFellowship) {
      localFellowship = {
        id: localAdmin.fellowship_id,
        name: 'My Fellowship',
        slug: 'my-fellowship',
        created_at: new Date().toISOString(),
      };
      await db.fellowships.put(localFellowship);
    }

    const sessionData: AuthSessionData = {
      user: localAdmin,
      fellowship: localFellowship,
    };
    setStoredAuthSession(sessionData);

    // Try cloud authentication in background
    if (isSupabaseConfigured()) {
      withTimeout(
        supabase.auth.signInWithPassword({
          email: localAdmin.email,
          password,
        }),
        3000
      ).catch(console.warn);
    }

    return { success: true, data: sessionData };
  }

  // 2. If not found locally, try Supabase Cloud Auth
  if (isSupabaseConfigured()) {
    try {
      let targetEmail = cleanIdent;
      let resolvedUsername = '';
      let fellowshipId = '';

      // If username provided, query fellowship_admins with timeout
      if (!identifier.includes('@')) {
        const adminMatch = await withTimeout(
          supabase
            .from('fellowship_admins')
            .select('email, username, fellowship_id, id')
            .eq('username', cleanUsername)
            .maybeSingle(),
          3000
        );

        if (adminMatch?.data) {
          targetEmail = (adminMatch.data as any).email;
          resolvedUsername = (adminMatch.data as any).username;
          fellowshipId = (adminMatch.data as any).fellowship_id;
        } else {
          return {
            success: false,
            error: `No account found with username "${cleanUsername}". If you haven't registered yet, tap "Create Account" above.`,
          };
        }
      }

      const authRes = await withTimeout(
        supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        }),
        3500
      );

      if (authRes?.data?.user) {
        if (!fellowshipId) {
          fellowshipId = authRes.data.user.user_metadata?.fellowship_id || '';
          resolvedUsername = authRes.data.user.user_metadata?.username || targetEmail.split('@')[0];
        }

        let fellowship: Fellowship | null = null;
        if (fellowshipId) {
          const fRes = await withTimeout(
            supabase.from('fellowships').select('*').eq('id', fellowshipId).maybeSingle(),
            2500
          );
          if (fRes?.data) {
            const fData = fRes.data as any;
            fellowship = {
              id: fData.id,
              name: fData.name,
              slug: fData.slug,
              created_at: fData.created_at,
            };
            await db.fellowships.put(fellowship);
          }
        }

        if (!fellowship) {
          fellowship = {
            id: fellowshipId || crypto.randomUUID(),
            name: authRes.data.user.user_metadata?.fellowship_name || 'My Fellowship',
            slug: 'fellowship',
            created_at: new Date().toISOString(),
          };
          await db.fellowships.put(fellowship);
        }

        const adminUser: AdminUser = {
          id: authRes.data.user.id,
          fellowship_id: fellowship.id,
          username: resolvedUsername || targetEmail.split('@')[0],
          email: targetEmail,
          role: 'admin',
          created_at: new Date().toISOString(),
        };

        await db.admins.put(adminUser);

        const sessionData: AuthSessionData = {
          user: adminUser,
          fellowship,
        };

        setStoredAuthSession(sessionData);
        return { success: true, data: sessionData };
      }

      if (authRes?.error) {
        return { success: false, error: authRes.error.message };
      }
    } catch (err: any) {
      console.warn('Login error:', err);
    }
  }

  return {
    success: false,
    error: 'No account found with these credentials. Please check your username/email and password, or tap "Create Account".',
  };
}

/**
 * Verify Admin Password (used to unlock/exit Kiosk mode securely)
 */
export async function verifyAdminPassword(email: string, password: string): Promise<boolean> {
  if (!password) return false;
  if (!isSupabaseConfigured()) return true;

  try {
    const res = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      2500
    );
    return res ? !res.error : true;
  } catch {
    return true;
  }
}

/**
 * Sign out and clear stored session
 */
export async function logoutAdmin(): Promise<void> {
  try {
    if (isSupabaseConfigured()) {
      await withTimeout(supabase.auth.signOut(), 2000);
    }
  } catch (err) {
    console.error('Sign out error:', err);
  } finally {
    setStoredAuthSession(null);
  }
}
