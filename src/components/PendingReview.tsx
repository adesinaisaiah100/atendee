import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  Trash2,
  GitMerge,
  Search,
  X,
  Sparkles,
  Phone,
  Calendar,
} from 'lucide-react';
import type { PendingMember, Member, Session, EventTemplate } from '../types';
import { resolvePendingMemberAction } from '../lib/syncEngine';

interface PendingReviewProps {
  pendingMembers: PendingMember[];
  members: Member[];
  sessions: Session[];
  events: EventTemplate[];
  onRefresh: () => void;
}

export const PendingReview: React.FC<PendingReviewProps> = ({
  pendingMembers,
  members,
  sessions,
  events,
  onRefresh,
}) => {
  const [selectedPending, setSelectedPending] = useState<PendingMember | null>(null);
  const [resolutionMode, setResolutionMode] = useState<'merge' | 'new' | null>(null);
  const [targetMemberId, setTargetMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberDept, setNewMemberDept] = useState('General');

  const pendingList = pendingMembers.filter(p => p.status === 'pending');
  const activeMembers = members.filter(m => m.is_active);

  const handleOpenMerge = (pending: PendingMember) => {
    setSelectedPending(pending);
    setResolutionMode('merge');
    setMemberSearch('');
    // Try fuzzy pre-matching
    const match = activeMembers.find(m =>
      m.full_name.toLowerCase().includes(pending.entered_name.toLowerCase().split(' ')[0])
    );
    setTargetMemberId(match?.id || (activeMembers[0]?.id ?? ''));
  };

  const handleOpenCreateNew = (pending: PendingMember) => {
    setSelectedPending(pending);
    setResolutionMode('new');
    setNewMemberName(pending.entered_name);
    setNewMemberPhone(pending.phone || '');
    setNewMemberDept('General');
  };

  const handleExecuteMerge = async () => {
    if (!selectedPending || !targetMemberId) return;
    await resolvePendingMemberAction(selectedPending.id, 'merge_existing', targetMemberId);
    setSelectedPending(null);
    setResolutionMode(null);
    onRefresh();
  };

  const handleExecuteCreateNew = async () => {
    if (!selectedPending || !newMemberName.trim()) return;
    await resolvePendingMemberAction(selectedPending.id, 'create_new', undefined, {
      full_name: newMemberName.trim(),
      phone: newMemberPhone.trim() || undefined,
      department: newMemberDept,
      gender: 'other',
    });
    setSelectedPending(null);
    setResolutionMode(null);
    onRefresh();
  };

  const handleDelete = async (pendingId: string, name: string) => {
    if (window.confirm(`Delete entry for "${name}"? This cannot be undone.`)) {
      await resolvePendingMemberAction(pendingId, 'delete');
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Pending Guests & Self Check-Ins</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review self-submitted names not found in the registry. Merge into existing members or register as new.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
            {pendingList.length} Awaiting Action
          </span>
        </div>
      </div>

      {/* Pending Items Grid */}
      {pendingList.length > 0 ? (
        <div className="space-y-3">
          {pendingList.map(pending => {
            const sess = sessions.find(s => s.id === pending.session_id);
            const ev = sess ? events.find(e => e.id === sess.event_id) : null;

            return (
              <div
                key={pending.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-slate-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">{pending.entered_name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                      Unverified Check-in
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {pending.phone && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Phone className="w-3 h-3 text-slate-500" /> {pending.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {ev?.name || 'Session'} • {sess?.session_date || 'Unknown Date'}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Submitted: {new Date(pending.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenMerge(pending)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs transition flex items-center gap-1.5 border border-slate-700"
                  >
                    <GitMerge className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Merge into Existing</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenCreateNew(pending)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-950"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add as New Member</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(pending.id, pending.entered_name)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-10 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
          <h3 className="text-base font-bold text-white mb-1">Queue is Clear!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            All guest submissions and self check-ins have been resolved into active members.
          </p>
        </div>
      )}

      {/* Merge Modal */}
      {resolutionMode === 'merge' && selectedPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setResolutionMode(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Merge into Known Member</h3>
            <p className="text-xs text-slate-400 mb-4">
              Link "<strong className="text-white">{selectedPending.entered_name}</strong>" to an existing profile. Attendance will be retroactively credited to that member.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter member names..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Target Member</label>
                <select
                  value={targetMemberId}
                  onChange={e => setTargetMemberId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                >
                  {activeMembers
                    .filter(m => m.full_name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.department || 'General'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolutionMode(null)}
                  className="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteMerge}
                  className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  Confirm Merge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Member Modal */}
      {resolutionMode === 'new' && selectedPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setResolutionMode(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Add to Permanent Roster</h3>
            <p className="text-xs text-slate-400 mb-4">
              Convert this guest entry into a permanent member and record attendance for this session.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newMemberPhone}
                  onChange={e => setNewMemberPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Unit / Department</label>
                <select
                  value={newMemberDept}
                  onChange={e => setNewMemberDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                >
                  <option value="General">General Congregation</option>
                  <option value="Choir">Choir</option>
                  <option value="Ushering">Ushering</option>
                  <option value="Media">Media</option>
                  <option value="Technical">Technical</option>
                  <option value="Welfare">Welfare</option>
                  <option value="Bible Study">Bible Study</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolutionMode(null)}
                  className="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCreateNew}
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  Save & Credit Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
