import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { initializeSeedData, DEFAULT_FELLOWSHIP_ID } from './lib/seedData';
import { flushSyncQueue, computeInactivityAlerts, type NetworkStatus } from './lib/syncEngine';
import { Navbar, type AdminTab } from './components/Navbar';
import { KioskCheckIn } from './components/KioskCheckIn';
import { AdminDashboard } from './components/AdminDashboard';
import { MemberManagement } from './components/MemberManagement';
import { EventManager } from './components/EventManager';
import { MissingMembersView } from './components/MissingMembersView';
import { ReportsExport } from './components/ReportsExport';
import { SettingsView } from './components/SettingsView';
import type { InactivityAlert } from './types';

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [inactivityThreshold, setInactivityThreshold] = useState(3);
  const [inactivityAlerts, setInactivityAlerts] = useState<InactivityAlert[]>([]);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize Clean State
  useEffect(() => {
    initializeSeedData().then(() => {
      setIsInitialized(true);
    });

    const handleOnline = () => {
      setNetworkStatus('online');
      setIsSyncing(true);
      flushSyncQueue().finally(() => setIsSyncing(false));
    };

    const handleOffline = () => {
      setNetworkStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Live Reactive Queries from Dexie
  const fellowship = useLiveQuery(() => db.fellowships.get(DEFAULT_FELLOWSHIP_ID));
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const events = useLiveQuery(() => db.events.toArray()) || [];
  const sessions = useLiveQuery(() => db.sessions.toArray()) || [];
  const attendanceRecords = useLiveQuery(() => db.attendance_records.toArray()) || [];
  const pendingMembers = useLiveQuery(() => db.pending_members.toArray()) || [];
  const terms = useLiveQuery(() => db.terms.toArray()) || [];

  // Active Open Session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.status === 'open') || null;
  }, [sessions]);

  const activeEvent = useMemo(() => {
    return activeSession ? events.find(e => e.id === activeSession.event_id) || null : null;
  }, [activeSession, events]);

  const pendingCount = useMemo(() => {
    return pendingMembers.filter(p => p.status === 'pending').length;
  }, [pendingMembers]);

  // Compute Missing Members Alerts dynamically
  useEffect(() => {
    if (!isInitialized) return;
    computeInactivityAlerts(DEFAULT_FELLOWSHIP_ID, undefined, inactivityThreshold).then(alerts => {
      setInactivityAlerts(alerts);
    });
  }, [isInitialized, members, sessions, attendanceRecords, inactivityThreshold]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await flushSyncQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (window.confirm('End this service session? Self-service phone check-in will be closed.')) {
      await db.sessions.update(sessionId, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
      computeInactivityAlerts(DEFAULT_FELLOWSHIP_ID, undefined, inactivityThreshold).then(setInactivityAlerts);
    }
  };

  const handleQuickStartSession = async () => {
    if (events.length === 0) {
      setActiveTab('events');
      return;
    }
    const targetEvent = events[0];
    const today = new Date().toISOString().split('T')[0];

    const newSess = {
      id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fellowship_id: DEFAULT_FELLOWSHIP_ID,
      event_id: targetEvent.id,
      session_date: today,
      status: 'open' as const,
      opened_at: new Date().toISOString(),
    };

    await db.sessions.put(newSess);
    setIsKioskMode(true);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Loading Fellowship...</p>
      </div>
    );
  }

  // 1. KIOSK MODE: Circulating Phone Pass-the-Phone Check-in
  if (isKioskMode) {
    return (
      <KioskCheckIn
        session={activeSession}
        event={activeEvent}
        members={members}
        attendanceRecords={attendanceRecords}
        onExitKiosk={() => setIsKioskMode(false)}
        pinCode={fellowship?.pin_code || '1234'}
        isOnline={networkStatus === 'online'}
      />
    );
  }

  // 2. HUMAN-FRIENDLY ADMIN COMMAND CENTER
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
        missingCount={inactivityAlerts.length}
        onLaunchKiosk={() => setIsKioskMode(true)}
        networkStatus={networkStatus}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
        fellowshipName={fellowship?.name || 'My Fellowship'}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-12">
        {activeTab === 'dashboard' && (
          <AdminDashboard
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            activeSession={activeSession}
            events={events}
            members={members}
            sessions={sessions}
            attendanceRecords={attendanceRecords}
            inactivityAlerts={inactivityAlerts}
            pendingCount={pendingCount}
            onLaunchKiosk={() => setIsKioskMode(true)}
            onQuickStartSession={handleQuickStartSession}
            onOpenAddMember={() => {
              setActiveTab('members');
              setIsAddMemberOpen(true);
            }}
            onCloseSession={handleCloseSession}
            onNavigateTab={(tab: AdminTab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'members' && (
          <MemberManagement
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            members={members}
            attendanceRecords={attendanceRecords}
            sessions={sessions}
            onRefresh={() => {}}
            isAddModalOpen={isAddMemberOpen}
            setIsAddModalOpen={setIsAddMemberOpen}
          />
        )}

        {activeTab === 'events' && (
          <EventManager
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            events={events}
            sessions={sessions}
            members={members}
            attendanceRecords={attendanceRecords}
            activeSession={activeSession}
            onRefresh={() => {}}
            onLaunchKiosk={() => setIsKioskMode(true)}
            onCloseSession={handleCloseSession}
          />
        )}

        {activeTab === 'missing' && (
          <MissingMembersView
            inactivityAlerts={inactivityAlerts}
            inactivityThreshold={inactivityThreshold}
            setInactivityThreshold={setInactivityThreshold}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsExport
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            members={members}
            sessions={sessions}
            events={events}
            attendanceRecords={attendanceRecords}
            terms={terms}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            fellowship={fellowship || null}
            terms={terms}
            networkStatus={networkStatus}
            isSyncing={isSyncing}
            onManualSync={handleManualSync}
            onRefresh={() => {}}
          />
        )}
      </main>

      {/* Clean Mobile Friendly Footer */}
      <footer className="hidden md:block border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{fellowship?.name || 'My Fellowship'} • Attendance &amp; Welfare System</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Cloud Synced &amp; Offline Safe
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
