import type {
  ChatSession,
  DeviceStatusState,
  OperationMode,
  ParameterKey,
  PatientRecord,
  PublicUser,
  UrinalysisReadings,
  UrinalysisTestRecord,
} from '../../shared/urinalysis.ts';

const TOKEN_STORAGE_KEY = 'urisense_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface SystemSettingsDto {
  mode: OperationMode;
  deviceId: string;
  deviceApiKey: string;
  heartbeatTimeoutSeconds: number;
  clinicName: string;
  enabledChannels: Record<ParameterKey, boolean>;
}

export interface PatientWithStats extends PatientRecord {
  testCount: number;
  lastTestDate: string | null;
  lastTestStatus: string | null;
}

export interface DashboardSummaryDto {
  activeMode: OperationMode;
  kpis: {
    totalTests: number;
    normalTests: number;
    abnormalOrReviewTests: number;
    patientCount: number;
  };
  deviceStatus: DeviceStatusState;
  latestTests: UrinalysisTestRecord[];
  dailyStats: Array<{ date: string; label: string; normal: number; flagged: number; total: number }>;
  weeklyStats: Array<{ label: string; normal: number; flagged: number; total: number }>;
  parameterTrends: Array<{ id: string; label: string; ph: number | null; specificGravity: number | null }>;
}

export const api = {
  // Auth
  me: () => request<{ user: PublicUser }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: PublicUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: { name: string; email: string; password: string; role?: string }) =>
    request<{ user: PublicUser; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  demoLogin: () =>
    request<{ user: PublicUser; token: string }>('/api/auth/demo-login', {
      method: 'POST',
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Dashboard
  getDashboardSummary: (mode?: OperationMode | 'all') =>
    request<DashboardSummaryDto>(`/api/dashboard/summary${mode ? `?mode=${mode}` : ''}`),

  // Patients
  getPatients: () => request<{ patients: PatientWithStats[] }>('/api/patients'),
  createPatient: (payload: {
    id?: string;
    name: string;
    age: number;
    gender: 'Female' | 'Male' | 'Other';
    contact: string;
    notes?: string;
  }) =>
    request<{ patient: PatientRecord }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePatient: (
    id: string,
    payload: { name: string; age: number; gender: 'Female' | 'Male' | 'Other'; contact: string; notes?: string }
  ) =>
    request<{ patient: PatientRecord }>(`/api/patients/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deletePatient: (id: string) =>
    request<{ ok: boolean }>(`/api/patients/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Tests
  getTests: (params?: { patientId?: string; mode?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.patientId) qs.set('patientId', params.patientId);
    if (params?.mode) qs.set('mode', params.mode);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ tests: UrinalysisTestRecord[] }>(`/api/tests${suffix}`);
  },
  getTest: (id: string) =>
    request<{ test: UrinalysisTestRecord; patient: PatientRecord | null }>(`/api/tests/${encodeURIComponent(id)}`),
  createTest: (payload: {
    patientId: string;
    readings: UrinalysisReadings;
    clinicianNotes?: string;
    deviceId?: string;
    mode?: OperationMode;
    source?: 'esp32' | 'simulated' | 'manual';
  }) =>
    request<{ test: UrinalysisTestRecord }>('/api/tests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTest: (id: string, payload: { clinicianNotes?: string; saved?: boolean }) =>
    request<{ test: UrinalysisTestRecord }>(`/api/tests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Device & IoT
  getDeviceStatus: () => request<{ deviceStatus: DeviceStatusState; settings: SystemSettingsDto }>('/api/device/status'),
  updateDeviceConfig: (payload: Partial<SystemSettingsDto>) =>
    request<{ settings: SystemSettingsDto; deviceStatus: DeviceStatusState }>('/api/device/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  simulateSample: (payload: { patientId?: string; preset?: 'normal' | 'glucose_alert' | 'uti_review' }) =>
    request<{ ok: boolean; pendingTestId: string; patientId: string }>('/api/device/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  sendTestReadingPayload: (payload: {
    deviceId: string;
    patientId: string;
    mode: OperationMode;
    readings: UrinalysisReadings;
  }) =>
    request<{ ok: boolean; test: UrinalysisTestRecord; deviceStatus: DeviceStatusState }>('/api/urinalysis/readings', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        wifiRssi: -51,
        firmwareVersion: 'ESP32-S3 v1.4.2',
      }),
    }),

  // Chats
  getChats: () => request<{ chats: ChatSession[] }>('/api/chats'),
  createChat: (payload?: { title?: string; patientId?: string | null; testId?: string | null }) =>
    request<{ chat: ChatSession }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  updateChat: (id: string, payload: { patientId?: string | null; testId?: string | null; clearMessages?: boolean }) =>
    request<{ chat: ChatSession }>(`/api/chats/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteChat: (id: string) =>
    request<{ ok: boolean }>(`/api/chats/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  sendChatMessage: (
    chatId: string,
    payload: { message: string; patientId?: string | null; testId?: string | null }
  ) =>
    request<{ chat: ChatSession }>(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // PDF Report Download
  async downloadPdfReport(testId: string): Promise<void> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/reports/${encodeURIComponent(testId)}/pdf`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Failed to download PDF report.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UriSense-${testId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async downloadProjectZip(): Promise<void> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/project/zip', {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Failed to download project ZIP.');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'urisense-ai-full-project.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
