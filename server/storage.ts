import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  computeOverallStatus,
  URINALYSIS_PARAMETERS,
  type ChatSession,
  type DeviceStatusState,
  type DeviceTelemetryEvent,
  type OperationMode,
  type ParameterKey,
  type PatientRecord,
  type PublicUser,
  type UrinalysisTestRecord,
} from '../shared/urinalysis.ts';

export interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface SystemSettings {
  mode: OperationMode;
  deviceId: string;
  deviceApiKey: string;
  heartbeatTimeoutSeconds: number;
  clinicName: string;
  enabledChannels: Record<ParameterKey, boolean>;
}

export interface DatabaseSchema {
  users: StoredUser[];
  patients: PatientRecord[];
  tests: UrinalysisTestRecord[];
  chats: ChatSession[];
  settings: SystemSettings;
  deviceRuntime: {
    connectionState: DeviceStatusState['connectionState'];
    lastHeartbeatAt: string | null;
    lastReadingAt: string | null;
    wifiRssi: number | null;
    firmwareVersion: string;
    ipAddress: string | null;
    batteryPercent: number | null;
    events: DeviceTelemetryEvent[];
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'urisense-db.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function defaultEnabledChannels(): Record<ParameterKey, boolean> {
  return URINALYSIS_PARAMETERS.reduce((acc, p) => {
    acc[p.key] = true;
    return acc;
  }, {} as Record<ParameterKey, boolean>);
}

function isoDaysAgo(daysAgo: number, hour = 9, minute = 30): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function createInitialDatabase(): DatabaseSchema {
  const demoUser: StoredUser = {
    id: 'USR-CLINICIAN-01',
    name: 'Dr. Sarah Jenkins',
    email: 'clinician@urisense.ai',
    role: 'Clinical Laboratory Specialist',
    createdAt: isoDaysAgo(30),
    passwordHash: hashPassword('UriSense2026!'),
  };

  const patients: PatientRecord[] = [
    {
      id: 'PATIENT-001',
      name: 'Elena Rostova',
      age: 34,
      gender: 'Female',
      contact: 'elena.rostova@example.com',
      registrationDate: isoDaysAgo(24),
      notes: 'Routine wellness and hydration follow-up.',
    },
    {
      id: 'PATIENT-002',
      name: 'Marcus Vance',
      age: 52,
      gender: 'Male',
      contact: 'm.vance@example.com',
      registrationDate: isoDaysAgo(18),
      notes: 'Annual metabolic panel screening.',
    },
    {
      id: 'PATIENT-003',
      name: 'Priya Nair',
      age: 29,
      gender: 'Female',
      contact: 'priya.nair@example.com',
      registrationDate: isoDaysAgo(12),
      notes: 'Monitoring urinary tract recovery.',
    },
    {
      id: 'PATIENT-004',
      name: 'David Morales',
      age: 61,
      gender: 'Male',
      contact: 'd.morales@example.com',
      registrationDate: isoDaysAgo(7),
      notes: 'Kidney function and blood pressure checkup.',
    },
  ];

  const seedSpecs: Array<{
    id: string;
    patientId: string;
    patientName: string;
    timestamp: string;
    readings: UrinalysisTestRecord['readings'];
    notes: string;
  }> = [
    {
      id: 'TEST-1001',
      patientId: 'PATIENT-001',
      patientName: 'Elena Rostova',
      timestamp: isoDaysAgo(6, 9, 15),
      readings: {
        glucose: 'Negative',
        protein: 'Negative',
        ph: 6.0,
        ketones: 'Negative',
        blood: 'Negative',
        specificGravity: 1.015,
        bilirubin: 'Negative',
        urobilinogen: 0.4,
        nitrite: 'Negative',
        leukocytes: 'Negative',
      },
      notes: 'Baseline demo reading within expected reference ranges.',
    },
    {
      id: 'TEST-1002',
      patientId: 'PATIENT-002',
      patientName: 'Marcus Vance',
      timestamp: isoDaysAgo(5, 11, 40),
      readings: {
        glucose: '+1 (250 mg/dL)',
        protein: 'Trace (15 mg/dL)',
        ph: 5.5,
        ketones: 'Trace (5 mg/dL)',
        blood: 'Negative',
        specificGravity: 1.025,
        bilirubin: 'Negative',
        urobilinogen: 0.6,
        nitrite: 'Negative',
        leukocytes: 'Negative',
      },
      notes: 'Elevated glucose noted in simulated demonstration sample.',
    },
    {
      id: 'TEST-1003',
      patientId: 'PATIENT-003',
      patientName: 'Priya Nair',
      timestamp: isoDaysAgo(4, 14, 10),
      readings: {
        glucose: 'Negative',
        protein: 'Negative',
        ph: 7.0,
        ketones: 'Negative',
        blood: 'Trace (Non-hemolyzed)',
        specificGravity: 1.02,
        bilirubin: 'Negative',
        urobilinogen: 0.4,
        nitrite: 'Positive',
        leukocytes: 'Moderate (125 WBC/µL)',
      },
      notes: 'Positive nitrite and moderate leukocytes flagged for review.',
    },
    {
      id: 'TEST-1004',
      patientId: 'PATIENT-004',
      patientName: 'David Morales',
      timestamp: isoDaysAgo(3, 10, 5),
      readings: {
        glucose: 'Negative',
        protein: '+1 (30 mg/dL)',
        ph: 6.5,
        ketones: 'Negative',
        blood: 'Negative',
        specificGravity: 1.018,
        bilirubin: 'Negative',
        urobilinogen: 0.8,
        nitrite: 'Negative',
        leukocytes: 'Negative',
      },
      notes: 'Mild protein elevation in demo checkup.',
    },
    {
      id: 'TEST-1005',
      patientId: 'PATIENT-001',
      patientName: 'Elena Rostova',
      timestamp: isoDaysAgo(2, 8, 50),
      readings: {
        glucose: 'Negative',
        protein: 'Negative',
        ph: 6.5,
        ketones: 'Negative',
        blood: 'Negative',
        specificGravity: 1.012,
        bilirubin: 'Negative',
        urobilinogen: 0.4,
        nitrite: 'Negative',
        leukocytes: 'Negative',
      },
      notes: 'Well-hydrated follow-up demo sample.',
    },
    {
      id: 'TEST-1006',
      patientId: 'PATIENT-003',
      patientName: 'Priya Nair',
      timestamp: isoDaysAgo(1, 16, 25),
      readings: {
        glucose: 'Negative',
        protein: 'Negative',
        ph: 6.5,
        ketones: 'Negative',
        blood: 'Negative',
        specificGravity: 1.015,
        bilirubin: 'Negative',
        urobilinogen: 0.2,
        nitrite: 'Negative',
        leukocytes: 'Trace (15 WBC/µL)',
      },
      notes: 'Follow-up showing improvement; trace leukocytes remain for review.',
    },
    {
      id: 'TEST-1007',
      patientId: 'PATIENT-002',
      patientName: 'Marcus Vance',
      timestamp: isoDaysAgo(0, 8, 45),
      readings: {
        glucose: 'Trace (100 mg/dL)',
        protein: 'Negative',
        ph: 6.0,
        ketones: 'Negative',
        blood: 'Negative',
        specificGravity: 1.022,
        bilirubin: 'Negative',
        urobilinogen: 0.6,
        nitrite: 'Negative',
        leukocytes: 'Negative',
      },
      notes: 'Morning demonstration reading.',
    },
  ];

  const tests: UrinalysisTestRecord[] = seedSpecs.map((spec) => ({
    id: spec.id,
    deviceId: 'URISENSE-SIM-001',
    patientId: spec.patientId,
    patientName: spec.patientName,
    timestamp: spec.timestamp,
    mode: 'demo',
    source: 'simulated',
    readings: spec.readings,
    overallStatus: computeOverallStatus(spec.readings),
    clinicianNotes: spec.notes,
    saved: true,
  }));

  return {
    users: [demoUser],
    patients,
    tests,
    chats: [],
    settings: {
      mode: 'demo',
      deviceId: 'URISENSE-001',
      deviceApiKey: process.env.URISENSE_DEVICE_KEY || 'urisense-esp32-dev-key',
      heartbeatTimeoutSeconds: 30,
      clinicName: 'UriSense Clinical Diagnostics Lab',
      enabledChannels: defaultEnabledChannels(),
    },
    deviceRuntime: {
      connectionState: 'Device Disconnected',
      lastHeartbeatAt: null,
      lastReadingAt: null,
      wifiRssi: null,
      firmwareVersion: 'ESP32-S3 v1.4.2',
      ipAddress: null,
      batteryPercent: null,
      events: [
        {
          id: 'EVT-INIT-01',
          timestamp: new Date().toISOString(),
          type: 'info',
          message: 'UriSense backend initialized. Waiting for ESP32 heartbeat or Demo Mode capture.',
        },
      ],
    },
  };
}

let cachedDb: DatabaseSchema | null = null;

export function loadDb(): DatabaseSchema {
  if (cachedDb) return cachedDb;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    cachedDb = createInitialDatabase();
    saveDb(cachedDb);
    return cachedDb;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    cachedDb = JSON.parse(raw) as DatabaseSchema;
    return cachedDb;
  } catch {
    cachedDb = createInitialDatabase();
    saveDb(cachedDb);
    return cachedDb;
  }
}

export function saveDb(db: DatabaseSchema): void {
  cachedDb = db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tempPath, DB_PATH);
}

export function appendDeviceEvent(
  db: DatabaseSchema,
  type: DeviceTelemetryEvent['type'],
  message: string
): DeviceTelemetryEvent {
  const event: DeviceTelemetryEvent = {
    id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
  };
  db.deviceRuntime.events = [event, ...db.deviceRuntime.events].slice(0, 40);
  return event;
}

export function computeEffectiveDeviceStatus(db: DatabaseSchema): DeviceStatusState {
  const { settings, deviceRuntime } = db;
  let effectiveState = deviceRuntime.connectionState;

  if (settings.mode === 'real') {
    if (!deviceRuntime.lastHeartbeatAt) {
      effectiveState = 'Device Disconnected';
    } else {
      const elapsedSec = (Date.now() - new Date(deviceRuntime.lastHeartbeatAt).getTime()) / 1000;
      if (elapsedSec > settings.heartbeatTimeoutSeconds) {
        effectiveState = 'Device Disconnected';
      }
    }
  } else {
    // In Demo Mode, only stay Connected/Receiving/Processing if demo simulation set it, otherwise show Device Connected (Simulated) or Disconnected if never started?
    // Keep exact state from runtime; when user clicks Simulate or Demo Mode starts, runtime reflects it clearly.
  }

  return {
    deviceId: settings.deviceId,
    mode: settings.mode,
    connectionState: effectiveState,
    lastHeartbeatAt: deviceRuntime.lastHeartbeatAt,
    lastReadingAt: deviceRuntime.lastReadingAt,
    wifiRssi: deviceRuntime.wifiRssi,
    firmwareVersion: deviceRuntime.firmwareVersion,
    ipAddress: deviceRuntime.ipAddress,
    batteryPercent: deviceRuntime.batteryPercent,
    enabledChannels: settings.enabledChannels,
    events: deviceRuntime.events,
  };
}
