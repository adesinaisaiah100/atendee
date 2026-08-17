import React from 'react';
import {
  Users,
  Calendar,
  Home,
  HeartHandshake,
  Smartphone,
  BarChart3,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { NetworkStatus } from '../lib/syncEngine';

export type AdminTab =
  | 'dashboard'
  | 'members'
  | 'events'
  | 'missing'
  | 'reports'
  | 'settings';

interface NavbarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  pendingCount: number;
  missingCount: number;
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
  missingCount,
  onLaunchKiosk,
  networkStatus,
  onManualSync,
  isSyncing,
  fellowshipName,
}) => {
  const navItems: {
    id: AdminTab;
    label: string;
    mobileLabel: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'dashboard', label: 'Home & Overview', mobileLabel: 'Home', icon: Home },
    { id: 'members', label: 'People & Roster', mobileLabel: 'People', icon: Users, badge: pendingCount },
    { id: 'events', label: 'Services & Gatherings', mobileLabel: 'Services', icon: Calendar },
    { id: 'missing', label: 'Missing Members', mobileLabel: 'Missing', icon: HeartHandshake, badge: missingCount },
    { id: 'reports', label: 'Reports & Charts', mobileLabel: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', mobileLabel: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Fellowship Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-950 flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-white truncate">
                  {fellowshipName}
                </h1>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                  <span>Attendance System</span>
                </div>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Cloud Sync Status */}
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                title={networkStatus === 'online' ? 'Cloud Synced (Tap to refresh)' : 'Offline mode'}
                className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 hover:text-white transition active:scale-95"
              >
                {networkStatus === 'offline' ? (
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <RefreshCw
                  className={`w-3 h-3 text-slate-400 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`}
                />
              </button>

              {/* Take Attendance / Pass Phone Button */}
              <button
                type="button"
                onClick={onLaunchKiosk}
                className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-extrabold text-xs sm:text-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-950 border border-emerald-400/40"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden xs:inline">Pass the Phone</span>
                <span className="xs:hidden">Check In</span>
              </button>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 pb-2 border-t border-slate-800/60 pt-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
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

      {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 shadow-2xl safe-bottom">
        <div className="grid grid-cols-6 gap-1 max-w-lg mx-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition relative ${
                  isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-extrabold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold mt-0.5 tracking-tight truncate w-full text-center">
                  {item.mobileLabel}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
