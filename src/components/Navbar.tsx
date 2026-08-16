import React from 'react';
import {
  Users,
  Calendar,
  BarChart3,
  UserCheck,
  Smartphone,
  Layers,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { NetworkStatus } from '../lib/syncEngine';

export type AdminTab =
  | 'dashboard'
  | 'members'
  | 'events'
  | 'pending'
  | 'reports'
  | 'terms'
  | 'schema';

interface NavbarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  pendingCount: number;
  onLaunchKiosk: () => void;
  networkStatus: NetworkStatus;
  onManualSync: () => void;
  isSyncing: boolean;
  fellowshipName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  onLaunchKiosk,
  networkStatus,
  onManualSync,
  isSyncing,
  fellowshipName,
}) => {
  const navItems: { id: AdminTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'events', label: 'Events & Sessions', icon: Calendar },
    { id: 'pending', label: 'Pending Guests', icon: UserCheck, badge: pendingCount },
    { id: 'reports', label: 'Reports & Export', icon: BookOpen },
    { id: 'terms', label: 'Terms / Semesters', icon: Layers },
    { id: 'schema', label: 'Supabase SQL', icon: Database },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Fellowship Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400">
                  Fellowship Attendance
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                  Admin Hub
                </span>
              </div>
              <h1 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {fellowshipName}
              </h1>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Sync & Connectivity status */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5">
              {networkStatus === 'offline' ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="text-xs font-medium text-slate-300 hidden md:inline">
                {networkStatus === 'offline' ? 'Offline (Queued)' : 'Cloud Synced'}
              </span>

              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                title="Sync queued changes"
                className="ml-1 text-slate-400 hover:text-white transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            {/* Launch Kiosk (Pass-the-Phone) Button */}
            <button
              type="button"
              onClick={onLaunchKiosk}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950 active:scale-95 border border-emerald-500/30"
            >
              <Smartphone className="w-4 h-4 animate-bounce" />
              <span>Pass the Phone</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs bar */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-slate-800/60">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
