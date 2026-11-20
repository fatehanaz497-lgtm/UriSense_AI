import { useState } from 'react';
import { Check, Copy, Cpu, Radio, RefreshCw, Send, Wifi } from 'lucide-react';
import {
  URINALYSIS_PARAMETERS,
  type DeviceStatusState,
  type ParameterKey,
  type PatientRecord,
} from '../../shared/urinalysis.ts';
import { api, type SystemSettingsDto } from '../lib/api.ts';
import { DeviceConnectionIndicator } from './StatusIndicator.tsx';

interface DeviceMonitoringViewProps {
  deviceStatus: DeviceStatusState;
  settings: SystemSettingsDto | null;
  patients: PatientRecord[];
  onRefresh: () => Promise<void>;
}

export function DeviceMonitoringView({
  deviceStatus,
  settings,
  patients,
  onRefresh,
}: DeviceMonitoringViewProps) {
  const [copied, setCopied] = useState(false);
  const [togglingChannel, setTogglingChannel] = useState<ParameterKey | null>(null);
  const [sendingTestPacket, setSendingTestPacket] = useState(false);
  const [packetFeedback, setPacketFeedback] = useState<string | null>(null);
  const [packetError, setPacketError] = useState<string | null>(null);

  const apiEndpointUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/urinalysis/readings` : '/api/urinalysis/readings';

  const esp32CodeSnippet = `// ESP32 Arduino Wi-Fi Telemetry Example for UriSense AI
#include <WiFi.h>
#include <HTTPClient.h>

const char* SERVER_URL = "${apiEndpointUrl}";
const char* DEVICE_KEY = "${settings?.deviceApiKey || 'urisense-esp32-dev-key'}";

void sendUrinalysisReading() {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  String payload = R"({
    "deviceId": "${deviceStatus.deviceId}",
    "patientId": "${patients[0]?.id || 'PATIENT-001'}",
    "mode": "real",
    "wifiRssi": -52,
    "firmwareVersion": "ESP32-S3 v1.4.2",
    "readings": {
      "glucose": "Negative",
      "protein": "Negative",
      "ph": 6.5,
      "ketones": "Negative",
      "blood": "Negative",
      "specificGravity": 1.015,
      "bilirubin": "Negative",
      "urobilinogen": 0.4,
      "nitrite": "Negative",
      "leukocytes": "Negative"
    }
  })";

  int code = http.POST(payload);
  http.end();
}`;

  async function handleCopySnippet() {
    try {
      await navigator.clipboard.writeText(esp32CodeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  }

  async function handleToggleChannel(key: ParameterKey) {
    setTogglingChannel(key);
    try {
      const updated = {
        ...deviceStatus.enabledChannels,
        [key]: !deviceStatus.enabledChannels[key],
      };
      await api.updateDeviceConfig({ enabledChannels: updated });
      await onRefresh();
    } finally {
      setTogglingChannel(null);
    }
  }

  async function handleSendEsp32Packet() {
    const targetPatient = patients[0]?.id;
    if (!targetPatient) {
      setPacketError('Please add at least one patient first.');
      return;
    }
    setSendingTestPacket(true);
    setPacketError(null);
    setPacketFeedback(null);
    try {
      const res = await api.sendTestReadingPayload({
        deviceId: deviceStatus.deviceId,
        patientId: targetPatient,
        mode: deviceStatus.mode,
        readings: {
          glucose: 'Negative',
          protein: 'Negative',
          ph: 6.5,
          ketones: 'Negative',
          blood: 'Negative',
          specificGravity: 1.018,
          bilirubin: 'Negative',
          urobilinogen: 0.4,
          nitrite: 'Negative',
          leukocytes: 'Negative',
        },
      });
      setPacketFeedback(
        `Packet accepted by /api/urinalysis/readings. Created ${res.test.id} (${res.test.mode.toUpperCase()} mode).`
      );
      await onRefresh();
    } catch (err) {
      setPacketError(err instanceof Error ? err.message : 'Failed to send reading packet.');
    } finally {
      setSendingTestPacket(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hardware Overview Card */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-4 bg-[#F8FBFF] border-b lg:border-b-0 lg:border-r border-[#D6E4F0] p-5 flex items-center justify-center">
          <img
            src="/src/assets/images/urisense_iot_analyzer_1795067621014.jpg"
            alt="UriSense ESP32 Smart Urinalysis Analyzer"
            referrerPolicy="no-referrer"
            className="w-full max-w-xs rounded-lg border border-[#D6E4F0] object-cover"
          />
        </div>

        <div className="lg:col-span-8 p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-[#2685D8] font-semibold">{deviceStatus.deviceId}</div>
              <h2 className="text-lg font-bold text-[#164B78] mt-0.5">ESP32 Optical Urinalysis Unit</h2>
              <p className="text-xs text-[#64748B] mt-1">
                {deviceStatus.mode === 'real'
                  ? 'Real IoT Mode: Live status reflects actual ESP32 Wi-Fi heartbeats and sensor uploads.'
                  : 'Demo Mode: Ready for simulated sample capture or live API payload testing.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <DeviceConnectionIndicator state={deviceStatus.connectionState} />
              <button
                type="button"
                onClick={onRefresh}
                className="p-2 rounded-lg border border-[#D6E4F0] text-[#164B78] hover:bg-[#EAF5FF] cursor-pointer"
                title="Refresh telemetry"
                aria-label="Refresh telemetry"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-[#E5EEF6]">
            <div>
              <div className="text-[11px] text-[#64748B]">Wi-Fi Signal</div>
              <div className="text-sm font-mono tabular-nums font-semibold text-[#164B78] mt-0.5 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-[#2685D8]" aria-hidden="true" />
                <span>{deviceStatus.wifiRssi !== null ? `${deviceStatus.wifiRssi} dBm` : '—'}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">Firmware</div>
              <div className="text-sm font-mono font-semibold text-[#164B78] mt-0.5">
                {deviceStatus.firmwareVersion}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">Last Heartbeat</div>
              <div className="text-xs font-mono tabular-nums font-medium text-[#24364B] mt-1">
                {deviceStatus.lastHeartbeatAt
                  ? new Date(deviceStatus.lastHeartbeatAt).toLocaleTimeString()
                  : 'No signal yet'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#64748B]">Last Reading</div>
              <div className="text-xs font-mono tabular-nums font-medium text-[#24364B] mt-1">
                {deviceStatus.lastReadingAt ? new Date(deviceStatus.lastReadingAt).toLocaleTimeString() : 'None'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5EEF6]">
            <div className="text-xs text-[#64748B]">
              Endpoint: <span className="font-mono text-[#164B78]">POST /api/urinalysis/readings</span>
            </div>
            <button
              type="button"
              onClick={handleSendEsp32Packet}
              disabled={sendingTestPacket}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{sendingTestPacket ? 'Sending...' : 'Send Test Telemetry Payload'}</span>
            </button>
          </div>

          {packetFeedback && (
            <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#16A34A]">
              {packetFeedback}
            </div>
          )}
          {packetError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
              {packetError}
            </div>
          )}
        </div>
      </div>

      {/* Configurable Hardware Sensor Channels & Live Telemetry Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#164B78]">Configured Strip Sensor Channels</h3>
              <p className="text-xs text-[#64748B]">
                Enable only parameters supported by your connected ESP32 optical strip reader.
              </p>
            </div>
            <Cpu className="w-4 h-4 text-[#2685D8]" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-4">
            {URINALYSIS_PARAMETERS.map((p) => {
              const active = deviceStatus.enabledChannels[p.key];
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={togglingChannel === p.key}
                  onClick={() => handleToggleChannel(p.key)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    active ? 'bg-[#EAF5FF]/60 border-[#64B5F6]' : 'bg-[#F8FAFC] border-[#E2E8F0] opacity-70'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-[#164B78]">{p.name}</div>
                    <div className="text-[11px] font-mono text-[#64748B]">{p.shortLabel}</div>
                  </div>
                  <span className={`text-[11px] font-semibold ${active ? 'text-[#16A34A]' : 'text-[#64748B]'}`}>
                    {active ? 'Enabled' : 'Disabled'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Telemetry Event Log */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#164B78]">Device Telemetry Log</h3>
              <p className="text-xs text-[#64748B]">Real-time connection and sample processing events</p>
            </div>
            <Radio className="w-4 h-4 text-[#2685D8]" aria-hidden="true" />
          </div>

          <div className="flex-1 max-h-72 overflow-y-auto divide-y divide-[#E5EEF6]">
            {deviceStatus.events.map((evt) => (
              <div key={evt.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="text-[#24364B] leading-relaxed">{evt.message}</div>
                <span className="font-mono tabular-nums text-[11px] text-[#64748B] shrink-0">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ESP32 Firmware Integration Snippet */}
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#164B78]">ESP32 Wi-Fi Integration Code (Arduino C++)</h3>
            <p className="text-xs text-[#64748B]">
              Flash this HTTP POST routine onto your ESP32 microcontroller to transmit real urinalysis sensor readings.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopySnippet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF5FF] hover:bg-[#DCEEFF] text-[#164B78] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-lg bg-[#F8FBFF] border border-[#D6E4F0] text-xs font-mono text-[#164B78] overflow-x-auto leading-relaxed">
          <code>{esp32CodeSnippet}</code>
        </pre>
      </div>
    </div>
  );
}
