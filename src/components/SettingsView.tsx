import { useState, type FormEvent } from 'react';
import { BookOpen, Download, Save, Shield } from 'lucide-react';
import { api, type SystemSettingsDto } from '../lib/api.ts';
import type { OperationMode } from '../../shared/urinalysis.ts';

interface SettingsViewProps {
  settings: SystemSettingsDto | null;
  onUpdated: () => Promise<void>;
}

export function SettingsView({ settings, onUpdated }: SettingsViewProps) {
  const [mode, setMode] = useState<OperationMode>(settings?.mode || 'demo');
  const [deviceId, setDeviceId] = useState(settings?.deviceId || 'URISENSE-001');
  const [deviceApiKey, setDeviceApiKey] = useState(settings?.deviceApiKey || 'urisense-esp32-dev-key');
  const [clinicName, setClinicName] = useState(settings?.clinicName || 'UriSense Clinical Diagnostics Lab');
  const [timeoutSec, setTimeoutSec] = useState(String(settings?.heartbeatTimeoutSeconds || 30));
  const [saving, setSaving] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      await api.updateDeviceConfig({
        mode,
        deviceId,
        deviceApiKey,
        clinicName,
        heartbeatTimeoutSeconds: Number(timeoutSec) || 30,
      });
      await onUpdated();
      setFeedback('System and ESP32 settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)] space-y-5"
      >
        <div className="flex items-center justify-between border-b border-[#E5EEF6] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#164B78]">System &amp; IoT Device Configuration</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Configure operation mode, ESP32 device credentials, and heartbeat timeout thresholds.
            </p>
          </div>
          <Shield className="w-5 h-5 text-[#2685D8]" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1">Operation Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as OperationMode)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
            >
              <option value="demo">Demo Mode (Simulated Samples)</option>
              <option value="real">Real IoT Mode (Physical ESP32 Hardware)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1">Clinic / Lab Name</label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1">Primary ESP32 Device ID</label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1">
              ESP32 Device Key (x-device-key header)
            </label>
            <input
              type="text"
              value={deviceApiKey}
              onChange={(e) => setDeviceApiKey(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24364B] mb-1">
              Heartbeat Timeout (Seconds)
            </label>
            <input
              type="number"
              min={10}
              max={300}
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-[#D6E4F0] rounded-lg focus:outline-none focus:border-[#2685D8]"
            />
          </div>
        </div>

        {feedback && <div className="text-xs font-medium text-[#16A34A]">{feedback}</div>}
        {error && <div className="text-xs font-medium text-[#DC2626]">{error}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* REST API Documentation */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)] space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E5EEF6] pb-3">
          <BookOpen className="w-4 h-4 text-[#2685D8]" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-[#164B78]">Backend REST API Reference</h3>
        </div>

        <div className="space-y-2.5 text-xs">
          {[
            { method: 'POST', path: '/api/urinalysis/readings', desc: 'ESP32 hardware ingestion (supports partial/null sensor values)' },
            { method: 'POST', path: '/api/device/heartbeat', desc: 'Updates ESP32 Wi-Fi RSSI, firmware, and live connection state' },
            { method: 'GET', path: '/api/device/stream', desc: 'Server-Sent Events (SSE) stream for live telemetry & test arrival' },
            { method: 'GET / POST', path: '/api/patients', desc: 'List or register patient records' },
            { method: 'GET / POST', path: '/api/tests', desc: 'Retrieve or save urinalysis tests' },
            { method: 'GET', path: '/api/reports/:testId/pdf', desc: 'Generate and stream clinical PDF report' },
            { method: 'POST', path: '/api/chats/:id/messages', desc: 'Send message to Gemini-powered UriSense Assistant' },
          ].map((ep) => (
            <div
              key={ep.path}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-[#F8FBFF] border border-[#E5EEF6]"
            >
              <div className="font-mono font-semibold text-[#164B78]">
                <span className="text-[#2685D8] mr-2">{ep.method}</span>
                {ep.path}
              </div>
              <div className="text-[#64748B]">{ep.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Project Source Export */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-6 shadow-[0_1px_3px_rgba(22,75,120,0.05)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#164B78]">Export Full Project Source (.zip)</h3>
          <p className="text-xs text-[#64748B] mt-1">
            Download the complete UriSense AI frontend, Express backend, shared logic, and configuration files as a
            clean ZIP archive.
          </p>
        </div>
        <button
          type="button"
          disabled={downloadingZip}
          onClick={async () => {
            setDownloadingZip(true);
            setError(null);
            try {
              await api.downloadProjectZip();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to download project ZIP.');
            } finally {
              setDownloadingZip(false);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>{downloadingZip ? 'Preparing ZIP...' : 'Download Project ZIP'}</span>
        </button>
      </div>
    </div>
  );
}
