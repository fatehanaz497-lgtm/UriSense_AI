import { useState } from 'react';
import { Download, Droplets, Printer } from 'lucide-react';
import {
  buildEducationalSummary,
  evaluateAllReadings,
  type PatientRecord,
  type UrinalysisTestRecord,
} from '../../shared/urinalysis.ts';
import { api } from '../lib/api.ts';
import { ParameterStatusText } from './StatusIndicator.tsx';

interface ReportsViewProps {
  tests: UrinalysisTestRecord[];
  patients: PatientRecord[];
  selectedTest: UrinalysisTestRecord | null;
  onSelectTest: (test: UrinalysisTestRecord) => void;
}

export function ReportsView({ tests, patients, selectedTest, onSelectTest }: ReportsViewProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeTest = selectedTest || tests[0] || null;
  const patient = activeTest ? patients.find((p) => p.id === activeTest.patientId) : undefined;

  if (!activeTest) {
    return (
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-10 text-center">
        <p className="text-sm text-[#64748B]">No urinalysis reports available yet.</p>
      </div>
    );
  }

  const evaluated = evaluateAllReadings(activeTest.readings);
  const summary = buildEducationalSummary(activeTest.readings);

  async function handleExportPdf() {
    if (!activeTest) return;
    setDownloading(true);
    setError(null);
    try {
      await api.downloadPdfReport(activeTest.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-4 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#164B78]">Select Report:</label>
          <select
            value={activeTest.id}
            onChange={(e) => {
              const found = tests.find((t) => t.id === e.target.value);
              if (found) onSelectTest(found);
            }}
            className="px-3 py-1.5 text-xs bg-[#F8FBFF] border border-[#D6E4F0] rounded-lg text-[#24364B]"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.patientName} ({new Date(t.timestamp).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{downloading ? 'Generating PDF...' : 'Download Official PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#EAF5FF] hover:bg-[#DCEEFF] text-[#164B78] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] no-print">
          {error}
        </div>
      )}

      {/* Printable Clinical Report Sheet */}
      <article className="bg-white rounded-xl border border-[#D6E4F0] shadow-[0_2px_10px_rgba(22,75,120,0.06)] overflow-hidden print-container">
        {/* Header */}
        <div className="bg-[#164B78] text-white px-7 py-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2685D8] flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">UriSense AI</div>
              <div className="text-xs text-[#EAF5FF]">Smart AIoT Urinalysis Clinical Report</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono font-semibold text-[#EAF5FF]">
              {activeTest.mode === 'demo' ? 'SIMULATED DEMO REPORT' : 'VERIFIED HARDWARE REPORT'}
            </div>
            <div className="text-xs font-mono text-white/80 mt-0.5">{activeTest.id}</div>
          </div>
        </div>

        <div className="p-7 space-y-6">
          {/* Patient & Test Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8FBFF] border border-[#D6E4F0] text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-[#164B78] mb-1.5">Patient Information</div>
              <div>
                <span className="text-[#64748B]">Name: </span>
                <span className="font-semibold text-[#24364B]">{patient?.name ?? activeTest.patientName}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Patient ID: </span>
                <span className="font-mono text-[#24364B]">{activeTest.patientId}</span>
              </div>
              <div>
                <span className="text-[#64748B]">Age / Gender: </span>
                <span className="text-[#24364B]">
                  {patient ? `${patient.age} years · ${patient.gender}` : 'Not specified'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-semibold text-[#164B78] mb-1.5">Test Metadata</div>
              <div>
                <span className="text-[#64748B]">Test Date: </span>
                <span className="font-mono tabular-nums text-[#24364B]">
                  {new Date(activeTest.timestamp).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div>
                <span className="text-[#64748B]">Device ID: </span>
                <span className="font-mono text-[#24364B]">{activeTest.deviceId}</span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[#64748B]">Overall Status:</span>
                <ParameterStatusText status={activeTest.overallStatus} />
              </div>
            </div>
          </div>

          {/* Parameters Table */}
          <div className="overflow-x-auto border border-[#D6E4F0] rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EAF5FF] border-b border-[#D6E4F0] text-[11px] font-semibold text-[#164B78]">
                  <th className="py-2.5 px-4">Parameter</th>
                  <th className="py-2.5 px-4">Measured Result</th>
                  <th className="py-2.5 px-4">Reference Range</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EEF6] text-xs">
                {evaluated.map((item) => (
                  <tr key={item.definition.key}>
                    <td className="py-2.5 px-4 font-semibold text-[#164B78]">{item.definition.name}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#24364B]">{item.displayValue}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#64748B]">
                      {item.definition.referenceRange}
                    </td>
                    <td className="py-2.5 px-4">
                      <ParameterStatusText status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Educational Interpretation */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#164B78]">Educational Interpretation</h3>
            <p className="text-xs text-[#24364B] leading-relaxed">{summary}</p>
            {activeTest.clinicianNotes && (
              <div className="pt-2">
                <h4 className="text-xs font-bold text-[#164B78]">Clinician Notes</h4>
                <p className="text-xs text-[#24364B] mt-1 leading-relaxed">{activeTest.clinicianNotes}</p>
              </div>
            )}
          </div>

          {/* Medical Disclaimer */}
          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#D6E4F0] text-[11px] text-[#64748B] leading-relaxed">
            <span className="font-semibold text-[#164B78]">Medical Disclaimer: </span>
            This report is produced by UriSense AI for educational and preliminary screening support only. It is not a
            definitive medical diagnosis. Please review all findings with a licensed physician or qualified healthcare
            professional.
          </div>
        </div>
      </article>
    </div>
  );
}
