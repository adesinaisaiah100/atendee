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
  LogOut,
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
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  missingCount,
  hasActiveSession,
  onLaunchKiosk,
  networkStatus,
  fellowshipName,
  onLogout,
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
      <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Fellowship Title */}
            <div
              onClick={() => setActiveTab('events')}
              className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
            >
              <div className="w-9 h-9 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black shadow-md shadow-yellow-950/50 flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-white leading-tight truncate">
                  {fellowshipName}
                </h1>
                <span className="text-[11px] text-yellow-400 font-semibold">Attendance</span>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden sm:flex items-center gap-1 bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
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
                        ? 'bg-yellow-400 text-black shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {Boolean(item.badge && item.badge > 0) && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <div
                className="p-2 text-zinc-400"
                title={networkStatus === 'online' ? 'Online' : 'Offline'}
              >
                {networkStatus === 'online' ? (
                  <Wifi className="w-4 h-4 text-yellow-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-amber-500" />
                )}
              </div>

              {hasActiveSession && (
                <button
                  type="button"
                  onClick={onLaunchKiosk}
                  className="bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-yellow-950/40"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Pass Phone</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                className="p-2 text-zinc-500 hover:text-zinc-200 rounded-xl hover:bg-zinc-900 transition"
                title="Lock Admin Hub"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800 px-4 py-2 shadow-2xl safe-bottom">
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
                  isActive ? 'text-yellow-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
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
