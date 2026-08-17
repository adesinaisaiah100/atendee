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
        '⚠️ Are you sure you want to clear all data? This will reset all events, members, and attendance records for a clean slate.'
      )
    ) {
      await db.events.clear();
      await db.members.clear();
      await db.sessions.clear();
      await db.attendance_records.clear();
      await db.pending_members.clear();
      await db.sync_queue.clear();
      onRefresh();
      alert('All local events and attendance data have been cleared.');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in">
      <div>
        <h2 className="text-xl font-black text-white">Settings &amp; Reports</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Manage fellowship name, PIN, and download master reports.
        </p>
      </div>

      {/* 1. Export Master CSV Spreadsheet */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-yellow-400" /> Export Master Attendance Ledger
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Download full attendance rates and frequency for all members in Excel/CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportAllMembersAttendanceRateCSV(fellowship?.id || '', 'Fellowship_Attendance_Master')}
          className="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-950/40 active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Master CSV</span>
        </button>
      </div>

      {/* 2. General Profile & Kiosk PIN */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-yellow-400" /> Fellowship Profile
        </h3>

        {savedMessage && (
          <div className="p-3 bg-yellow-950/60 border border-yellow-800/50 rounded-xl text-yellow-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" /> {savedMessage}
          </div>
        )}

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              Fellowship / Church Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white text-sm focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Admin Kiosk Exit PIN (4 digits)</span>
              <span className="text-[11px] text-zinc-500 font-normal">Protects admin view when passing phone</span>
            </label>
            <input
              type="password"
              maxLength={4}
              required
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className="w-36 px-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white font-mono text-center tracking-widest text-base focus:outline-none transition"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-xl transition shadow shadow-yellow-950/40 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* 3. Cloud Sync Status */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {networkStatus === 'online' ? (
            <Wifi className="w-5 h-5 text-yellow-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-amber-500" />
          )}
          <div>
            <div className="text-sm font-bold text-white">
              {networkStatus === 'online' ? 'Cloud Connected (Supabase)' : 'Offline Storage (Local)'}
            </div>
            <div className="text-xs text-zinc-400">
              Automatic sync enabled
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onManualSync}
          disabled={isSyncing}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-yellow-400' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* 4. Danger Zone */}
      <div className="bg-zinc-900 border border-rose-950 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-rose-400">Reset Local Database</div>
          <div className="text-xs text-zinc-400">Clear all local events, members, and sessions</div>
        </div>

        <button
          type="button"
          onClick={handleClearAllData}
          className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Local Data</span>
        </button>
      </div>
    </div>
  );
};
