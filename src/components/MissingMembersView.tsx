import React, { useState } from 'react';
import {
  HeartHandshake,
  Phone,
  MessageCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import type { InactivityAlert } from '../types';

interface MissingMembersViewProps {
  inactivityAlerts: InactivityAlert[];
  inactivityThreshold: number;
  setInactivityThreshold: (threshold: number) => void;
}

export const MissingMembersView: React.FC<MissingMembersViewProps> = ({
  inactivityAlerts,
  inactivityThreshold,
  setInactivityThreshold,
}) => {
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const departments = ['all', 'Choir', 'Ushering', 'Media', 'Technical', 'Welfare', 'Bible Study', 'General'];

  const filteredAlerts = inactivityAlerts.filter(a => {
    if (departmentFilter === 'all') return true;
    return a.member.department === departmentFilter;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Missing Members (Pastoral Care)</h2>
              <p className="text-xs text-slate-400">
                Identify and follow up with members who haven't attended recent services.
              </p>
            </div>
          </div>
        </div>

        {/* Threshold selector */}
        <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700">
          <span className="text-xs font-semibold text-slate-400 pl-2">Missed last:</span>
          <select
            value={inactivityThreshold}
            onChange={e => setInactivityThreshold(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
          >
            <option value={2}>2 Services</option>
            <option value={3}>3 Services (Recommended)</option>
            <option value={4}>4 Services</option>
            <option value={5}>5 Services</option>
          </select>
        </div>
      </div>

      {/* Department Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-[11px] text-slate-500 font-semibold mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Unit:
        </span>
        {departments.map(dept => (
          <button
            key={dept}
            type="button"
            onClick={() => setDepartmentFilter(dept)}
            className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              departmentFilter === dept
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {dept === 'all' ? 'All Units' : dept}
          </button>
        ))}
      </div>

      {/* Missing Members List */}
      {filteredAlerts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map(alert => (
            <div
              key={alert.member.id}
              className="bg-slate-900 border border-amber-900/30 hover:border-amber-700/50 p-5 rounded-3xl transition shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-extrabold text-white text-base truncate">
                    {alert.member.full_name}
                  </div>
                  <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-950 text-rose-300 border border-rose-800 whitespace-nowrap">
                    {alert.consecutive_missed} Missed
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-400 mb-4">
                  <div className="flex items-center justify-between">
                    <span>Unit / Dept:</span>
                    <span className="text-slate-200 font-semibold">
                      {alert.member.department || 'General'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Attended:</span>
                    <span className="text-slate-200 font-semibold">
                      {alert.last_attended_date || 'Never recorded'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Overall Turnout:</span>
                    <span className="text-slate-200 font-semibold">
                      {alert.attendance_rate_pct}% ({alert.total_attended}/{alert.total_possible})
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                {alert.member.phone ? (
                  <>
                    <a
                      href={`tel:${alert.member.phone}`}
                      className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Call</span>
                    </a>
                    <a
                      href={`https://wa.me/${alert.member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                        alert.member.full_name
                      )},%20we%20missed%20you%20at%20fellowship!%20Hope%20you%20are%20doing%20well.`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 active:scale-95 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-emerald-800/50"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </a>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-500 italic py-1 text-center w-full">
                    No phone number recorded
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Praise God! All Members Active</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            No members have missed {inactivityThreshold} consecutive services.
          </p>
        </div>
      )}
    </div>
  );
};
