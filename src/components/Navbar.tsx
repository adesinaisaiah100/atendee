import React from 'react';
import {
  Users,
  Calendar,
  HeartHandshake,
  Plus,
  Settings,
  LogOut,
} from 'lucide-react';
import { AtendeeLogo } from './AtendeeLogo';

export type MainTab = 'events' | 'people' | 'missing' | 'settings';

interface NavbarProps {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  missingCount: number;
  onCreateEvent: () => void;
  fellowshipName: string;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  missingCount,
  onCreateEvent,
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
      <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
            {/* Brand Logo & Fellowship Name */}
            <div
              onClick={() => setActiveTab('events')}
              className="flex items-center gap-3.5 cursor-pointer select-none min-w-0"
            >
              <AtendeeLogo size="md" showText={true} />
              <div className="hidden md:block border-l border-zinc-800 pl-3.5">
                <span className="text-xs font-bold text-zinc-400 truncate block max-w-[240px]">
                  {fellowshipName}
                </span>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden sm:flex items-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 shadow-inner">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-yellow-400 text-black shadow-md shadow-yellow-950/30'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
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

            {/* Right Actions: + Create Event Button & Logout */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCreateEvent}
                className="bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-yellow-950/40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Event</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-2.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition cursor-pointer"
                title="Lock Admin Hub"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800 px-4 py-2.5 shadow-2xl safe-bottom">
        <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition relative cursor-pointer ${
                  isActive ? 'text-yellow-400 font-black' : 'text-zinc-400 hover:text-zinc-200'
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
