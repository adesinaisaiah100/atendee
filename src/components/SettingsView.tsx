import React, { useState } from 'react';
import {
  Settings,
  Building2,
  RotateCcw,
  Check,
  Calendar,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  Shield,
  Layers,
  X,
} from 'lucide-react';
import type { Fellowship, Term } from '../types';
import { db } from '../lib/db';
import { queueMutation, type NetworkStatus } from '../lib/syncEngine';

interface SettingsViewProps {
  fellowship: Fellowship | null;
  terms: Term[];
  networkStatus: NetworkStatus;
  isSyncing: boolean;
  onManualSync: () => void;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  fellowship,
  terms,
  networkStatus,
  isSyncing,
  onManualSync,
  onRefresh,
}) => {
  const [name, setName] = useState(fellowship?.name || 'My Fellowship');
  const [pin, setPin] = useState(fellowship?.pin_code || '1234');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Term creation state
  const [isAddTermOpen, setIsAddTermOpen] = useState(false);
  const [termName, setTermName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fellowship) return;

    const updated: Fellowship = {
      ...fellowship,
      name: name.trim() || 'My Fellowship',
      pin_code: pin.length === 4 ? pin : '1234',
    };

    await db.fellowships.put(updated);
    await queueMutation('fellowship', 'update', updated);

    setSavedMessage('Settings updated successfully!');
    setTimeout(() => setSavedMessage(null), 3000);
    onRefresh();
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fellowship || !termName.trim() || !startDate || !endDate) return;

    const newTerm: Term = {
      id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fellowship_id: fellowship.id,
      name: termName.trim(),
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString(),
    };

    await db.terms.put(newTerm);
    await queueMutation('term', 'insert', newTerm);
    setIsAddTermOpen(false);
    setTermName('');
    setStartDate('');
    setEndDate('');
    onRefresh();
  };

  const handleDeleteTerm = async (termId: string, tName: string) => {
    if (window.confirm(`Delete "${tName}"? Historical attendance will remain intact.`)) {
      await db.terms.delete(termId);
      await queueMutation('term', 'delete', { id: termId });
      onRefresh();
    }
  };

  const handleClearAllData = async () => {
    if (
      window.confirm(
        '⚠️ Are you sure you want to clear all data? This will remove all local members and attendance records for a completely clean slate.'
      )
    ) {
      await db.members.clear();
      await db.sessions.clear();
      await db.attendance_records.clear();
      await db.pending_members.clear();
      await db.sync_queue.clear();
      onRefresh();
      alert('✅ Database cleared. You now have a clean slate!');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Settings & Organization</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Customize your fellowship details, kiosk security PIN, and periods.
          </p>
        </div>
      </div>

      {/* 1. General Info & Security */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-400" /> Fellowship Profile & Security
        </h3>

        {savedMessage && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" /> {savedMessage}
          </div>
        )}

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Fellowship / Church / Group Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Grace Campus Fellowship"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Admin Kiosk Exit PIN (4 digits)</span>
              <span className="text-[11px] text-slate-500 font-normal">Protects admin view when passing the phone</span>
            </label>
            <input
              type="password"
              maxLength={4}
              required
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className="w-40 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* 2. Semesters / Academic Terms */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" /> Semesters &amp; Reporting Periods
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bucket reports by school semester or quarter
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddTermOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Period</span>
          </button>
        </div>

        <div className="space-y-2">
          {terms.length > 0 ? (
            terms.map(term => (
              <div
                key={term.id}
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-white text-sm">{term.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {term.start_date} to {term.end_date}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteTerm(term.id, term.name)}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Delete Period"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-3 text-center">No reporting periods defined yet.</p>
          )}
        </div>
      </div>

      {/* 3. Cloud Synchronization & Diagnostics */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm">
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-teal-400" /> Cloud & Offline Synchronization
        </h3>
        
        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {networkStatus === 'online' ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Wifi className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <WifiOff className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="text-sm font-bold text-white">
                {networkStatus === 'online' ? 'Live Cloud Connected' : 'Offline Mode (Local Storage)'}
              </div>
              <div className="text-xs text-slate-400">
                {networkStatus === 'online'
                  ? 'Attendance and member changes sync seamlessly to Supabase.'
                  : 'Changes are safely stored on this phone and will sync automatically when connected.'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 border border-slate-700 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* 4. Danger Zone / Reset Database */}
      <div className="bg-slate-900 border border-rose-900/30 p-6 rounded-3xl">
        <h3 className="text-base font-bold text-rose-400 mb-1">Clean Slate & Database Reset</h3>
        <p className="text-xs text-slate-400 mb-4">
          Wipe all local entries (members, sessions, attendance) to start completely fresh.
        </p>

        <button
          type="button"
          onClick={handleClearAllData}
          className="px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold transition flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Clear Local Roster & Attendance</span>
        </button>
      </div>

      {/* Add Term Modal */}
      {isAddTermOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsAddTermOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Add Reporting Period / Semester</h3>
            <form onSubmit={handleCreateTerm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Period Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 Second Semester"
                  value={termName}
                  onChange={e => setTermName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTermOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  Save Period
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
