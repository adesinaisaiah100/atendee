import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  UserX,
  UserCheck,
  BarChart2,
  X,
  Check,
} from 'lucide-react';
import type { Member, AttendanceRecord, Session } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';

interface MemberManagementProps {
  fellowshipId: string;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  sessions: Session[];
  onRefresh: () => void;
  isAddModalOpen?: boolean;
  setIsAddModalOpen?: (open: boolean) => void;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({
  fellowshipId,
  members,
  attendanceRecords,
  sessions,
  onRefresh,
  isAddModalOpen: controlledAddOpen,
  setIsAddModalOpen: setControlledAddOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [internalAddOpen, setInternalAddOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingProfileMember, setViewingProfileMember] = useState<Member | null>(null);

  const isModalOpen = controlledAddOpen !== undefined ? controlledAddOpen : internalAddOpen;
  const setIsModalOpen = (open: boolean) => {
    if (setControlledAddOpen) setControlledAddOpen(open);
    else setInternalAddOpen(open);
  };

  // Simplified form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('General');

  const departments = ['all', 'Choir', 'Ushering', 'Media', 'Technical', 'Welfare', 'Bible Study', 'General'];

  const filteredMembers = useMemo(() => {
    return members
      .filter(m => {
        if (statusFilter === 'active' && !m.is_active) return false;
        if (statusFilter === 'inactive' && m.is_active) return false;
        if (selectedDept !== 'all' && m.department !== selectedDept) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            m.full_name.toLowerCase().includes(q) ||
            (m.phone && m.phone.includes(q)) ||
            (m.department && m.department.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [members, statusFilter, selectedDept, searchQuery]);

  const handleOpenAdd = () => {
    setFullName('');
    setPhone('');
    setDepartment('General');
    setEditingMember(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (member: Member) => {
    setFullName(member.full_name);
    setPhone(member.phone || '');
    setDepartment(member.department || 'General');
    setEditingMember(member);
    setIsModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    if (editingMember) {
      const updated: Member = {
        ...editingMember,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        department,
      };
      await db.members.put(updated);
      await queueMutation('member', 'update', updated);
    } else {
      const newMember: Member = {
        id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fellowship_id: fellowshipId,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        department,
        joined_at: new Date().toISOString().split('T')[0],
        is_active: true,
        created_at: new Date().toISOString(),
      };
      await db.members.put(newMember);
      await queueMutation('member', 'insert', newMember);
    }

    setIsModalOpen(false);
    onRefresh();
  };

  const handleToggleActive = async (member: Member) => {
    const updatedStatus = !member.is_active;
    const confirmMessage = updatedStatus
      ? `Reactivate ${member.full_name}? They will reappear on the check-in screen.`
      : `Soft-deactivate ${member.full_name}? They will be hidden from the active check-in list, but their past attendance is preserved.`;

    if (window.confirm(confirmMessage)) {
      await db.members.update(member.id, { is_active: updatedStatus });
      await queueMutation('member', 'update', { id: member.id, is_active: updatedStatus });
      onRefresh();
    }
  };

  // Compute stats for modal
  const profileStats = useMemo(() => {
    if (!viewingProfileMember) return null;
    const memberAtt = attendanceRecords.filter(r => r.member_id === viewingProfileMember.id);
    const closedSessions = sessions.filter(s => s.status === 'closed');
    const totalPossible = closedSessions.length;
    const attendedCount = memberAtt.length;
    const pct = totalPossible > 0 ? Math.round((attendedCount / totalPossible) * 100) : 0;

    return {
      attendedCount,
      totalPossible,
      pct,
    };
  }, [viewingProfileMember, attendanceRecords, sessions]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-black text-white">People &amp; Roster</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''} in list
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950 active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Add Member</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {/* Search box */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, unit..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            {(['active', 'inactive', 'all'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition ${
                  statusFilter === st
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'all' ? 'All' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Department Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] text-slate-500 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Unit:
          </span>
          {departments.map(dept => (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedDept === dept
                  ? 'bg-slate-700 text-emerald-400 border border-slate-600'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {dept === 'all' ? 'All Units' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-2">
        {filteredMembers.length > 0 ? (
          filteredMembers.map(member => (
            <div
              key={member.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-3.5 sm:p-4 rounded-2xl transition flex items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    member.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {member.full_name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm truncate flex items-center gap-2">
                    <span>{member.full_name}</span>
                    {!member.is_active && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 truncate mt-0.5">
                    <span className="text-slate-300 font-medium">
                      {member.department || 'General'}
                    </span>
                    {member.phone && (
                      <span className="text-slate-500">• {member.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Stats */}
                <button
                  type="button"
                  onClick={() => setViewingProfileMember(member)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 transition"
                  title="View Attendance Consistency"
                >
                  <BarChart2 className="w-4 h-4" />
                </button>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(member)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Edit Profile"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Deactivate / Reactivate */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(member)}
                  className={`p-2 rounded-xl transition ${
                    member.is_active
                      ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300'
                      : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400'
                  }`}
                  title={member.is_active ? 'Soft-Deactivate' : 'Reactivate'}
                >
                  {member.is_active ? (
                    <UserX className="w-4 h-4" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <h3 className="text-base font-bold text-white mb-1">No Members Found</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add your first member to build your fellowship roster.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow"
            >
              + Add Member Now
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Member Modal (Radically Simple) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-4">
              {editingMember ? 'Edit Member Details' : 'Add New Member'}
            </h3>

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Adebayo"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number <span className="text-slate-500 font-normal">(Optional, for WhatsApp / Calls)</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +234 803 123 4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Unit / Department / Role
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="General">General Member</option>
                  <option value="Choir">Choir</option>
                  <option value="Ushering">Ushering</option>
                  <option value="Media">Media</option>
                  <option value="Technical">Technical</option>
                  <option value="Welfare">Welfare</option>
                  <option value="Bible Study">Bible Study</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-extrabold text-xs shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Stats Scorecard Modal */}
      {viewingProfileMember && profileStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setViewingProfileMember(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black text-xl border border-emerald-500/30">
                {viewingProfileMember.full_name[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{viewingProfileMember.full_name}</h3>
                <p className="text-xs text-slate-400">
                  {viewingProfileMember.department || 'General'} • Added on {viewingProfileMember.joined_at}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Attendance Rate
                </span>
                <span className="text-2xl font-black text-emerald-400">
                  {profileStats.pct}%
                </span>
              </div>
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Services Attended
                </span>
                <span className="text-2xl font-black text-white">
                  {profileStats.attendedCount} / {profileStats.totalPossible}
                </span>
              </div>
            </div>

            {viewingProfileMember.phone && (
              <div className="p-3 bg-slate-800/60 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <span>Phone: {viewingProfileMember.phone}</span>
                <a
                  href={`tel:${viewingProfileMember.phone}`}
                  className="text-emerald-400 hover:underline font-bold"
                >
                  Call
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
