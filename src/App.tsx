import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { initializeSeedData, DEFAULT_FELLOWSHIP_ID } from './lib/seedData';
import { flushSyncQueue, type NetworkStatus } from './lib/syncEngine';
import { Navbar, type AdminTab } from './components/Navbar';
import { KioskCheckIn } from './components/KioskCheckIn';
import { AdminDashboard } from './components/AdminDashboard';
import { MemberManagement } from './components/MemberManagement';
import { EventManager } from './components/EventManager';
import { PendingReview } from './components/PendingReview';
import { ReportsExport } from './components/ReportsExport';
import { TermsManager } from './components/TermsManager';
import { DatabaseSchemaViewer } from './components/DatabaseSchemaViewer';

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize Seed DB
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
  const activeSession = sessions.find(s => s.status === 'open') || null;
  const activeEvent = activeSession
    ? events.find(e => e.id === activeSession.event_id) || null
    : null;

  const pendingCount = pendingMembers.filter(p => p.status === 'pending').length;

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await flushSyncQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    if (window.confirm('Close this attendance session? Self-service phone check-in will stop.')) {
      await db.sessions.update(sessionId, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Initializing Fellowship Engine...</p>
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

  // 2. ADMIN HUB: Leadership & Operations Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
        onLaunchKiosk={() => setIsKioskMode(true)}
        networkStatus={networkStatus}
        onManualSync={handleManualSync}
        isSyncing={isSyncing}
        fellowshipName={fellowship?.name || 'Grace Christian Fellowship'}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-20">
        {activeTab === 'dashboard' && (
          <AdminDashboard
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            activeSession={activeSession}
            events={events}
            members={members}
            sessions={sessions}
            attendanceRecords={attendanceRecords}
            pendingCount={pendingCount}
            onLaunchKiosk={() => setIsKioskMode(true)}
            onOpenSessionModal={() => setActiveTab('events')}
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
          />
        )}

        {activeTab === 'events' && (
          <EventManager
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            events={events}
            sessions={sessions}
            members={members}
            attendanceRecords={attendanceRecords}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'pending' && (
          <PendingReview
            pendingMembers={pendingMembers}
            members={members}
            sessions={sessions}
            events={events}
            onRefresh={() => {}}
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

        {activeTab === 'terms' && (
          <TermsManager
            fellowshipId={DEFAULT_FELLOWSHIP_ID}
            terms={terms}
            onRefresh={() => {}}
          />
        )}

        {activeTab === 'schema' && <DatabaseSchemaViewer />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Fellowship Attendance System v2.0 • Offline-First PWA</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            PostgreSQL &amp; Dexie IndexedDB Synchronized
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
