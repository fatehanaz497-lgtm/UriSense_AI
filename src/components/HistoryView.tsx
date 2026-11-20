import { useState } from 'react';
import { ArrowRight, FileText, Search } from 'lucide-react';
import type { UrinalysisTestRecord } from '../../shared/urinalysis.ts';
import { ParameterStatusText } from './StatusIndicator.tsx';

interface HistoryViewProps {
  tests: UrinalysisTestRecord[];
  onInspectResults: (test: UrinalysisTestRecord) => void;
  onViewReport: (test: UrinalysisTestRecord) => void;
}

export function HistoryView({ tests, onInspectResults, onViewReport }: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Normal' | 'Needs Review' | 'Abnormal'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'demo' | 'real'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'patient'>('newest');

  const filtered = tests
    .filter((t) => {
      if (statusFilter !== 'all' && t.overallStatus !== statusFilter) return false;
      if (modeFilter !== 'all' && t.mode !== modeFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        t.patientId.toLowerCase().includes(q) ||
        t.patientName.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      if (sortBy === 'patient') {
        return a.patientName.localeCompare(b.patientName);
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  return (
    <div className="space-y-5">
      {/* Search, Filter & Sort Controls */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-4 shadow-[0_1px_3px_rgba(22,75,120,0.05)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Patient ID, name, or Test ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter by status"
            className="px-3 py-2 text-xs bg-[#F8FBFF] border border-[#D6E4F0] rounded-lg text-[#24364B]"
          >
            <option value="all">All Statuses</option>
            <option value="Normal">Normal</option>
            <option value="Needs Review">Needs Review</option>
            <option value="Abnormal">Abnormal</option>
          </select>

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
            aria-label="Filter by mode"
            className="px-3 py-2 text-xs bg-[#F8FBFF] border border-[#D6E4F0] rounded-lg text-[#24364B]"
          >
            <option value="all">All Modes</option>
            <option value="demo">Demo Mode</option>
            <option value="real">Real IoT Mode</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="Sort results"
            className="px-3 py-2 text-xs bg-[#F8FBFF] border border-[#D6E4F0] rounded-lg text-[#24364B]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="patient">Patient Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#D6E4F0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#164B78]">Urinalysis History ({filtered.length})</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FBFF] border-b border-[#D6E4F0] text-[11px] font-semibold text-[#64748B]">
                <th className="py-3 px-4">Test ID</th>
                <th className="py-3 px-4">Patient ID &amp; Name</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Key Readings</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Overall Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EEF6] text-xs">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-[#F8FBFF] transition-colors">
                  <td className="py-3.5 px-4 font-mono tabular-nums font-semibold text-[#164B78]">{t.id}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#24364B]">{t.patientName}</div>
                    <div className="text-[11px] font-mono text-[#64748B]">{t.patientId}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-[#64748B]">
                    {new Date(t.timestamp).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-[#24364B]">
                    pH {t.readings.ph ?? '—'} · GLU {t.readings.glucose ?? '—'} · PRO {t.readings.protein ?? '—'}
                  </td>
                  <td className="py-3.5 px-4 text-[#64748B]">
                    {t.mode === 'demo' ? 'Simulated Demo' : 'Real IoT'}
                  </td>
                  <td className="py-3.5 px-4">
                    <ParameterStatusText status={t.overallStatus} />
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onViewReport(t)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#164B78] hover:text-[#2685D8] cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Report</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectResults(t)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2685D8] hover:text-[#164B78] cursor-pointer"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-[#64748B]">
                    No urinalysis tests match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
