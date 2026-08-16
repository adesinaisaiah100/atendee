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
import type { Member, Gender, AttendanceRecord, Session } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';

interface MemberManagementProps {
  fellowshipId: string;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  sessions: Session[];
  onRefresh: () => void;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({
  fellowshipId,
  members,
  attendanceRecords,
  sessions,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingProfileMember, setViewingProfileMember] = useState<Member | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState<{
    full_name: string;
    phone: string;
    gender: Gender;
    department: string;
    joined_at: string;
  }>({
    full_name: '',
    phone: '',
    gender: 'male',
    department: 'General',
    joined_at: new Date().toISOString().split('T')[0],
  });

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
    setFormData({
      full_name: '',
      phone: '',
      gender: 'male',
      department: 'General',
      joined_at: new Date().toISOString().split('T')[0],
    });
    setEditingMember(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (member: Member) => {
    setFormData({
      full_name: member.full_name,
      phone: member.phone || '',
      gender: member.gender || 'male',
      department: member.department || 'General',
      joined_at: member.joined_at || new Date().toISOString().split('T')[0],
    });
    setEditingMember(member);
    setIsAddModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) return;

    if (editingMember) {
      // Update
      const updated: Member = {
        ...editingMember,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || undefined,
        gender: formData.gender,
        department: formData.department,
        joined_at: formData.joined_at,
      };
      await db.members.put(updated);
      await queueMutation('member', 'update', updated);
    } else {
      // Add
      const newMember: Member = {
        id: `m-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        fellowship_id: fellowshipId,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || undefined,
        gender: formData.gender,
        department: formData.department,
        joined_at: formData.joined_at,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      await db.members.put(newMember);
      await queueMutation('member', 'insert', newMember);
    }

    setIsAddModalOpen(false);
    onRefresh();
  };

  const handleToggleActive = async (member: Member) => {
    const updatedStatus = !member.is_active;
    const confirmMessage = updatedStatus
      ? `Reactivate ${member.full_name}? They will reappear on the check-in screen and absence calculations.`
      : `Soft-deactivate ${member.full_name}? They will be hidden from the active check-in list, but their historical attendance records will remain 100% intact.`;

    if (window.confirm(confirmMessage)) {
      await db.members.update(member.id, { is_active: updatedStatus });
      await queueMutation('member', 'update', { id: member.id, is_active: updatedStatus });
      onRefresh();
    }
  };

  // Compute profile stats for modal
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
      records: memberAtt,
    };
  }, [viewingProfileMember, attendanceRecords, sessions]);

  return (
    <div className="space-y-6">
      {/* Header & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Member Roster & Registry</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage known fellowship members, departments, and active statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Member</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search box */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or unit..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            {(['active', 'inactive', 'all'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg capitalize transition ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'all' ? 'All (Both)' : st}
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
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedDept === dept
                  ? 'bg-slate-700 text-emerald-400 border border-slate-600'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {dept === 'all' ? 'All Units' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* Members Grid / Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filteredMembers.length} members</span>
          <span>Never hard-deleted (historical integrity preserved)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Unit / Dept</th>
                <th className="py-3 px-4 font-semibold">Phone</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Joined Date</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMembers.map(member => (
                <tr key={member.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          member.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {member.full_name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{member.full_name}</div>
                        <div className="text-[11px] text-slate-500 capitalize">{member.gender || 'member'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs">
                      {member.department || 'General'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                    {member.phone || '—'}
                  </td>
                  <td className="py-3 px-4">
                    {member.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500">
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{member.joined_at}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Attendance Profile Modal Trigger */}
                      <button
                        type="button"
                        onClick={() => setViewingProfileMember(member)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="View Attendance History"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(member)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Deactivate / Reactivate Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(member)}
                        className={`p-1.5 rounded-lg transition ${
                          member.is_active
                            ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300'
                            : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-300'
                        }`}
                        title={member.is_active ? 'Soft-Deactivate Member' : 'Reactivate Member'}
                      >
                        {member.is_active ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-4">
              {editingMember ? 'Edit Member Profile' : 'Add New Member'}
            </h3>

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oluwatimileyin Isaiah"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+234 802 345 6789"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as Gender })}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Unit / Dept</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {departments.filter(d => d !== 'all').map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Joined Date
                </label>
                <input
                  type="date"
                  value={formData.joined_at}
                  onChange={e => setFormData({ ...formData, joined_at: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Profile Stats Modal */}
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
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-lg">
                {viewingProfileMember.full_name[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{viewingProfileMember.full_name}</h3>
                <p className="text-xs text-slate-400">
                  {viewingProfileMember.department} Unit • Joined {viewingProfileMember.joined_at}
                </p>
              </div>
            </div>

            {/* Metric highlight */}
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
                  Attended Count
                </span>
                <span className="text-2xl font-black text-white">
                  {profileStats.attendedCount} / {profileStats.totalPossible}
                </span>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div className="mb-4">
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${profileStats.pct}%` }}
                />
              </div>
            </div>

            {viewingProfileMember.phone && (
              <div className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <span>Phone: {viewingProfileMember.phone}</span>
                <a
                  href={`tel:${viewingProfileMember.phone}`}
                  className="text-emerald-400 hover:underline font-semibold"
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
