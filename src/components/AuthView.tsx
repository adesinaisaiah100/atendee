import React, { useState } from 'react';
import {
  Lock,
  Building2,
  ArrowRight,
  Mail,
  User,
  Eye,
  EyeOff,
  AtSign,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { AtendeeLogo } from './AtendeeLogo';

type AuthTab = 'login' | 'signup';

export const AuthView: React.FC = () => {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<AuthTab>('login');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup form state
  const [orgName, setOrgName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Status & Error
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await login(loginIdentifier, loginPassword);
      if (!res.success) {
        setError(res.error || 'Invalid credentials. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await signup(orgName, signupUsername, signupEmail, signupPassword);
      if (!res.success) {
        setError(res.error || 'Failed to create account. Please check your inputs.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 selection:bg-yellow-400 selection:text-black">
      {/* Subtle Yellow Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <AtendeeLogo size="lg" showText={true} />
          <p className="text-xs text-zinc-400 max-w-xs mt-1">
            {tab === 'login'
              ? 'Sign in to manage your organization, members, and sessions.'
              : 'Create a new organization and admin account in seconds.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-2xl border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              tab === 'login'
                ? 'bg-yellow-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              tab === 'signup'
                ? 'bg-yellow-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/80 border border-rose-800/60 rounded-2xl text-rose-300 text-xs font-medium text-center leading-relaxed animate-in fade-in flex flex-col items-center gap-2">
            <span>{error}</span>
            {tab === 'login' && error.includes('Create Account') && (
              <button
                type="button"
                onClick={() => {
                  setTab('signup');
                  setSignupUsername(loginIdentifier.replace(/[^a-z0-9_]/g, ''));
                  setError(null);
                }}
                className="mt-1 px-3 py-1.5 bg-yellow-400 text-black font-bold rounded-xl text-xs hover:bg-yellow-300 transition cursor-pointer"
              >
                Switch to Create Account →
              </button>
            )}
          </div>
        )}

        {/* ===== TAB 1: LOGIN FORM ===== */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-yellow-400" />
                <span>Username or Email</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. isaiah_admin or admin@church.org"
                value={loginIdentifier}
                onChange={e => {
                  setLoginIdentifier(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-yellow-400" />
                <span>Password</span>
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={e => {
                    setLoginPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-4 py-3 pr-10 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 rounded-md"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-950/40 border border-yellow-300/40 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ===== TAB 2: SIGNUP FORM ===== */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-yellow-400" />
                <span>Organization / Fellowship Name</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Grace Assembly"
                value={orgName}
                onChange={e => {
                  setOrgName(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-yellow-400" />
                <span>Admin Username</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. grace_admin"
                value={signupUsername}
                onChange={e => {
                  setSignupUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white font-mono text-sm focus:outline-none transition"
              />
              <span className="text-[11px] text-zinc-500 block mt-1">
                You can use this username to sign in on any device.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-yellow-400" />
                <span>Admin Email</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. admin@gracechurch.org"
                value={signupEmail}
                onChange={e => {
                  setSignupEmail(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-yellow-400" />
                <span>Create Password</span>
              </label>
              <div className="relative">
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 6 characters"
                  value={signupPassword}
                  onChange={e => {
                    setSignupPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-4 py-3 pr-10 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 rounded-md"
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-950/40 border border-yellow-300/40 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Organization &amp; Account</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
