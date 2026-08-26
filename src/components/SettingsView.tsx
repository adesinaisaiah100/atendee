import React, { useState } from 'react';
import {
  Building2,
  RotateCcw,
  Check,
  FileSpreadsheet,
  Download,
  Link as LinkIcon,
  Copy,
  User,
  LogOut,
  Mail,
  AtSign,
} from 'lucide-react';
import type { Fellowship } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';
import { generateSlug } from '../lib/codeGenerator';
import { exportAllMembersAttendanceRateCSV } from '../lib/exportUtils';
import { useAuth } from '../lib/AuthContext';

interface SettingsViewProps {
  fellowship: Fellowship | null;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  fellowship,
  onRefresh,
}) => {
  const { user, logout } = useAuth();
  const [name, setName] = useState(fellowship?.name || 'My Fellowship');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const slug = fellowship?.slug || generateSlug(fellowship?.name || 'my-fellowship');
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join/${slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fellowship) return;

    const trimmedName = name.trim() || 'My Fellowship';
    const updatedSlug = generateSlug(trimmedName);

    const updated: Fellowship = {
      ...fellowship,
      name: trimmedName,
      slug: updatedSlug,
    };

    await db.fellowships.put(updated);
    await queueMutation('fellowship', 'update', updated);

    setSavedMessage('Organization name updated successfully!');
    setTimeout(() => setSavedMessage(null), 3000);
    onRefresh();
  };

  const handleClearAllData = async () => {
    if (
      window.confirm(
        '⚠️ Are you sure you want to clear local cache data? All offline records will be reset on this device.'
      )
    ) {
      await db.events.clear();
      await db.members.clear();
      await db.sessions.clear();
      await db.attendance_records.clear();
      await db.pending_members.clear();
      await db.sync_queue.clear();
      onRefresh();
      alert('Local cached data has been cleared.');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-4xl pb-16 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-black text-white">Settings &amp; Reports</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Manage your organization name, admin account, member join link, and download master attendance.
        </p>
      </div>

      {/* 1. Admin Profile Card */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 flex items-center justify-center font-black">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {user?.username || 'Admin User'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-400 text-black">
                  Admin
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <AtSign className="w-3.5 h-3.5 text-yellow-400" />
                  <span>{user?.username || 'admin'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-yellow-400" />
                  <span>{user?.email || 'email'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="px-4 py-2.5 bg-zinc-800 hover:bg-rose-950/60 hover:text-rose-300 text-zinc-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-zinc-700 hover:border-rose-800/60 active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 2. Self-Registration Join Link */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-yellow-400" /> Member Self-Registration Link
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Share this public link with members (via WhatsApp, SMS, or church slides) to let them register and receive their unique attendance code.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-950/40 active:scale-95 whitespace-nowrap cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Copied!' : 'Copy Join Link'}</span>
          </button>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-mono text-zinc-300 overflow-x-auto">
          <span className="truncate">{joinUrl}</span>
        </div>
      </div>

      {/* 3. Export Master CSV Spreadsheet */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-yellow-400" /> Export Master Attendance Ledger
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Download full attendance rates, member codes, and frequency for all members in Excel/CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportAllMembersAttendanceRateCSV(fellowship?.id || '', 'atendee_Master_Report')}
          className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-zinc-700 active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4 text-yellow-400" />
          <span>Download Master CSV</span>
        </button>
      </div>

      {/* 4. General Profile */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-yellow-400" /> Organization Profile
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

          <div className="pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-xs rounded-xl transition shadow-lg shadow-yellow-950/40 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* 5. Danger Zone */}
      <div className="bg-zinc-900 border border-rose-950 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-rose-400">Reset Local Cache</div>
          <div className="text-xs text-zinc-400">Clear offline local storage on this browser</div>
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
