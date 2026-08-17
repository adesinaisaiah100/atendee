import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { initializeSeedData, DEFAULT_FELLOWSHIP_ID } from './lib/seedData';
import { flushSyncQueue, computeInactivityAlerts, type NetworkStatus } from './lib/syncEngine';
import { Navbar, type MainTab } from './components/Navbar';
import { KioskCheckIn } from './components/KioskCheckIn';
import { EventsView } from './components/EventsView';
import { MemberManagement } from './components/MemberManagement';
import { MissingMembersView } from './components/MissingMembersView';
import { SettingsView } from './components/SettingsView';
import type { InactivityAlert } from './types';

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('events');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [inactivityThreshold, setInactivityThreshold] = useState(3);
  const [inactivityAlerts, setInactivityAlerts] = useState<InactivityAlert[]>([]);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize clean state
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

  // Active Open Session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.status === 'open') || null;
  }, [sessions]);

  const activeEvent = useMemo(() => {
    return activeSession ? events.find(e => e.id === activeSession.event_id) || null : null;
  }, [activeSession, events]);

  // Compute Missing Members dynamically
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

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
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

  // 2. CLEAN, MINIMAL ADMIN APP
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        missingCount={inactivityAlerts.length}
        hasActiveSession={Boolean(activeSession)}
        onLaunchKiosk={() => setIsKioskMode(true)}
        networkStatus={networkStatus}
        fellowshipName={fellowship?.name || 'My Fellowship'}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-12">
        {activeTab === 'events' && (
          <EventsView
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

        {activeTab === 'people' && (
          <MemberManagement
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            members={members}
            attendanceRecords={attendanceRecords}
            sessions={sessions}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'missing' && (
          <MissingMembersView
            inactivityAlerts={inactivityAlerts}
            inactivityThreshold={inactivityThreshold}
            setInactivityThreshold={setInactivityThreshold}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            fellowship={fellowship || null}
            networkStatus={networkStatus}
            isSyncing={isSyncing}
            onManualSync={handleManualSync}
            onRefresh={() => {}}
          />
        )}
      </main>
    </div>
  );
}

export default App;
