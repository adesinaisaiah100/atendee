import React, { useState } from 'react';
import { Layers, Plus, Calendar, Trash2, X } from 'lucide-react';
import type { Term } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface TermsManagerProps {
  fellowshipId: string;
  terms: Term[];
  onRefresh: () => void;
}

export const TermsManager: React.FC<TermsManagerProps> = ({
  fellowshipId,
  terms,
  onRefresh,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [termName, setTermName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termName.trim() || !startDate || !endDate) return;

    const newTerm: Term = {
      id: crypto.randomUUID(),
      fellowship_id: fellowshipId,
      name: termName.trim(),
      start_date: startDate,
      end_date: endDate,
      created_at: new Date().toISOString(),
    };

    await db.terms.put(newTerm);
    await queueMutation('term', 'insert', newTerm);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('terms').insert(newTerm);
      } catch (err) {
        console.warn('Direct term insert error:', err);
      }
    }
    setIsAddOpen(false);
    setTermName('');
    setStartDate('');
    setEndDate('');
    onRefresh();
  };

  const handleDeleteTerm = async (termId: string, name: string) => {
    if (window.confirm(`Delete reporting term "${name}"? Historical attendance records are unaffected.`)) {
      await db.terms.delete(termId);
      await queueMutation('term', 'delete', { id: termId });
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('terms').delete().eq('id', termId);
        } catch (err) {
          console.warn('Direct term delete error:', err);
        }
      }
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Terms & Semesters</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Define academic terms, quarters, or semesters to bucket reporting periods.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-950"
        >
          <Plus className="w-4 h-4" />
          <span>Add Term / Semester</span>
        </button>
      </div>

      {/* Terms List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {terms.map(term => {
          const isCurrent =
            new Date().toISOString().split('T')[0] >= term.start_date &&
            new Date().toISOString().split('T')[0] <= term.end_date;

          return (
            <div
              key={term.id}
              className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                isCurrent
                  ? 'bg-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-950/20'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-bold text-white text-base">{term.name}</span>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                      Active Term
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs text-slate-400 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {term.start_date} to {term.end_date}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleDeleteTerm(term.id, term.name)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition"
                  title="Delete Term"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Term Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Define Reporting Term</h3>
            <form onSubmit={handleCreateTerm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Term / Semester Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026 Harmattan Semester"
                  value={termName}
                  onChange={e => setTermName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  Save Term
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
