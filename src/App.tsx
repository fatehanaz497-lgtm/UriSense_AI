import { useCallback, useEffect, useState } from 'react';
import {
  URINALYSIS_PARAMETERS,
  type DeviceStatusState,
  type OperationMode,
  type ParameterKey,
  type PublicUser,
  type UrinalysisTestRecord,
} from '../shared/urinalysis.ts';
import {
  api,
  getStoredToken,
  setStoredToken,
  type DashboardSummaryDto,
  type PatientWithStats,
  type SystemSettingsDto,
} from './lib/api.ts';
import { Sidebar, type NavRoute } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { NewTestView } from './components/NewTestView.tsx';
import { TestResultsView } from './components/TestResultsView.tsx';
import { PatientsView } from './components/PatientsView.tsx';
import { DeviceMonitoringView } from './components/DeviceMonitoringView.tsx';
import { AiAssistantView } from './components/AiAssistantView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

function createInitialDeviceStatus(): DeviceStatusState {
  const enabledChannels = URINALYSIS_PARAMETERS.reduce((acc, p) => {
    acc[p.key] = true;
    return acc;
  }, {} as Record<ParameterKey, boolean>);

  return {
    deviceId: 'URISENSE-001',
    mode: 'demo',
    connectionState: 'Device Disconnected',
    lastHeartbeatAt: null,
    lastReadingAt: null,
    wifiRssi: null,
    firmwareVersion: 'ESP32-S3 v1.4.2',
    ipAddress: null,
    batteryPercent: null,
    enabledChannels,
    events: [],
  };
}

const ROUTE_TITLES: Record<NavRoute, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Clinical Dashboard',
    subtitle: 'Overview of urinalysis volume, trends, and live ESP32 hardware telemetry',
  },
  'new-test': {
    title: 'New Urine Test',
    subtitle: 'Capture readings from the ESP32 analyzer or record manual test strip values',
  },
  'test-results': {
    title: 'Urinalysis Results',
    subtitle: 'Detailed 10-parameter evaluation, reference ranges, and educational explanations',
  },
  patients: {
    title: 'Patient Management',
    subtitle: 'Manage patient profiles, registration details, and prior test records',
  },
  'device-monitoring': {
    title: 'Device Monitoring',
    subtitle: 'Real-time ESP32 Wi-Fi connectivity, sensor channels, and API integration',
  },
  'ai-assistant': {
    title: 'UriSense Assistant',
    subtitle: 'Conversational AI assistant powered by Gemini for simple urinalysis guidance',
  },
  'test-history': {
    title: 'Test History',
    subtitle: 'Search, filter, and sort all historical urinalysis records',
  },
  reports: {
    title: 'Clinical Reports',
    subtitle: 'Printable urinalysis reports and official PDF downloads',
  },
  settings: {
    title: 'System Settings',
    subtitle: 'Configure Demo vs. Real IoT mode, ESP32 device keys, and API docs',
  },
};

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activeRoute, setActiveRoute] = useState<NavRoute>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [mode, setMode] = useState<OperationMode>('demo');
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);
  const [patients, setPatients] = useState<PatientWithStats[]>([]);
  const [tests, setTests] = useState<UrinalysisTestRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettingsDto | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusState>(createInitialDeviceStatus());
  const [loadingData, setLoadingData] = useState(false);

  const [selectedTest, setSelectedTest] = useState<UrinalysisTestRecord | null>(null);
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | null>(null);
  const [assistantAttachedTest, setAssistantAttachedTest] = useState<UrinalysisTestRecord | null>(null);

  const [toastNotification, setToastNotification] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastNotification(msg);
    setTimeout(() => {
      setToastNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  const refreshAllData = useCallback(async (overrideMode?: OperationMode) => {
    setLoadingData(true);
    try {
      const [devRes, patRes, testRes] = await Promise.all([
        api.getDeviceStatus(),
        api.getPatients(),
        api.getTests(),
      ]);
      const effectiveMode = overrideMode || devRes.settings.mode;
      const dashRes = await api.getDashboardSummary(effectiveMode);

      setSettings(devRes.settings);
      setDeviceStatus(devRes.deviceStatus);
      setMode(effectiveMode);
      setPatients(patRes.patients);
      setTests(testRes.tests);
      setSummary(dashRes);
      setSelectedTest((prev) => {
        if (prev) {
          const updated = testRes.tests.find((t) => t.id === prev.id);
          if (updated) return updated;
        }
        return testRes.tests[0] ?? null;
      });
    } catch {
      // Errors handled individually
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Check authentication on initial mount
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const res = await api.me();
        if (mounted) {
          setUser(res.user);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    }
    checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  // Load workspace data + subscribe to SSE live telemetry when signed in
  useEffect(() => {
    if (!user) return;
    refreshAllData();

    const token = getStoredToken();
    const sseUrl = token
      ? `/api/device/stream?token=${encodeURIComponent(token)}`
      : '/api/device/stream';

    const source = new EventSource(sseUrl);

    source.addEventListener('device_status', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as DeviceStatusState;
        setDeviceStatus(parsed);
        setMode(parsed.mode);
      } catch {
        // Ignore parse issues
      }
    });

    source.addEventListener('new_test', (event) => {
      try {
        const newTest = JSON.parse((event as MessageEvent).data) as UrinalysisTestRecord;
        setTests((prev) => [newTest, ...prev.filter((t) => t.id !== newTest.id)]);
        setSelectedTest(newTest);
        refreshAllData();
        showToast(`New urinalysis reading received (${newTest.id} · ${newTest.patientName})`);
      } catch {
        // Ignore parse issues
      }
    });

    return () => {
      source.close();
    };
  }, [user, refreshAllData, showToast]);

  async function handleToggleMode(nextMode: OperationMode) {
    try {
      const res = await api.updateDeviceConfig({ mode: nextMode });
      setMode(res.settings.mode);
      setSettings(res.settings);
      setDeviceStatus(res.deviceStatus);
      await refreshAllData(nextMode);
      showToast(
        nextMode === 'real'
          ? 'Switched to Real IoT Mode (hardware readings only).'
          : 'Switched to Demo Mode (simulated samples enabled).'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to switch mode.');
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // Ignore logout API errors
    }
    setStoredToken(null);
    setUser(null);
    setSummary(null);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm font-medium text-[#164B78]">Initializing UriSense AI...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={(u) => setUser(u)} />;
  }

  const routeMeta = ROUTE_TITLES[activeRoute];
  const selectedPatient = selectedTest
    ? patients.find((p) => p.id === selectedTest.patientId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-[#F5FAFF] flex text-[#24364B]">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={(route) => setActiveRoute(route)}
        mode={mode}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={routeMeta.title}
          subtitle={routeMeta.subtitle}
          deviceStatus={deviceStatus}
          mode={mode}
          onToggleMode={handleToggleMode}
          user={user}
          onLogout={handleLogout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-7 overflow-y-auto">
          {toastNotification && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-[#164B78] text-white text-xs font-medium flex items-center justify-between shadow-sm no-print">
              <span>{toastNotification}</span>
              <button
                type="button"
                onClick={() => setToastNotification(null)}
                className="text-white/80 hover:text-white text-xs ml-4 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeRoute === 'dashboard' && (
            <DashboardView
              summary={summary}
              loading={loadingData}
              mode={mode}
              onSelectTest={(test) => {
                setSelectedTest(test);
                setActiveRoute('test-results');
              }}
              onStartNewTest={() => setActiveRoute('new-test')}
              onGoToDeviceMonitoring={() => setActiveRoute('device-monitoring')}
              onGoToPatients={() => setActiveRoute('patients')}
            />
          )}

          {activeRoute === 'new-test' && (
            <NewTestView
              patients={patients}
              deviceStatus={deviceStatus}
              mode={mode}
              preselectedPatientId={preselectedPatientId}
              onTestCreated={(test) => {
                setSelectedTest(test);
                setPreselectedPatientId(null);
                refreshAllData();
                setActiveRoute('test-results');
              }}
              onGoToDeviceMonitoring={() => setActiveRoute('device-monitoring')}
            />
          )}

          {activeRoute === 'test-results' && (
            <TestResultsView
              test={selectedTest}
              patient={selectedPatient}
              allTests={tests}
              onSelectTest={(test) => setSelectedTest(test)}
              onStartNewTest={() => setActiveRoute('new-test')}
              onViewHistory={() => setActiveRoute('test-history')}
              onAskAssistant={(test) => {
                setAssistantAttachedTest(test);
                setActiveRoute('ai-assistant');
              }}
              onTestUpdated={(updated) => {
                setSelectedTest(updated);
                setTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
              }}
            />
          )}

          {activeRoute === 'patients' && (
            <PatientsView
              patients={patients}
              tests={tests}
              onRefresh={refreshAllData}
              onSelectTest={(test) => {
                setSelectedTest(test);
                setActiveRoute('test-results');
              }}
              onStartTestForPatient={(patientId) => {
                setPreselectedPatientId(patientId);
                setActiveRoute('new-test');
              }}
            />
          )}

          {activeRoute === 'device-monitoring' && (
            <DeviceMonitoringView
              deviceStatus={deviceStatus}
              settings={settings}
              patients={patients}
              onRefresh={refreshAllData}
            />
          )}

          {activeRoute === 'ai-assistant' && (
            <AiAssistantView
              patients={patients}
              tests={tests}
              initialAttachedTest={assistantAttachedTest}
            />
          )}

          {activeRoute === 'test-history' && (
            <HistoryView
              tests={tests}
              onInspectResults={(test) => {
                setSelectedTest(test);
                setActiveRoute('test-results');
              }}
              onViewReport={(test) => {
                setSelectedTest(test);
                setActiveRoute('reports');
              }}
            />
          )}

          {activeRoute === 'reports' && (
            <ReportsView
              tests={tests}
              patients={patients}
              selectedTest={selectedTest}
              onSelectTest={(test) => setSelectedTest(test)}
            />
          )}

          {activeRoute === 'settings' && (
            <SettingsView settings={settings} onUpdated={refreshAllData} />
          )}
        </main>
      </div>
    </div>
  );
}
