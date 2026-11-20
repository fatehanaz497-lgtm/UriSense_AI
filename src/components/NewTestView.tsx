import { useState, type FormEvent } from 'react';
import { Cpu, FlaskConical, Play, WifiOff } from 'lucide-react';
import {
  createEmptyReadings,
  URINALYSIS_PARAMETERS,
  type DeviceStatusState,
  type OperationMode,
  type ParameterKey,
  type PatientRecord,
  type UrinalysisReadings,
  type UrinalysisTestRecord,
} from '../../shared/urinalysis.ts';
import { api } from '../lib/api.ts';
import { DeviceConnectionIndicator } from './StatusIndicator.tsx';

interface NewTestViewProps {
  patients: PatientRecord[];
  deviceStatus: DeviceStatusState;
  mode: OperationMode;
  preselectedPatientId?: string | null;
  onTestCreated: (test: UrinalysisTestRecord) => void;
  onGoToDeviceMonitoring: () => void;
}

export function NewTestView({
  patients,
  deviceStatus,
  mode,
  preselectedPatientId,
  onTestCreated,
  onGoToDeviceMonitoring,
}: NewTestViewProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    preselectedPatientId || patients[0]?.id || ''
  );
  const [captureMethod, setCaptureMethod] = useState<'iot' | 'manual'>(
    mode === 'demo' ? 'iot' : 'manual'
  );
  const [simPreset, setSimPreset] = useState<'normal' | 'glucose_alert' | 'uti_review'>('normal');
  const [readings, setReadings] = useState<UrinalysisReadings>(createEmptyReadings());
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateReading(key: ParameterKey, val: string) {
    const param = URINALYSIS_PARAMETERS.find((p) => p.key === key)!;
    if (val === '') {
      setReadings((prev) => ({ ...prev, [key]: null }));
      return;
    }
    if (param.inputType === 'number') {
      const num = Number(val);
      setReadings((prev) => ({ ...prev, [key]: Number.isNaN(num) ? null : num }));
    } else {
      setReadings((prev) => ({ ...prev, [key]: val }));
    }
  }

  async function handleSimulateDemo() {
    if (!selectedPatientId) {
      setError('Please select a patient first.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setWaitingMessage('Streaming simulated ESP32 sample over Wi-Fi...');
    try {
      const res = await api.simulateSample({ patientId: selectedPatientId, preset: simPreset });
      setWaitingMessage('Processing optical strip pads... Results will open automatically.');
      // Poll briefly in case SSE takes ~1.5s
      setTimeout(async () => {
        try {
          const fetched = await api.getTest(res.pendingTestId);
          setSubmitting(false);
          setWaitingMessage(null);
          onTestCreated(fetched.test);
        } catch {
          setSubmitting(false);
          setWaitingMessage(null);
        }
      }, 1700);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed.');
      setSubmitting(false);
      setWaitingMessage(null);
    }
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedPatientId) {
      setError('Please select a patient first.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createTest({
        patientId: selectedPatientId,
        readings,
        clinicianNotes,
        mode,
        source: 'manual',
      });
      onTestCreated(res.test);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save test.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Patient & Method Header Card */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5EEF6] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#164B78]">Start New Urinalysis Test</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Select a patient and choose ESP32 device capture or manual test strip entry.
            </p>
          </div>
          <DeviceConnectionIndicator state={deviceStatus.connectionState} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1.5">Select Patient</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
            >
              {patients.length === 0 && <option value="">No patients registered</option>}
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id}) · {p.age} yrs
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1.5">Capture Method</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#EAF5FF] rounded-lg border border-[#D6E4F0]">
              <button
                type="button"
                onClick={() => {
                  setCaptureMethod('iot');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  captureMethod === 'iot' ? 'bg-white text-[#164B78] shadow-xs' : 'text-[#24364B]'
                }`}
              >
                ESP32 IoT Capture
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaptureMethod('manual');
                  setError(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  captureMethod === 'manual' ? 'bg-white text-[#164B78] shadow-xs' : 'text-[#24364B]'
                }`}
              >
                Manual Strip Entry
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">{error}</div>
        )}
      </div>

      {/* ESP32 IoT Capture Panel */}
      {captureMethod === 'iot' && (
        <div className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
          {mode === 'real' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-[#F8FBFF] border border-[#D6E4F0]">
                {deviceStatus.connectionState === 'Device Disconnected' ? (
                  <WifiOff className="w-6 h-6 text-[#DC2626] shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <Cpu className="w-6 h-6 text-[#2685D8] shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-[#164B78]">
                    {deviceStatus.connectionState === 'Device Disconnected'
                      ? 'ESP32 Hardware Disconnected'
                      : `Listening for ${deviceStatus.deviceId}`}
                  </h3>
                  <p className="text-xs text-[#24364B] mt-1 leading-relaxed">
                    {deviceStatus.connectionState === 'Device Disconnected'
                      ? 'In Real IoT Mode, UriSense AI never invents or simulates sensor readings. Connect your ESP32 over Wi-Fi to POST readings to /api/urinalysis/readings, or switch to Manual Strip Entry above.'
                      : 'Insert the reagent strip into the analyzer tray and trigger capture on your ESP32 device. Results will appear here automatically as soon as the reading arrives.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onGoToDeviceMonitoring}
                      className="px-3.5 py-1.5 bg-white border border-[#D6E4F0] hover:bg-[#EAF5FF] text-[#164B78] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Open Device Monitoring &amp; Setup Guide
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#164B78]">Simulated ESP32 Sample Capture (Demo Mode)</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Select a demonstration strip profile to run through the live ESP32 data pipeline.
                  </p>
                </div>
                <span className="text-xs font-medium text-[#2685D8]">Mode: Simulated Demo</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'normal' as const,
                    title: 'Healthy Baseline Sample',
                    desc: 'All 10 measured parameters within normal reference ranges.',
                  },
                  {
                    id: 'glucose_alert' as const,
                    title: 'Elevated Glucose & Ketones',
                    desc: 'Simulates +2 glucose, trace protein, and small ketones for review.',
                  },
                  {
                    id: 'uti_review' as const,
                    title: 'Nitrite & Leukocytes Flag',
                    desc: 'Simulates positive nitrite, moderate leukocytes, and trace blood.',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSimPreset(opt.id)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      simPreset === opt.id
                        ? 'bg-[#EAF5FF] border-[#2685D8]'
                        : 'bg-white border-[#D6E4F0] hover:bg-[#F8FBFF]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#164B78]">{opt.title}</div>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {waitingMessage && (
                <div className="p-3.5 rounded-lg bg-[#EAF5FF] border border-[#64B5F6] text-xs font-medium text-[#164B78]">
                  {waitingMessage}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={submitting || !selectedPatientId}
                  onClick={handleSimulateDemo}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <Play className="w-4 h-4" aria-hidden="true" />
                  <span>{submitting ? 'Processing Sample...' : 'Run Simulated ESP32 Capture'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Strip Entry Panel */}
      {captureMethod === 'manual' && (
        <form
          onSubmit={handleManualSubmit}
          className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)] space-y-5"
        >
          <div>
            <h3 className="text-sm font-semibold text-[#164B78]">Manual Urinalysis Strip Entry</h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Leave any unsupported parameter blank—unmeasured fields are saved as null and never invented.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {URINALYSIS_PARAMETERS.map((param) => {
              const enabled = deviceStatus.enabledChannels[param.key];
              const currentVal = readings[param.key];
              return (
                <div
                  key={param.key}
                  className={`p-3.5 rounded-lg border ${
                    enabled ? 'bg-white border-[#D6E4F0]' : 'bg-[#F8FAFC] border-[#E2E8F0] opacity-65'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#164B78]">{param.name}</label>
                    <span className="text-[11px] font-mono text-[#64748B]">{param.unit}</span>
                  </div>

                  {param.inputType === 'select' ? (
                    <select
                      disabled={!enabled}
                      value={currentVal === null ? '' : String(currentVal)}
                      onChange={(e) => updateReading(param.key, e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-[#D6E4F0] rounded-md focus:outline-none focus:border-[#2685D8]"
                    >
                      <option value="">Not measured</option>
                      {param.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      disabled={!enabled}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      value={currentVal === null ? '' : String(currentVal)}
                      onChange={(e) => updateReading(param.key, e.target.value)}
                      placeholder={`Normal: ${param.referenceRange}`}
                      className="w-full px-2.5 py-2 text-xs font-mono bg-white border border-[#D6E4F0] rounded-md focus:outline-none focus:border-[#2685D8]"
                    />
                  )}
                  <div className="text-[11px] text-[#64748B] mt-1">Ref: {param.referenceRange}</div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1.5">Clinician Notes (Optional)</label>
            <textarea
              rows={2}
              value={clinicianNotes}
              onChange={(e) => setClinicianNotes(e.target.value)}
              placeholder="Add observations about sample clarity, color, or follow-up plan..."
              className="w-full px-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !selectedPatientId}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
            >
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Saving Results...' : 'Analyze & Save Test'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
