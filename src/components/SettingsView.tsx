import React, { useState } from 'react';
import {
  Building2,
  RotateCcw,
  Check,
  FileSpreadsheet,
  Download,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import type { Fellowship } from '../types';
import { db } from '../lib/db';
import { queueMutation, type NetworkStatus } from '../lib/syncEngine';
import { exportAllMembersAttendanceRateCSV } from '../lib/exportUtils';

interface SettingsViewProps {
  fellowship: Fellowship | null;
  networkStatus: NetworkStatus;
  isSyncing: boolean;
  onManualSync: () => void;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  fellowship,
  networkStatus,
  isSyncing,
  onManualSync,
  onRefresh,
}) => {
  const [name, setName] = useState(fellowship?.name || 'My Fellowship');
  const [pin, setPin] = useState(fellowship?.pin_code || '1234');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

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

    setSavedMessage('Saved successfully!');
    setTimeout(() => setSavedMessage(null), 3000);
    onRefresh();
  };

  const handleClearAllData = async () => {
    if (
      window.confirm(
        '⚠️ Are you sure you want to clear all data? This will reset all local members and attendance records.'
      )
    ) {
      await db.members.clear();
      await db.sessions.clear();
      await db.attendance_records.clear();
      await db.pending_members.clear();
      await db.sync_queue.clear();
      onRefresh();
      alert('Database reset. You have a clean slate.');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in">
      <div>
        <h2 className="text-xl font-extrabold text-white">Settings &amp; Reports</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage your fellowship name, PIN, and download master reports.
        </p>
      </div>

      {/* 1. Export Master CSV Spreadsheet */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-400" /> Export Master Attendance Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Download full attendance rates and frequency for all members in Excel/CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportAllMembersAttendanceRateCSV(fellowship?.id || '', 'Fellowship_Attendance_Master')}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 active:scale-95 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>Download Master CSV</span>
        </button>
      </div>

      {/* 2. General Profile & Kiosk PIN */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-400" /> Fellowship Profile
        </h3>

        {savedMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" /> {savedMessage}
          </div>
        )}

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Fellowship / Church Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
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
              className="w-36 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest text-base focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* 3. Cloud Sync Status */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {networkStatus === 'online' ? (
            <Wifi className="w-5 h-5 text-emerald-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-amber-400" />
          )}
          <div>
            <div className="text-sm font-bold text-white">
              {networkStatus === 'online' ? 'Cloud Connected (Supabase)' : 'Offline Storage (Local)'}
            </div>
            <div className="text-xs text-slate-400">
              Automatic sync enabled
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onManualSync}
          disabled={isSyncing}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* 4. Danger Zone */}
      <div className="bg-slate-900 border border-rose-950 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-rose-400">Reset Local Database</div>
          <div className="text-xs text-slate-400">Clear all local members and attendance records</div>
        </div>

        <button
          type="button"
          onClick={handleClearAllData}
          className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Local Data</span>
        </button>
      </div>
    </div>
  );
};
