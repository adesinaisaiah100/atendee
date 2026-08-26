import { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { flushSyncQueue, hydrateFellowshipData, computeInactivityAlerts } from './lib/syncEngine';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Navbar, type MainTab } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { KioskCheckIn } from './components/KioskCheckIn';
import { EventsView } from './components/EventsView';
import { MemberManagement } from './components/MemberManagement';
import { MissingMembersView } from './components/MissingMembersView';
import { SettingsView } from './components/SettingsView';
import { JoinView } from './components/JoinView';
import type { InactivityAlert } from './types';

/** Main Admin Dashboard (Multi-Tenant Scoped) */
function AdminApp() {
  const { user, fellowship, isLoading, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>('events');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [inactivityThreshold, setInactivityThreshold] = useState(3);
  const [inactivityAlerts, setInactivityAlerts] = useState<InactivityAlert[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  const fellowshipId = fellowship?.id || '';

  useEffect(() => {
    if (!fellowshipId) return;

    // 1. Initial hydration and queue flush
    hydrateFellowshipData(fellowshipId).catch(console.warn);
    flushSyncQueue().catch(console.warn);

    // 2. Poll every 10 seconds to sync changes from other devices
    const interval = setInterval(() => {
      if (navigator.onLine) {
        hydrateFellowshipData(fellowshipId).catch(console.warn);
        flushSyncQueue().catch(console.warn);
      }
    }, 10000);

    // 3. Instant sync on tab focus or online event
    const handleSync = () => {
      if (navigator.onLine) {
        hydrateFellowshipData(fellowshipId).catch(console.warn);
        flushSyncQueue().catch(console.warn);
      }
    };

    window.addEventListener('online', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [fellowshipId]);

  // Live Reactive Queries Scoped to Current Tenant
  const members = useLiveQuery(
    () => (fellowshipId ? db.members.where('fellowship_id').equals(fellowshipId).toArray() : []),
    [fellowshipId]
  ) || [];

  const events = useLiveQuery(
    () => (fellowshipId ? db.events.where('fellowship_id').equals(fellowshipId).toArray() : []),
    [fellowshipId]
  ) || [];

  const sessions = useLiveQuery(
    () => (fellowshipId ? db.sessions.where('fellowship_id').equals(fellowshipId).toArray() : []),
    [fellowshipId]
  ) || [];

  const attendanceRecords = useLiveQuery(async () => {
    if (!fellowshipId || sessions.length === 0) return [];
    const sessionIds = sessions.map(s => s.id);
    return db.attendance_records.where('session_id').anyOf(sessionIds).toArray();
  }, [fellowshipId, sessions]) || [];

  // Active Open Session
  const activeSession = useMemo(() => {
    return sessions.find(s => s.status === 'open') || null;
  }, [sessions]);

  const activeEvent = useMemo(() => {
    return activeSession ? events.find(e => e.id === activeSession.event_id) || null : null;
  }, [activeSession, events]);

  // Compute Missing Members dynamically
  useEffect(() => {
    if (!fellowshipId) return;
    computeInactivityAlerts(fellowshipId, undefined, inactivityThreshold).then(alerts => {
      setInactivityAlerts(alerts);
    });
  }, [fellowshipId, members, sessions, attendanceRecords, inactivityThreshold]);

  const handleCloseSession = async (sessionId: string) => {
    if (window.confirm('End this service session? Self-service check-in will be closed.')) {
      await db.sessions.update(sessionId, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
      if (fellowshipId) {
        computeInactivityAlerts(fellowshipId, undefined, inactivityThreshold).then(setInactivityAlerts);
      }
    }
  };

  // 1. LOADING SCREEN
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-300">Loading atendee...</p>
      </div>
    );
  }

  // 2. AUTH SCREEN: Dual Username/Email Sign-In & Multi-Tenant Sign-Up
  if (!isAuthenticated || !fellowship || !user) {
    return <AuthView />;
  }

  const fellowshipName = fellowship.name;
  const fellowshipSlug = fellowship.slug;

  // 3. KIOSK MODE: Pass-the-Phone Circulating Check-in
  if (isKioskMode) {
    return (
      <KioskCheckIn
        session={activeSession}
        event={activeEvent}
        members={members}
        attendanceRecords={attendanceRecords}
        fellowshipName={fellowshipName}
        fellowshipId={fellowship.id}
        onRefresh={() => {
          if (fellowshipId) hydrateFellowshipData(fellowshipId).catch(console.warn);
        }}
        onExitKiosk={() => setIsKioskMode(false)}
      />
    );
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/join/${fellowshipSlug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // 4. ADMIN HUB: Black & Yellow Theme with Event-First Flow
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-black overflow-x-hidden w-full max-w-full">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        missingCount={inactivityAlerts.length}
        fellowshipName={fellowshipName}
        adminUsername={user.username}
        onLogout={logout}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-8 py-6 sm:py-8 pb-28 sm:pb-12 overflow-x-hidden">
        {/* Join Link Banner */}
        {fellowshipSlug && activeTab === 'people' && (
          <div className="mb-6 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-yellow-500/20 rounded-3xl p-4 sm:p-5 shadow-lg shadow-black/40 w-full max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 w-full">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
                    Member Self-Registration Portal
                  </p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed break-words">
                  Share this public link with members to register and receive their unique check-in code.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 ${
                    copiedLink
                      ? 'bg-emerald-500 text-black border border-emerald-400'
                      : 'bg-yellow-400 hover:bg-yellow-300 text-black border border-yellow-300/60 shadow-yellow-950/40'
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <span>✓</span>
                      <span>Link Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <span>📋</span>
                      <span>Copy Public Join Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <EventsView
            fellowshipId={fellowshipId}
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
            fellowshipId={fellowshipId}
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
            fellowship={fellowship}
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

/** Root App with Routing and AuthProvider */
export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/join/:slug" element={<JoinRoute />} />
          <Route path="/*" element={<AdminApp />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
