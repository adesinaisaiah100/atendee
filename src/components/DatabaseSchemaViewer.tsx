import React, { useState } from 'react';
import { Database, Copy, Check, Terminal, ExternalLink, ShieldCheck } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA, isSupabaseConfigured } from '../lib/supabase';

export const DatabaseSchemaViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const isConfigured = isSupabaseConfigured();

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Supabase Cloud Database & RLS Schema</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete Postgres DDL, Foreign Key Constraints, and Row Level Security policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL Schema'}</span>
          </button>
        </div>
      </div>

      {/* Cloud Status Card */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <div>
            <div className="text-xs font-bold text-white">
              {isConfigured ? 'Supabase Backend Connected' : 'Local-First Dexie Engine Mode Active'}
            </div>
            <div className="text-[11px] text-slate-400">
              {isConfigured
                ? 'Syncing mutations directly to Supabase Postgres.'
                : 'Running on IndexedDB. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to link your cloud project.'}
            </div>
          </div>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
        >
          Open Supabase <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* SQL Code Block */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono flex items-center gap-1.5 font-bold text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" /> schema.sql
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> PostgreSQL + RLS Enabled
          </span>
        </div>

        <div className="p-5 overflow-x-auto max-h-[600px] font-mono text-xs text-slate-300 leading-relaxed">
          <pre>{SUPABASE_SQL_SCHEMA}</pre>
        </div>
      </div>
    </div>
  );
};
