import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FlaskConical,
  AlertTriangle,
  Users,
} from 'lucide-react';
import type { DashboardSummaryDto } from '../lib/api.ts';
import type { OperationMode, UrinalysisTestRecord } from '../../shared/urinalysis.ts';
import { DeviceConnectionIndicator, ParameterStatusText } from './StatusIndicator.tsx';

interface DashboardViewProps {
  summary: DashboardSummaryDto | null;
  loading: boolean;
  mode: OperationMode;
  onSelectTest: (test: UrinalysisTestRecord) => void;
  onStartNewTest: () => void;
  onGoToDeviceMonitoring: () => void;
  onGoToPatients: () => void;
}

export function DashboardView({
  summary,
  loading,
  mode,
  onSelectTest,
  onStartNewTest,
  onGoToDeviceMonitoring,
  onGoToPatients,
}: DashboardViewProps) {
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'weekly'>('daily');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [hoveredLineIdx, setHoveredLineIdx] = useState<number | null>(null);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-white rounded-xl border border-[#D6E4F0] animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white rounded-xl border border-[#D6E4F0] animate-pulse" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-[#D6E4F0] p-8 text-center">
        <p className="text-sm text-[#64748B]">Unable to load dashboard summary.</p>
      </div>
    );
  }

  const bars = chartPeriod === 'daily' ? summary.dailyStats : summary.weeklyStats;
  const maxBarTotal = Math.max(4, ...bars.map((b) => b.total));
  const trends = summary.parameterTrends;

  return (
    <div className="space-y-6">
      {/* Mode Notice Banner (Simple, Non-intrusive) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#EAF5FF] border border-[#D6E4F0] rounded-xl px-5 py-3.5">
        <div>
          <div className="text-xs font-semibold text-[#164B78]">
            {mode === 'demo'
              ? 'Demo Mode Active — Displaying Simulated Sample Data'
              : 'Real IoT Mode Active — Displaying Verified ESP32 Hardware Readings Only'}
          </div>
          <p className="text-xs text-[#24364B] mt-0.5">
            {mode === 'demo'
              ? 'Use Demo Mode to explore simulated urinalysis workflows. Switch to Real IoT Mode in the top bar when connecting a physical ESP32 device.'
              : summary.deviceStatus.connectionState === 'Device Disconnected'
                ? 'No ESP32 device is currently sending heartbeats. Connect your ESP32 hardware on the Device Monitoring page to stream live tests.'
                : `Connected to ${summary.deviceStatus.deviceId}. Live sample readings will appear automatically.`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onStartNewTest}
            className="px-4 py-2 bg-[#2685D8] hover:bg-[#164B78] text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            New Urine Test
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-2">
            <span>Total Urine Tests</span>
            <Activity className="w-4 h-4 text-[#2685D8]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#164B78]">
            {summary.kpis.totalTests}
          </div>
          <div className="text-xs text-[#64748B] mt-1.5">
            {mode === 'demo' ? 'Simulated demo tests' : 'Hardware & manual tests'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-2">
            <span>Normal Results</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#16A34A]">
            {summary.kpis.normalTests}
          </div>
          <div className="text-xs text-[#64748B] mt-1.5">
            {summary.kpis.totalTests > 0
              ? `${Math.round((summary.kpis.normalTests / summary.kpis.totalTests) * 100)}% within reference range`
              : 'No tests recorded yet'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-2">
            <span>Abnormal / Needs Review</span>
            <AlertTriangle className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
          </div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#D97706]">
            {summary.kpis.abnormalOrReviewTests}
          </div>
          <div className="text-xs text-[#64748B] mt-1.5">Flagged for clinician follow-up</div>
        </div>

        <button
          type="button"
          onClick={onGoToDeviceMonitoring}
          className="text-left bg-white hover:bg-[#F8FBFF] rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B] mb-2">
            <span>ESP32 IoT Device</span>
            <Cpu className="w-4 h-4 text-[#2685D8]" aria-hidden="true" />
          </div>
          <div className="mt-1">
            <DeviceConnectionIndicator state={summary.deviceStatus.connectionState} />
          </div>
          <div className="text-xs text-[#64748B] mt-2.5 font-mono tabular-nums truncate">
            {summary.deviceStatus.deviceId}
            {summary.deviceStatus.wifiRssi !== null ? ` · ${summary.deviceStatus.wifiRssi} dBm` : ''}
          </div>
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily / Weekly Test Volume Chart */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#164B78]">Urinalysis Test Statistics</h2>
              <p className="text-xs text-[#64748B]">Normal vs. flagged results over time</p>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-[#EAF5FF] rounded-lg border border-[#D6E4F0]">
              <button
                type="button"
                onClick={() => setChartPeriod('daily')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  chartPeriod === 'daily' ? 'bg-white text-[#164B78] font-semibold shadow-xs' : 'text-[#24364B]'
                }`}
              >
                Daily (7d)
              </button>
              <button
                type="button"
                onClick={() => setChartPeriod('weekly')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  chartPeriod === 'weekly' ? 'bg-white text-[#164B78] font-semibold shadow-xs' : 'text-[#24364B]'
                }`}
              >
                Weekly (4w)
              </button>
            </div>
          </div>

          <div className="relative h-56">
            <svg viewBox="0 0 560 200" className="w-full h-full overflow-visible" role="img" aria-label="Urinalysis test volume chart">
              {/* Horizontal grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 165 - ratio * 135;
                const val = Math.round(ratio * maxBarTotal);
                return (
                  <g key={idx}>
                    <line x1={38} y1={y} x2={545} y2={y} stroke="#E5EEF6" strokeWidth={1} />
                    <text x={30} y={y + 4} textAnchor="end" className="fill-[#64748B] text-[10px] font-mono">
                      {val}
                    </text>
                  </g>
                );
              })}

              {bars.map((item, idx) => {
                const slotWidth = 500 / bars.length;
                const barWidth = Math.min(34, slotWidth * 0.45);
                const x = 45 + idx * slotWidth + (slotWidth - barWidth) / 2;
                const normalH = (item.normal / maxBarTotal) * 135;
                const flaggedH = (item.flagged / maxBarTotal) * 135;

                return (
                  <g
                    key={item.label}
                    onMouseEnter={() => setHoveredBarIdx(idx)}
                    onMouseLeave={() => setHoveredBarIdx(null)}
                    className="cursor-pointer"
                  >
                    {/* Normal bar */}
                    <rect
                      x={x}
                      y={165 - normalH}
                      width={barWidth}
                      height={Math.max(0, normalH)}
                      rx={3}
                      fill="#2685D8"
                    />
                    {/* Flagged stacked on top */}
                    <rect
                      x={x}
                      y={165 - normalH - flaggedH}
                      width={barWidth}
                      height={Math.max(0, flaggedH)}
                      rx={3}
                      fill="#D97706"
                    />
                    <text
                      x={x + barWidth / 2}
                      y={184}
                      textAnchor="middle"
                      className="fill-[#64748B] text-[10px]"
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredBarIdx !== null && bars[hoveredBarIdx] && (
              <div className="absolute top-2 right-2 bg-white border border-[#D6E4F0] rounded-lg px-3 py-2 shadow-sm text-xs pointer-events-none">
                <div className="font-semibold text-[#164B78]">{bars[hoveredBarIdx].label}</div>
                <div className="text-[#24364B] font-mono tabular-nums mt-0.5">
                  Normal: {bars[hoveredBarIdx].normal} · Review/Abnormal: {bars[hoveredBarIdx].flagged}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-5 mt-3 text-xs text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#2685D8]" />
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706]" />
              <span>Needs Review / Abnormal</span>
            </div>
          </div>
        </div>

        {/* pH & Specific Gravity Trend Chart */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#D6E4F0] p-5 shadow-[0_1px_3px_rgba(22,75,120,0.05)]">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#164B78]">pH &amp; Hydration Trends</h2>
            <p className="text-xs text-[#64748B]">Recent measured pH values across tests (normal 4.5–8.0)</p>
          </div>

          {trends.filter((t) => t.ph !== null).length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center bg-[#F8FBFF] rounded-lg border border-[#E5EEF6] p-6">
              <FlaskConical className="w-7 h-7 text-[#64B5F6] mb-2" aria-hidden="true" />
              <p className="text-xs text-[#64748B]">No pH readings available in this mode yet.</p>
            </div>
          ) : (
            <div className="relative h-56">
              <svg viewBox="0 0 420 200" className="w-full h-full overflow-visible" role="img" aria-label="pH trend line chart">
                {/* Reference band 4.5 - 8.0 on scale 4.0 - 9.0 */}
                <rect x={36} y={47} width={370} height={94} fill="#EAF5FF" opacity={0.6} />
                {[4, 5, 6, 7, 8, 9].map((phVal) => {
                  const y = 165 - ((phVal - 4) / 5) * 135;
                  return (
                    <g key={phVal}>
                      <line x1={36} y1={y} x2={406} y2={y} stroke="#E5EEF6" strokeWidth={1} />
                      <text x={28} y={y + 4} textAnchor="end" className="fill-[#64748B] text-[10px] font-mono">
                        {phVal.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {(() => {
                  const pts = trends
                    .map((t, idx) => {
                      if (t.ph === null) return null;
                      const x =
                        trends.length === 1
                          ? 220
                          : 46 + (idx / Math.max(1, trends.length - 1)) * 348;
                      const clamped = Math.max(4, Math.min(9, t.ph));
                      const y = 165 - ((clamped - 4) / 5) * 135;
                      return { x, y, t, idx };
                    })
                    .filter((p): p is NonNullable<typeof p> => p !== null);

                  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  return (
                    <>
                      {pts.length > 1 && (
                        <path d={pathD} fill="none" stroke="#2685D8" strokeWidth={2.25} strokeLinecap="round" />
                      )}
                      {pts.map((p) => (
                        <g
                          key={p.t.id}
                          onMouseEnter={() => setHoveredLineIdx(p.idx)}
                          onMouseLeave={() => setHoveredLineIdx(null)}
                          className="cursor-pointer"
                        >
                          <circle cx={p.x} cy={p.y} r={4.5} fill="#FFFFFF" stroke="#164B78" strokeWidth={2} />
                          <text x={p.x} y={184} textAnchor="middle" className="fill-[#64748B] text-[10px]">
                            {p.t.label}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>

              {hoveredLineIdx !== null && trends[hoveredLineIdx] && (
                <div className="absolute top-2 right-2 bg-white border border-[#D6E4F0] rounded-lg px-3 py-2 shadow-sm text-xs pointer-events-none">
                  <div className="font-semibold text-[#164B78]">{trends[hoveredLineIdx].id}</div>
                  <div className="font-mono tabular-nums text-[#24364B] mt-0.5">
                    pH: {trends[hoveredLineIdx].ph?.toFixed(1) ?? '—'} · SG:{' '}
                    {trends[hoveredLineIdx].specificGravity?.toFixed(3) ?? '—'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Latest Test Results & Recent Patient Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D6E4F0] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#164B78]">Latest Urinalysis Results</h2>
              <p className="text-xs text-[#64748B]">Click any test to inspect all 10 parameters</p>
            </div>
          </div>

          {summary.latestTests.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[#64748B] mb-3">
                No {mode === 'real' ? 'real IoT hardware' : 'demo'} test records yet.
              </p>
              <button
                type="button"
                onClick={onStartNewTest}
                className="px-4 py-2 bg-[#2685D8] text-white text-xs font-semibold rounded-lg hover:bg-[#164B78] transition-colors cursor-pointer"
              >
                Start First Test
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FBFF] border-b border-[#D6E4F0] text-[11px] font-semibold text-[#64748B]">
                    <th className="py-2.5 px-4">Test ID</th>
                    <th className="py-2.5 px-4">Patient</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Source</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EEF6] text-xs">
                  {summary.latestTests.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F8FBFF] transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums font-medium text-[#164B78]">{t.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#24364B]">{t.patientName}</div>
                        <div className="text-[11px] text-[#64748B] font-mono">{t.patientId}</div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#64748B]">
                        {new Date(t.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-[#64748B]">
                        {t.mode === 'demo' ? 'Simulated Demo' : t.source === 'esp32' ? 'ESP32 Hardware' : 'Manual Entry'}
                      </td>
                      <td className="py-3 px-4">
                        <ParameterStatusText status={t.overallStatus} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectTest(t)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2685D8] hover:text-[#164B78] cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Patient Activity */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#D6E4F0] shadow-[0_1px_3px_rgba(22,75,120,0.05)] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#164B78]">Recent Activity</h2>
              <button
                type="button"
                onClick={onGoToPatients}
                className="text-xs font-semibold text-[#2685D8] hover:text-[#164B78] inline-flex items-center gap-1 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Patients ({summary.kpis.patientCount})</span>
              </button>
            </div>

            <div className="space-y-3">
              {summary.latestTests.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTest(t)}
                  className="w-full text-left pb-3 border-b border-[#E5EEF6] last:border-b-0 last:pb-0 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#24364B] truncate">{t.patientName}</span>
                    <ParameterStatusText status={t.overallStatus} />
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-1 font-mono tabular-nums">
                    {t.patientId} · pH {t.readings.ph ?? '—'} · Glucose {t.readings.glucose ?? '—'}
                  </div>
                </button>
              ))}
              {summary.latestTests.length === 0 && (
                <p className="text-xs text-[#64748B]">Activity will appear once tests are recorded.</p>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#E5EEF6] text-[11px] text-[#64748B]">
            Telemetry events recorded: <span className="font-mono font-semibold text-[#164B78]">{summary.deviceStatus.events.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
