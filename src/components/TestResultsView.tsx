import { useEffect, useState } from 'react';
import { Bot, Download, FlaskConical, History, Printer, Save } from 'lucide-react';
import {
  buildEducationalSummary,
  evaluateAllReadings,
  type PatientRecord,
  type UrinalysisTestRecord,
} from '../../shared/urinalysis.ts';
import { api } from '../lib/api.ts';
import { ParameterStatusText } from './StatusIndicator.tsx';

interface TestResultsViewProps {
  test: UrinalysisTestRecord | null;
  patient: PatientRecord | null;
  allTests: UrinalysisTestRecord[];
  onSelectTest: (test: UrinalysisTestRecord) => void;
  onStartNewTest: () => void;
  onViewHistory: () => void;
  onAskAssistant: (test: UrinalysisTestRecord) => void;
  onTestUpdated: (test: UrinalysisTestRecord) => void;
}

export function TestResultsView({
  test,
  patient,
  allTests,
  onSelectTest,
  onStartNewTest,
  onViewHistory,
  onAskAssistant,
  onTestUpdated,
}: TestResultsViewProps) {
  const [notes, setNotes] = useState(test?.clinicianNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(test?.clinicianNotes ?? '');
    setSaveFeedback(null);
    setError(null);
  }, [test?.id, test?.clinicianNotes]);

  if (!test) {
    return (
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-10 text-center max-w-2xl mx-auto">
        <FlaskConical className="w-10 h-10 text-[#64B5F6] mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[#164B78]">No Urinalysis Test Selected</h2>
        <p className="text-xs text-[#64748B] mt-1 mb-5">
          Run a new urine test or pick a previous test from history to inspect all 10 parameters.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStartNewTest}
            className="px-4 py-2 bg-[#2685D8] text-white text-xs font-semibold rounded-lg hover:bg-[#164B78] transition-colors cursor-pointer"
          >
            Start New Test
          </button>
          <button
            type="button"
            onClick={onViewHistory}
            className="px-4 py-2 bg-[#EAF5FF] text-[#164B78] text-xs font-semibold rounded-lg hover:bg-[#DCEEFF] transition-colors cursor-pointer"
          >
            View Previous Tests
          </button>
        </div>
      </div>
    );
  }

  const evaluated = evaluateAllReadings(test.readings);
  const supportedOnly = evaluated.filter((e) => e.status !== 'Not Measured');
  const educationalSummary = buildEducationalSummary(test.readings);

  async function handleSaveNotes() {
    if (!test) return;
    setSaving(true);
    setError(null);
    setSaveFeedback(null);
    try {
      const res = await api.updateTest(test.id, { clinicianNotes: notes, saved: true });
      onTestUpdated(res.test);
      setSaveFeedback('Test results and notes saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!test) return;
    setPdfLoading(true);
    setError(null);
    try {
      await api.downloadPdfReport(test.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF.');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-6 print-container">
      {/* Header & Action Toolbar */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
              <span className="font-mono font-semibold text-[#164B78]">{test.id}</span>
              <span aria-hidden="true">·</span>
              <span>{test.mode === 'demo' ? 'Simulated Demo Data' : 'Verified Real IoT / Clinical Data'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {new Date(test.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#164B78] mt-1">
              {patient?.name ?? test.patientName}{' '}
              <span className="text-sm font-normal text-[#64748B] font-mono">({test.patientId})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <div className="text-xs text-[#24364B]">
                Overall Screening Status: <ParameterStatusText status={test.overallStatus} />
              </div>
              <div className="text-xs text-[#64748B] font-mono">Device: {test.deviceId}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <select
              value={test.id}
              onChange={(e) => {
                const found = allTests.find((t) => t.id === e.target.value);
                if (found) onSelectTest(found);
              }}
              aria-label="Switch test record"
              className="px-3 py-2 text-xs bg-[#F8FBFF] border border-[#D6E4F0] rounded-lg text-[#164B78] font-medium"
            >
              {allTests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} · {t.patientName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onStartNewTest}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#EAF5FF] hover:bg-[#DCEEFF] text-[#164B78] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Start New Test</span>
            </button>

            <button
              type="button"
              onClick={onViewHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#D6E4F0] hover:bg-[#F8FBFF] text-[#24364B] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Previous Tests</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{pdfLoading ? 'Generating PDF...' : 'Export PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#D6E4F0] hover:bg-[#F8FBFF] text-[#24364B] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Educational Summary & Assistant CTA */}
        <div className="mt-5 pt-5 border-t border-[#E5EEF6] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold text-[#164B78]">Educational Summary</div>
            <p className="text-xs text-[#24364B] mt-1 leading-relaxed">{educationalSummary}</p>
          </div>
          <button
            type="button"
            onClick={() => onAskAssistant(test)}
            className="no-print inline-flex items-center gap-2 px-4 py-2.5 bg-[#EAF5FF] hover:bg-[#DCEEFF] text-[#164B78] border border-[#64B5F6] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bot className="w-4 h-4 text-[#2685D8]" aria-hidden="true" />
            <span>Ask UriSense Assistant About This Result</span>
          </button>
        </div>
      </div>

      {/* Detailed Results Table */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D6E4F0] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#164B78]">Detailed Urinalysis Parameter Table</h3>
            <p className="text-xs text-[#64748B]">
              Showing {supportedOnly.length} measured parameters out of 10 supported strip channels
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FBFF] border-b border-[#D6E4F0] text-[11px] font-semibold text-[#64748B]">
                <th className="py-3 px-5">Parameter</th>
                <th className="py-3 px-5">Measured Value</th>
                <th className="py-3 px-5">Reference Range</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Short Educational Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EEF6] text-xs">
              {evaluated.map((item) => {
                const rowTint =
                  item.status === 'Abnormal'
                    ? 'bg-[#FEF2F2]/40'
                    : item.status === 'Needs Review'
                      ? 'bg-[#FFFBEB]/45'
                      : '';
                return (
                  <tr key={item.definition.key} className={rowTint}>
                    <td className="py-3.5 px-5 font-semibold text-[#164B78] whitespace-nowrap">
                      {item.definition.name}
                    </td>
                    <td className="py-3.5 px-5 font-mono tabular-nums font-medium text-[#24364B] whitespace-nowrap">
                      {item.displayValue}
                    </td>
                    <td className="py-3.5 px-5 font-mono tabular-nums text-[#64748B] whitespace-nowrap">
                      {item.definition.referenceRange}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <ParameterStatusText status={item.status} />
                    </td>
                    <td className="py-3.5 px-5 text-[#24364B] leading-relaxed max-w-md">
                      {item.definition.explanation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Clinician Notes */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)] no-print">
        <h3 className="text-sm font-semibold text-[#164B78] mb-2">Clinician Observations &amp; Save</h3>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Document clinical observations, hydration advice, or follow-up testing recommendations..."
          className="w-full px-3.5 py-2.5 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
        />
        {error && <p className="text-xs text-[#DC2626] mt-2">{error}</p>}
        {saveFeedback && <p className="text-xs text-[#16A34A] mt-2 font-medium">{saveFeedback}</p>}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Test Results'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
