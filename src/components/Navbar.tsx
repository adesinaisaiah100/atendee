import React from 'react';
import {
  Users,
  Calendar,
  HeartHandshake,
  Smartphone,
  Settings,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import type { NetworkStatus } from '../lib/syncEngine';

export type MainTab = 'events' | 'people' | 'missing' | 'settings';

interface NavbarProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  missingCount: number;
  hasActiveSession: boolean;
  onLaunchKiosk: () => void;
  networkStatus: NetworkStatus;
  fellowshipName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  missingCount,
  hasActiveSession,
  onLaunchKiosk,
  networkStatus,
  fellowshipName,
}) => {
  const navItems: {
    id: MainTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'people', label: 'People', icon: Users },
    { id: 'missing', label: 'Missing', icon: HeartHandshake, badge: missingCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Fellowship Title */}
            <div
              onClick={() => setActiveTab('events')}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-emerald-950">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                  {fellowshipName}
                </h1>
                <span className="text-[11px] text-emerald-400 font-semibold">Attendance</span>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden sm:flex items-center gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {Boolean(item.badge && item.badge > 0) && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-slate-950">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Actions (Pass Phone & Online) */}
            <div className="flex items-center gap-2">
              <div
                className="p-2 text-slate-400"
                title={networkStatus === 'online' ? 'Online' : 'Offline'}
              >
                {networkStatus === 'online' ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-amber-400" />
                )}
              </div>

              {hasActiveSession && (
                <button
                  type="button"
                  onClick={onLaunchKiosk}
                  className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-950"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Pass Phone</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 px-4 py-2 shadow-2xl safe-bottom">
        <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition relative ${
                  isActive ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
