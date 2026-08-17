import React, { useState } from 'react';
import {
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
    <div className="space-y-6 w-full pb-16 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Missing Members</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Follow up with members who missed recent services.
          </p>
        </div>

        {/* Threshold selector */}
        <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-2xl border border-zinc-800 self-start sm:self-auto">
          <span className="text-xs font-bold text-zinc-400">Missed last:</span>
          <select
            value={inactivityThreshold}
            onChange={e => setInactivityThreshold(Number(e.target.value))}
            className="bg-zinc-950 border border-zinc-800 text-yellow-400 rounded-xl px-2.5 py-1 text-xs font-black focus:outline-none"
          >
            <option value={2}>2 Services</option>
            <option value={3}>3 Services</option>
            <option value={4}>4 Services</option>
            <option value={5}>5 Services</option>
          </select>
        </div>
      </div>

      {/* Department Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-[11px] text-zinc-500 font-semibold mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3 text-yellow-400" /> Unit:
        </span>
        {departments.map(dept => (
          <button
            key={dept}
            type="button"
            onClick={() => setDepartmentFilter(dept)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              departmentFilter === dept
                ? 'bg-yellow-400 text-black font-bold'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {dept === 'all' ? 'All Units' : dept}
          </button>
        ))}
      </div>

      {/* Missing Members List */}
      {filteredAlerts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map(alert => (
            <div
              key={alert.member.id}
              className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl transition shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-bold text-white text-base truncate">
                    {alert.member.full_name}
                  </div>
                  <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                    {alert.consecutive_missed} Missed
                  </span>
                </div>

                <div className="space-y-1 text-xs text-zinc-400 mb-4">
                  <div className="flex items-center justify-between">
                    <span>Unit:</span>
                    <span className="text-zinc-200 font-semibold">
                      {alert.member.department || 'General'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Attended:</span>
                    <span className="text-zinc-200 font-semibold">
                      {alert.last_attended_date || 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-800 flex items-center gap-2">
                {alert.member.phone ? (
                  <>
                    <a
                      href={`tel:${alert.member.phone}`}
                      className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Call</span>
                    </a>
                    <a
                      href={`https://wa.me/${alert.member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                        alert.member.full_name
                      )},%20we%20missed%20you%20at%20fellowship!%20Hope%20you%20are%20doing%20well.`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-yellow-950/40"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                  </>
                ) : (
                  <span className="text-[11px] text-zinc-500 italic py-1 text-center w-full">
                    No phone recorded
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-10 text-center bg-zinc-900 border border-zinc-800 rounded-3xl">
          <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center mx-auto mb-3 border border-yellow-400/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Everyone is Up to Date!</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            No active members have missed {inactivityThreshold} consecutive services.
          </p>
        </div>
      )}
    </div>
  );
};
