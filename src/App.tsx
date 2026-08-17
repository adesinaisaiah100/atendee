import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { initializeSeedData, DEFAULT_FELLOWSHIP_ID } from './lib/seedData';
import { flushSyncQueue, computeInactivityAlerts } from './lib/syncEngine';
import { Navbar, type MainTab } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { KioskCheckIn } from './components/KioskCheckIn';
import { EventsView } from './components/EventsView';
import { MemberManagement } from './components/MemberManagement';
import { MissingMembersView } from './components/MissingMembersView';
import { SettingsView } from './components/SettingsView';
import type { InactivityAlert } from './types';

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('events');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [inactivityThreshold, setInactivityThreshold] = useState(3);
  const [inactivityAlerts, setInactivityAlerts] = useState<InactivityAlert[]>([]);
  // Initialize clean state & clear any previous mock events
  useEffect(() => {
    initializeSeedData().then(async () => {
      // Purge any legacy default event IDs if they existed in previous sessions
      const legacyMockEvents = await db.events
        .where('id')
        .anyOf(['e0000001-0000-0000-0000-000000000001', 'e0000002-0000-0000-0000-000000000002'])
        .toArray();
      if (legacyMockEvents.length > 0) {
        await db.events
          .where('id')
          .anyOf(['e0000001-0000-0000-0000-000000000001', 'e0000002-0000-0000-0000-000000000002'])
          .delete();
      }
      setIsInitialized(true);
    });

    const handleOnline = () => {
      flushSyncQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-300">Loading atendee...</p>
      </div>
    );
  }

  // 1. KIOSK MODE: Pass-the-Phone Circulating Check-in
  if (isKioskMode) {
    return (
      <KioskCheckIn
        session={activeSession}
        event={activeEvent}
        members={members}
        attendanceRecords={attendanceRecords}
        onExitKiosk={() => setIsKioskMode(false)}
        pinCode={fellowship?.pin_code || '1234'}
      />
    );
  }

  // 2. LOGIN / SETUP SCREEN: Comes before the admin dashboard
  if (!isLoggedIn) {
    return (
      <LoginView
        fellowship={fellowship || null}
        activeSession={activeSession}
        activeEvent={activeEvent}
        onLoginSuccess={() => setIsLoggedIn(true)}
        onLaunchKioskDirect={() => setIsKioskMode(true)}
      />
    );
  }

  // 3. ADMIN HUB: Black & Yellow Theme with Event-First Flow
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-black">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        missingCount={inactivityAlerts.length}
        hasActiveSession={Boolean(activeSession)}
        onLaunchKiosk={() => setIsKioskMode(true)}
        fellowshipName={fellowship?.name || 'My Fellowship'}
        onLogout={() => setIsLoggedIn(false)}
      />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-12">
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
            onRefresh={() => {}}
          />
        )}
      </main>
    </div>
  );
}

export default App;
