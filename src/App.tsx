import { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
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
import { JoinView } from './components/JoinView';
import type { InactivityAlert } from './types';

/** Main Admin Dashboard (existing app) */
function AdminApp() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('events');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
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

  const fellowshipName = fellowship?.name || 'My Fellowship';
  const fellowshipSlug = fellowship?.slug || '';

  // 3. ADMIN HUB: Black & Yellow Theme with Event-First Flow
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-black">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        missingCount={inactivityAlerts.length}
        fellowshipName={fellowshipName}
        onLogout={() => setIsLoggedIn(false)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 pb-24 sm:pb-12">
        {/* Join Link Banner */}
        {fellowshipSlug && activeTab === 'people' && (
          <div className="mb-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-zinc-300">📎 Member Self-Registration Link</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                Share this link so members can register themselves and get their check-in code.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}#/join/${fellowshipSlug}`;
                navigator.clipboard.writeText(url);
                alert('Link copied to clipboard!');
              }}
              className="px-3 py-2 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 text-xs font-bold rounded-xl border border-yellow-400/20 transition cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              📋 Copy Join Link
            </button>
          </div>
        )}

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
            isCreateModalOpen={isCreateEventOpen}
            setIsCreateModalOpen={setIsCreateEventOpen}
          />
        )}

        {activeTab === 'people' && (
          <MemberManagement
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            fellowshipName={fellowshipName}
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

/** Self-Registration Route Wrapper */
function JoinRoute() {
  const slug = window.location.hash.split('/join/')[1]?.split('/')[0]?.split('?')[0] || '';
  return <JoinView slug={slug} />;
}

/** Root App with Routing */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/join/:slug" element={<JoinRoute />} />
        <Route path="/*" element={<AdminApp />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
