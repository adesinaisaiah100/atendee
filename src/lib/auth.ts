import { supabase, isSupabaseConfigured } from './supabase';
import { db } from './db';
import { generateSlug } from './codeGenerator';
import type { Fellowship, AdminUser, Term } from '../types';

const AUTH_STORAGE_KEY = 'atendee_auth_session';

export interface AuthSessionData {
  user: AdminUser;
  fellowship: Fellowship;
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
  let slug = generateSlug(trimmedName);

  try {
    if (isSupabaseConfigured()) {
      // 1. Check if username is already taken
      const { data: existingUser } = await supabase
        .from('fellowship_admins')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingUser) {
        return { success: false, error: 'This username is already taken. Please choose another.' };
      }

      // 2. Ensure unique slug for fellowship
      const { data: existingSlug } = await supabase
        .from('fellowships')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existingSlug) {
        slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // 3. Create Fellowship Record in Supabase
      const fellowshipRecord: Fellowship = {
        id: fellowshipId,
        name: trimmedName,
        slug,
        created_at: new Date().toISOString(),
      };

      const { error: fError } = await supabase.from('fellowships').insert(fellowshipRecord);
      if (fError) {
        console.error('Error creating fellowship in Supabase:', fError);
      }

      // 4. Sign up via Supabase Auth
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

      const userId = authData.user?.id || crypto.randomUUID();

      // 5. Create Fellowship Admin record
      const adminRecord: AdminUser = {
        id: userId,
        fellowship_id: fellowshipId,
        username,
        email,
        role: 'admin',
        created_at: new Date().toISOString(),
      };

      await supabase.from('fellowship_admins').insert(adminRecord);

      // 6. Create default annual term
      const defaultTerm: Term = {
        id: crypto.randomUUID(),
        fellowship_id: fellowshipId,
        name: `${new Date().getFullYear()} Annual Term`,
        start_date: `${new Date().getFullYear()}-01-01`,
        end_date: `${new Date().getFullYear()}-12-31`,
        created_at: new Date().toISOString(),
      };
      await supabase.from('terms').insert(defaultTerm);

      // 7. Write to Local Dexie DB
      await db.fellowships.put(fellowshipRecord);
      await db.admins.put(adminRecord);
      await db.terms.put(defaultTerm);

      const sessionData: AuthSessionData = {
        user: adminRecord,
        fellowship: fellowshipRecord,
      };
      setStoredAuthSession(sessionData);

      return { success: true, data: sessionData };
    } else {
      // Local fallback
      const fellowshipRecord: Fellowship = {
        id: fellowshipId,
        name: trimmedName,
        slug,
        created_at: new Date().toISOString(),
      };

      const adminRecord: AdminUser = {
        id: crypto.randomUUID(),
        fellowship_id: fellowshipId,
        username,
        email,
        role: 'admin',
        created_at: new Date().toISOString(),
      };

      await db.fellowships.put(fellowshipRecord);
      await db.admins.put(adminRecord);

      const sessionData: AuthSessionData = {
        user: adminRecord,
        fellowship: fellowshipRecord,
      };
      setStoredAuthSession(sessionData);

      return { success: true, data: sessionData };
    }
  } catch (err: any) {
    console.error('Sign up error:', err);
    return { success: false, error: err.message || 'An unexpected error occurred during signup.' };
  }
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

  try {
    let targetEmail = identifier.toLowerCase();
    let resolvedUsername = '';
    let fellowshipId = '';

    if (isSupabaseConfigured()) {
      // If identifier is NOT an email (no '@'), resolve username -> email
      if (!identifier.includes('@')) {
        const cleanUsername = sanitizeUsername(identifier);
        const { data: adminMatch, error: adminErr } = await supabase
          .from('fellowship_admins')
          .select('email, username, fellowship_id, id')
          .eq('username', cleanUsername)
          .maybeSingle();

        if (adminErr || !adminMatch) {
          return { success: false, error: `No account found with username "${cleanUsername}".` };
        }

        targetEmail = adminMatch.email;
        resolvedUsername = adminMatch.username;
        fellowshipId = adminMatch.fellowship_id;
      }

      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

      if (authError || !authData.user) {
        return {
          success: false,
          error: authError?.message || 'Invalid credentials. Please check your username/email and password.',
        };
      }

      // Fetch admin details if not already resolved
      if (!fellowshipId || !resolvedUsername) {
        const { data: adminRecord } = await supabase
          .from('fellowship_admins')
          .select('id, fellowship_id, username, email, role')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (adminRecord) {
          fellowshipId = adminRecord.fellowship_id;
          resolvedUsername = adminRecord.username;
        } else {
          // Fallback to user metadata
          fellowshipId = authData.user.user_metadata?.fellowship_id || '';
          resolvedUsername = authData.user.user_metadata?.username || targetEmail.split('@')[0];
        }
      }

      // Fetch Fellowship Details
      let fellowship: Fellowship | null = null;
      if (fellowshipId) {
        const { data: fData } = await supabase
          .from('fellowships')
          .select('*')
          .eq('id', fellowshipId)
          .maybeSingle();

        if (fData) {
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
          name: 'My Fellowship',
          slug: 'my-fellowship',
          created_at: new Date().toISOString(),
        };
      }

      const adminUser: AdminUser = {
        id: authData.user.id,
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
    } else {
      // Local fallback mode
      const localAdmin = await db.admins.filter(a =>
        a.email.toLowerCase() === targetEmail || a.username.toLowerCase() === sanitizeUsername(identifier)
      ).first();

      if (!localAdmin) {
        return { success: false, error: 'Account not found in local database.' };
      }

      const localFellowship = (await db.fellowships.get(localAdmin.fellowship_id)) || {
        id: localAdmin.fellowship_id,
        name: 'My Fellowship',
        slug: 'my-fellowship',
        created_at: new Date().toISOString(),
      };

      const sessionData: AuthSessionData = {
        user: localAdmin,
        fellowship: localFellowship,
      };

      setStoredAuthSession(sessionData);
      return { success: true, data: sessionData };
    }
  } catch (err: any) {
    console.error('Login error:', err);
    return { success: false, error: err.message || 'Login failed. Please try again.' };
  }
}

/**
 * Verify Admin Password (used to unlock/exit Kiosk mode securely)
 */
export async function verifyAdminPassword(email: string, password: string): Promise<boolean> {
  if (!password) return false;
  if (!isSupabaseConfigured()) return true;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Sign out and clear stored session
 */
export async function logoutAdmin(): Promise<void> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.error('Sign out error:', err);
  } finally {
    setStoredAuthSession(null);
  }
}
