import 'dotenv/config';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  computeOverallStatus,
  createEmptyReadings,
  URINALYSIS_PARAMETERS,
  type ChatMessage,
  type ChatSession,
  type OperationMode,
  type ParameterKey,
  type PatientRecord,
  type PublicUser,
  type ReadingValue,
  type UrinalysisReadings,
  type UrinalysisTestRecord,
} from './shared/urinalysis.ts';
import {
  appendDeviceEvent,
  computeEffectiveDeviceStatus,
  hashPassword,
  loadDb,
  saveDb,
  verifyPassword,
} from './server/storage.ts';
import { generateUrinalysisPdfBuffer } from './server/pdfReport.ts';
import { generateAssistantReply } from './server/geminiService.ts';

const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = 'urisense_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + '_urisense_secret').digest('hex');

interface AuthenticatedRequest extends Request {
  user?: PublicUser;
}

interface SseClient {
  id: string;
  res: Response;
}

const sseClients = new Set<SseClient>();

function broadcastSse(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function signToken(userId: string): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ userId, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      userId: string;
      exp: number;
    };
    if (!parsed.userId || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed.userId;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      result[k] = decodeURIComponent(v);
    }
  }
  return result;
}

function toPublicUser(u: { id: string; name: string; email: string; role: string; createdAt: string }): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  };
}

function extractTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE]) {
    return cookies[SESSION_COOKIE];
  }
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  return null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractTokenFromReq(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  const db = loadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  req.user = toPublicUser(user);
  next();
}

function normalizeReadings(raw: unknown): UrinalysisReadings {
  const clean = createEmptyReadings();
  if (!raw || typeof raw !== 'object') return clean;
  const obj = raw as Record<string, unknown>;
  for (const param of URINALYSIS_PARAMETERS) {
    const val = obj[param.key];
    if (val === null || val === undefined || val === '') {
      clean[param.key] = null;
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      clean[param.key] = val;
    } else if (typeof val === 'string') {
      const trimmed = val.trim().slice(0, 80);
      clean[param.key] = trimmed.length > 0 ? trimmed : null;
    }
  }
  return clean;
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    const db = loadDb();
    res.json({
      ok: true,
      service: 'UriSense AI Backend',
      mode: db.settings.mode,
      timestamp: new Date().toISOString(),
    });
  });

  // ---------------- Authentication ----------------
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    const db = loadDb();
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const newUser = {
      id: `USR-${Date.now()}`,
      name: name.trim().slice(0, 80),
      email: cleanEmail,
      role: (role || 'Clinician').trim().slice(0, 60),
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password),
    };
    db.users.push(newUser);
    saveDb(db);

    const token = signToken(newUser.id);
    setSessionCookie(res, token);
    res.status(201).json({ user: toPublicUser(newUser), token });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const db = loadDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const token = signToken(user.id);
    setSessionCookie(res, token);
    res.json({ user: toPublicUser(user), token });
  });

  app.post('/api/auth/demo-login', (_req, res) => {
    const db = loadDb();
    const demoUser = db.users[0];
    if (!demoUser) {
      res.status(500).json({ error: 'Demo clinician account is unavailable.' });
      return;
    }
    const token = signToken(demoUser.id);
    setSessionCookie(res, token);
    res.json({ user: toPublicUser(demoUser), token });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // ---------------- Dashboard Summary ----------------
  app.get('/api/dashboard/summary', requireAuth, (req, res) => {
    const db = loadDb();
    const filterMode = req.query.mode as OperationMode | 'all' | undefined;
    const activeMode = filterMode === 'real' || filterMode === 'demo' ? filterMode : db.settings.mode;

    const modeTests = db.tests
      .filter((t) => (filterMode === 'all' ? true : t.mode === activeMode))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalTests = modeTests.length;
    const normalTests = modeTests.filter((t) => t.overallStatus === 'Normal').length;
    const abnormalOrReviewTests = modeTests.filter(
      (t) => t.overallStatus === 'Abnormal' || t.overallStatus === 'Needs Review'
    ).length;

    // Daily stats over last 7 days
    const dailyStats: Array<{ date: string; label: string; normal: number; flagged: number; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      const dayTests = modeTests.filter((t) => t.timestamp.slice(0, 10) === dayKey);
      const normal = dayTests.filter((t) => t.overallStatus === 'Normal').length;
      const flagged = dayTests.length - normal;
      dailyStats.push({
        date: dayKey,
        label: dayLabel,
        normal,
        flagged,
        total: dayTests.length,
      });
    }

    // Weekly rollup (last 4 weeks)
    const weeklyStats: Array<{ label: string; normal: number; flagged: number; total: number }> = [];
    const nowMs = Date.now();
    for (let w = 3; w >= 0; w--) {
      const startMs = nowMs - (w + 1) * 7 * 24 * 60 * 60 * 1000;
      const endMs = nowMs - w * 7 * 24 * 60 * 60 * 1000;
      const wTests = modeTests.filter((t) => {
        const ms = new Date(t.timestamp).getTime();
        return ms >= startMs && ms < endMs;
      });
      const normal = wTests.filter((t) => t.overallStatus === 'Normal').length;
      weeklyStats.push({
        label: w === 0 ? 'This Week' : `${w}w Ago`,
        normal,
        flagged: wTests.length - normal,
        total: wTests.length,
      });
    }

    // Parameter trend series (most recent 8 tests with pH or Specific Gravity)
    const parameterTrends = [...modeTests]
      .slice(0, 8)
      .reverse()
      .map((t) => ({
        id: t.id,
        label: new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ph: typeof t.readings.ph === 'number' ? t.readings.ph : null,
        specificGravity: typeof t.readings.specificGravity === 'number' ? t.readings.specificGravity : null,
      }));

    res.json({
      activeMode,
      kpis: {
        totalTests,
        normalTests,
        abnormalOrReviewTests,
        patientCount: db.patients.length,
      },
      deviceStatus: computeEffectiveDeviceStatus(db),
      latestTests: modeTests.slice(0, 5),
      dailyStats,
      weeklyStats,
      parameterTrends,
    });
  });

  // ---------------- Patients CRUD ----------------
  app.get('/api/patients', requireAuth, (_req, res) => {
    const db = loadDb();
    const patientsWithCounts = db.patients.map((p) => {
      const pTests = db.tests
        .filter((t) => t.patientId === p.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return {
        ...p,
        testCount: pTests.length,
        lastTestDate: pTests[0]?.timestamp ?? null,
        lastTestStatus: pTests[0]?.overallStatus ?? null,
      };
    });
    res.json({ patients: patientsWithCounts });
  });

  app.post('/api/patients', requireAuth, (req, res) => {
    const { id, name, age, gender, contact, notes } = req.body as Partial<PatientRecord>;
    if (!name || typeof age !== 'number' || !gender) {
      res.status(400).json({ error: 'Patient name, numeric age, and gender are required.' });
      return;
    }
    if (age < 0 || age > 130) {
      res.status(400).json({ error: 'Age must be between 0 and 130.' });
      return;
    }
    const db = loadDb();
    const cleanId =
      id && id.trim()
        ? id.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
        : `PATIENT-${String(db.patients.length + 1).padStart(3, '0')}-${Math.floor(10 + Math.random() * 89)}`;

    if (db.patients.some((p) => p.id === cleanId)) {
      res.status(409).json({ error: `Patient ID ${cleanId} already exists.` });
      return;
    }

    const newPatient: PatientRecord = {
      id: cleanId,
      name: name.trim().slice(0, 100),
      age: Math.round(age),
      gender,
      contact: (contact || '').trim().slice(0, 120),
      registrationDate: new Date().toISOString(),
      notes: (notes || '').trim().slice(0, 400),
    };
    db.patients.unshift(newPatient);
    saveDb(db);
    res.status(201).json({ patient: newPatient });
  });

  app.put('/api/patients/:id', requireAuth, (req, res) => {
    const db = loadDb();
    const idx = db.patients.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Patient not found.' });
      return;
    }
    const { name, age, gender, contact, notes } = req.body as Partial<PatientRecord>;
    if (!name || typeof age !== 'number' || !gender) {
      res.status(400).json({ error: 'Patient name, numeric age, and gender are required.' });
      return;
    }
    const updated: PatientRecord = {
      ...db.patients[idx],
      name: name.trim().slice(0, 100),
      age: Math.round(age),
      gender,
      contact: (contact ?? db.patients[idx].contact).trim().slice(0, 120),
      notes: (notes ?? db.patients[idx].notes ?? '').trim().slice(0, 400),
    };
    db.patients[idx] = updated;
    // Sync patient name on tests
    db.tests = db.tests.map((t) => (t.patientId === updated.id ? { ...t, patientName: updated.name } : t));
    saveDb(db);
    res.json({ patient: updated });
  });

  app.delete('/api/patients/:id', requireAuth, (req, res) => {
    const db = loadDb();
    const exists = db.patients.some((p) => p.id === req.params.id);
    if (!exists) {
      res.status(404).json({ error: 'Patient not found.' });
      return;
    }
    db.patients = db.patients.filter((p) => p.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  // ---------------- Urinalysis Tests ----------------
  app.get('/api/tests', requireAuth, (req, res) => {
    const db = loadDb();
    const { patientId, mode, status } = req.query as {
      patientId?: string;
      mode?: string;
      status?: string;
    };
    let list = [...db.tests];
    if (patientId) list = list.filter((t) => t.patientId === patientId);
    if (mode === 'demo' || mode === 'real') list = list.filter((t) => t.mode === mode);
    if (status && status !== 'all') list = list.filter((t) => t.overallStatus === status);
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ tests: list });
  });

  app.get('/api/tests/:id', requireAuth, (req, res) => {
    const db = loadDb();
    const test = db.tests.find((t) => t.id === req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Urinalysis test not found.' });
      return;
    }
    const patient = db.patients.find((p) => p.id === test.patientId) ?? null;
    res.json({ test, patient });
  });

  app.post('/api/tests', requireAuth, (req, res) => {
    const { patientId, readings, clinicianNotes, deviceId, mode, source } = req.body as {
      patientId?: string;
      readings?: unknown;
      clinicianNotes?: string;
      deviceId?: string;
      mode?: OperationMode;
      source?: 'esp32' | 'simulated' | 'manual';
    };
    if (!patientId) {
      res.status(400).json({ error: 'patientId is required.' });
      return;
    }
    const db = loadDb();
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) {
      res.status(404).json({ error: `Patient ${patientId} not found.` });
      return;
    }

    const cleanReadings = normalizeReadings(readings);
    const hasAtLeastOne = Object.values(cleanReadings).some((v) => v !== null);
    if (!hasAtLeastOne) {
      res.status(400).json({ error: 'At least one urinalysis parameter measurement must be provided.' });
      return;
    }

    const testMode: OperationMode = mode === 'real' ? 'real' : db.settings.mode;
    const record: UrinalysisTestRecord = {
      id: `TEST-${Date.now().toString().slice(-6)}`,
      deviceId: (deviceId || db.settings.deviceId).trim().slice(0, 64),
      patientId: patient.id,
      patientName: patient.name,
      timestamp: new Date().toISOString(),
      mode: testMode,
      source: source || 'manual',
      readings: cleanReadings,
      overallStatus: computeOverallStatus(cleanReadings),
      clinicianNotes: (clinicianNotes || '').trim().slice(0, 600),
      saved: true,
    };

    db.tests.unshift(record);
    saveDb(db);
    broadcastSse('new_test', record);
    res.status(201).json({ test: record });
  });

  app.patch('/api/tests/:id', requireAuth, (req, res) => {
    const db = loadDb();
    const idx = db.tests.findIndex((t) => t.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Test record not found.' });
      return;
    }
    const { clinicianNotes, saved } = req.body as { clinicianNotes?: string; saved?: boolean };
    db.tests[idx] = {
      ...db.tests[idx],
      clinicianNotes:
        typeof clinicianNotes === 'string' ? clinicianNotes.trim().slice(0, 600) : db.tests[idx].clinicianNotes,
      saved: typeof saved === 'boolean' ? saved : true,
    };
    saveDb(db);
    res.json({ test: db.tests[idx] });
  });

  // ---------------- ESP32 IoT Hardware Endpoints ----------------
  app.post('/api/urinalysis/readings', (req, res) => {
    const db = loadDb();

    // Allow authenticated web users OR ESP32 with valid x-device-key header (if configured)
    const deviceKeyHeader = req.headers['x-device-key'];
    const token = extractTokenFromReq(req);
    const hasValidSession = token ? Boolean(verifyToken(token)) : false;
    const hasValidDeviceKey =
      typeof deviceKeyHeader === 'string' && deviceKeyHeader === db.settings.deviceApiKey;

    if (!hasValidSession && !hasValidDeviceKey) {
      res.status(401).json({
        error: 'Unauthorized device payload. Provide a valid x-device-key header or user session.',
      });
      return;
    }

    const { deviceId, patientId, timestamp, mode, readings, wifiRssi, firmwareVersion, batteryPercent } =
      req.body as {
        deviceId?: string;
        patientId?: string;
        timestamp?: string;
        mode?: OperationMode;
        readings?: Record<string, ReadingValue>;
        wifiRssi?: number;
        firmwareVersion?: string;
        batteryPercent?: number;
      };

    if (!deviceId || !patientId || !readings || typeof readings !== 'object') {
      res.status(400).json({
        error: 'Invalid payload. Required fields: deviceId, patientId, and readings object.',
      });
      return;
    }

    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) {
      res.status(404).json({ error: `Patient ${patientId} not found.` });
      return;
    }

    // Filter out disabled hardware channels if specified in device config
    const normalized = normalizeReadings(readings);
    for (const key of Object.keys(normalized) as ParameterKey[]) {
      if (!db.settings.enabledChannels[key]) {
        normalized[key] = null;
      }
    }

    const nowIso = new Date().toISOString();
    const resolvedMode: OperationMode = mode === 'demo' ? 'demo' : 'real';

    // Stage 1: Data Receiving
    db.deviceRuntime.connectionState = 'Data Receiving';
    db.deviceRuntime.lastHeartbeatAt = nowIso;
    if (typeof wifiRssi === 'number') db.deviceRuntime.wifiRssi = wifiRssi;
    if (typeof firmwareVersion === 'string') db.deviceRuntime.firmwareVersion = firmwareVersion.slice(0, 40);
    if (typeof batteryPercent === 'number') db.deviceRuntime.batteryPercent = batteryPercent;
    db.deviceRuntime.ipAddress = req.ip || db.deviceRuntime.ipAddress;

    appendDeviceEvent(db, 'reading', `Receiving telemetry packet from ${deviceId} for ${patient.id}.`);
    saveDb(db);
    broadcastSse('device_status', computeEffectiveDeviceStatus(db));

    // Stage 2: Processing Sample -> create test record
    const record: UrinalysisTestRecord = {
      id: `TEST-${Date.now().toString().slice(-6)}`,
      deviceId: deviceId.trim().slice(0, 64),
      patientId: patient.id,
      patientName: patient.name,
      timestamp: timestamp && !Number.isNaN(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : nowIso,
      mode: resolvedMode,
      source: resolvedMode === 'real' ? 'esp32' : 'simulated',
      readings: normalized,
      overallStatus: computeOverallStatus(normalized),
      clinicianNotes:
        resolvedMode === 'real'
          ? `Captured directly from ESP32 unit ${deviceId}.`
          : `Simulated hardware capture (${deviceId}).`,
      saved: true,
    };

    db.deviceRuntime.connectionState = 'Processing Sample';
    appendDeviceEvent(db, 'info', `Processing optical strip data for ${record.id} (${record.overallStatus}).`);
    db.tests.unshift(record);
    db.deviceRuntime.lastReadingAt = nowIso;
    saveDb(db);
    broadcastSse('device_status', computeEffectiveDeviceStatus(db));

    setTimeout(() => {
      const latestDb = loadDb();
      latestDb.deviceRuntime.connectionState = 'Device Connected';
      appendDeviceEvent(latestDb, 'info', `Sample ${record.id} completed and stored.`);
      saveDb(latestDb);
      broadcastSse('device_status', computeEffectiveDeviceStatus(latestDb));
      broadcastSse('new_test', record);
    }, 1200);

    res.status(201).json({
      ok: true,
      test: record,
      deviceStatus: computeEffectiveDeviceStatus(db),
    });
  });

  app.post('/api/device/heartbeat', (req, res) => {
    const db = loadDb();
    const deviceKeyHeader = req.headers['x-device-key'];
    const token = extractTokenFromReq(req);
    const hasValidSession = token ? Boolean(verifyToken(token)) : false;
    const hasValidDeviceKey =
      typeof deviceKeyHeader === 'string' && deviceKeyHeader === db.settings.deviceApiKey;

    if (!hasValidSession && !hasValidDeviceKey) {
      res.status(401).json({ error: 'Unauthorized device heartbeat.' });
      return;
    }

    const { deviceId, wifiRssi, firmwareVersion, batteryPercent, state } = req.body as {
      deviceId?: string;
      wifiRssi?: number;
      firmwareVersion?: string;
      batteryPercent?: number;
      state?: 'Device Connected' | 'Processing Sample' | 'Data Receiving';
    };

    const nowIso = new Date().toISOString();
    if (deviceId) db.settings.deviceId = deviceId.trim().slice(0, 64);
    db.deviceRuntime.connectionState = state || 'Device Connected';
    db.deviceRuntime.lastHeartbeatAt = nowIso;
    if (typeof wifiRssi === 'number') db.deviceRuntime.wifiRssi = wifiRssi;
    if (typeof firmwareVersion === 'string') db.deviceRuntime.firmwareVersion = firmwareVersion.slice(0, 40);
    if (typeof batteryPercent === 'number') db.deviceRuntime.batteryPercent = batteryPercent;
    db.deviceRuntime.ipAddress = req.ip || 'Wi-Fi Client';
    appendDeviceEvent(db, 'info', `Heartbeat received from ${db.settings.deviceId}.`);
    saveDb(db);

    const status = computeEffectiveDeviceStatus(db);
    broadcastSse('device_status', status);
    res.json({ ok: true, deviceStatus: status });
  });

  app.get('/api/device/status', requireAuth, (_req, res) => {
    const db = loadDb();
    res.json({ deviceStatus: computeEffectiveDeviceStatus(db), settings: db.settings });
  });

  app.post('/api/device/simulate', requireAuth, (req, res) => {
    const db = loadDb();
    if (db.settings.mode !== 'demo') {
      res.status(400).json({
        error: 'Simulated capture is only available in Demo Mode. Switch to Demo Mode in the top bar or Settings.',
      });
      return;
    }
    const { patientId, preset } = req.body as {
      patientId?: string;
      preset?: 'normal' | 'glucose_alert' | 'uti_review';
    };

    const patient = db.patients.find((p) => p.id === patientId) || db.patients[0];
    if (!patient) {
      res.status(400).json({ error: 'Please add a patient before running a simulated test.' });
      return;
    }

    const presets: Record<'normal' | 'glucose_alert' | 'uti_review', UrinalysisReadings> = {
      normal: {
        glucose: 'Negative',
        protein: 'Negative',
        ph: 6.5,
        ketones: 'Negative',
        blood: 'Negative',
        specificGravity: 1.015,
        bilirubin: 'Negative',
        urobilinogen: 0.4,
        nitrite: 'Negative',
        leukocytes: 'Negative',
      },
      glucose_alert: {
        glucose: '+2 (500 mg/dL)',
        protein: 'Trace (15 mg/dL)',
        ph: 5.5,
        ketones: 'Small (15 mg/dL)',
        blood: 'Negative',
        specificGravity: 1.028,
        bilirubin: 'Negative',
        urobilinogen: 0.6,
        nitrite: 'Negative',
        leukocytes: 'Negative',
      },
      uti_review: {
        glucose: 'Negative',
        protein: 'Trace (15 mg/dL)',
        ph: 7.5,
        ketones: 'Negative',
        blood: 'Small (+1)',
        specificGravity: 1.02,
        bilirubin: 'Negative',
        urobilinogen: 0.4,
        nitrite: 'Positive',
        leukocytes: 'Moderate (125 WBC/µL)',
      },
    };

    const selectedPreset = presets[preset || 'normal'];
    // Respect enabled hardware channels
    const filtered = { ...selectedPreset };
    for (const key of Object.keys(filtered) as ParameterKey[]) {
      if (!db.settings.enabledChannels[key]) {
        filtered[key] = null;
      }
    }

    const nowIso = new Date().toISOString();
    db.deviceRuntime.connectionState = 'Data Receiving';
    db.deviceRuntime.lastHeartbeatAt = nowIso;
    db.deviceRuntime.wifiRssi = -54;
    db.deviceRuntime.batteryPercent = 92;
    db.deviceRuntime.ipAddress = '192.168.1.48 (Simulated)';
    appendDeviceEvent(db, 'reading', `Demo simulator streaming sample for ${patient.name} (${patient.id}).`);
    saveDb(db);
    broadcastSse('device_status', computeEffectiveDeviceStatus(db));

    const record: UrinalysisTestRecord = {
      id: `TEST-${Date.now().toString().slice(-6)}`,
      deviceId: `${db.settings.deviceId}-SIM`,
      patientId: patient.id,
      patientName: patient.name,
      timestamp: nowIso,
      mode: 'demo',
      source: 'simulated',
      readings: filtered,
      overallStatus: computeOverallStatus(filtered),
      clinicianNotes: 'Simulated demonstration reading generated for system verification.',
      saved: true,
    };

    setTimeout(() => {
      const stepDb = loadDb();
      stepDb.deviceRuntime.connectionState = 'Processing Sample';
      appendDeviceEvent(stepDb, 'info', `Processing simulated optical RGB strip array for ${record.id}.`);
      saveDb(stepDb);
      broadcastSse('device_status', computeEffectiveDeviceStatus(stepDb));
    }, 650);

    setTimeout(() => {
      const doneDb = loadDb();
      doneDb.tests.unshift(record);
      doneDb.deviceRuntime.connectionState = 'Device Connected';
      doneDb.deviceRuntime.lastReadingAt = new Date().toISOString();
      doneDb.deviceRuntime.lastHeartbeatAt = new Date().toISOString();
      appendDeviceEvent(doneDb, 'info', `Simulated test ${record.id} completed (${record.overallStatus}).`);
      saveDb(doneDb);
      broadcastSse('device_status', computeEffectiveDeviceStatus(doneDb));
      broadcastSse('new_test', record);
    }, 1450);

    res.json({ ok: true, pendingTestId: record.id, patientId: patient.id });
  });

  app.put('/api/device/config', requireAuth, (req, res) => {
    const db = loadDb();
    const { mode, deviceId, deviceApiKey, enabledChannels, heartbeatTimeoutSeconds, clinicName } = req.body as {
      mode?: OperationMode;
      deviceId?: string;
      deviceApiKey?: string;
      enabledChannels?: Record<ParameterKey, boolean>;
      heartbeatTimeoutSeconds?: number;
      clinicName?: string;
    };

    if (mode === 'demo' || mode === 'real') {
      db.settings.mode = mode;
      if (mode === 'real') {
        // Never pretend an ESP32 is connected unless it actually sent a recent heartbeat
        const lastHb = db.deviceRuntime.lastHeartbeatAt
          ? (Date.now() - new Date(db.deviceRuntime.lastHeartbeatAt).getTime()) / 1000
          : Infinity;
        if (lastHb > db.settings.heartbeatTimeoutSeconds) {
          db.deviceRuntime.connectionState = 'Device Disconnected';
          db.deviceRuntime.wifiRssi = null;
          db.deviceRuntime.batteryPercent = null;
          db.deviceRuntime.ipAddress = null;
        }
        appendDeviceEvent(db, 'warning', 'Switched to REAL IoT MODE. Listening for physical ESP32 telemetry.');
      } else {
        appendDeviceEvent(db, 'info', 'Switched to DEMO MODE. Simulated sample workflow enabled.');
      }
    }

    if (typeof deviceId === 'string' && deviceId.trim()) {
      db.settings.deviceId = deviceId.trim().slice(0, 64);
    }
    if (typeof deviceApiKey === 'string' && deviceApiKey.trim()) {
      db.settings.deviceApiKey = deviceApiKey.trim().slice(0, 128);
    }
    if (typeof clinicName === 'string' && clinicName.trim()) {
      db.settings.clinicName = clinicName.trim().slice(0, 100);
    }
    if (typeof heartbeatTimeoutSeconds === 'number' && heartbeatTimeoutSeconds >= 10 && heartbeatTimeoutSeconds <= 300) {
      db.settings.heartbeatTimeoutSeconds = Math.round(heartbeatTimeoutSeconds);
    }
    if (enabledChannels && typeof enabledChannels === 'object') {
      for (const param of URINALYSIS_PARAMETERS) {
        if (typeof enabledChannels[param.key] === 'boolean') {
          db.settings.enabledChannels[param.key] = enabledChannels[param.key];
        }
      }
    }

    saveDb(db);
    const status = computeEffectiveDeviceStatus(db);
    broadcastSse('device_status', status);
    res.json({ settings: db.settings, deviceStatus: status });
  });

  // SSE stream for live device telemetry & incoming readings
  app.get('/api/device/stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client: SseClient = { id: `SSE-${Date.now()}-${Math.random()}`, res };
    sseClients.add(client);

    const db = loadDb();
    res.write(`event: device_status\ndata: ${JSON.stringify(computeEffectiveDeviceStatus(db))}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(client);
    });
  });

  // ---------------- PDF Report Generation ----------------
  app.get('/api/reports/:testId/pdf', requireAuth, async (req, res) => {
    const db = loadDb();
    const test = db.tests.find((t) => t.id === req.params.testId);
    if (!test) {
      res.status(404).json({ error: 'Test report not found.' });
      return;
    }
    const patient = db.patients.find((p) => p.id === test.patientId);
    try {
      const pdfBuffer = await generateUrinalysisPdfBuffer(test, patient);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="UriSense-${test.id}-${test.patientId}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF generation failed.';
      res.status(500).json({ error: message });
    }
  });

  // ---------------- Gemini AI Chatbot (UriSense Assistant) ----------------
  app.get('/api/chats', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userChats = db.chats
      .filter((c) => c.userId === req.user!.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ chats: userChats });
  });

  app.post('/api/chats', requireAuth, (req: AuthenticatedRequest, res) => {
    const { title, patientId, testId } = req.body as {
      title?: string;
      patientId?: string | null;
      testId?: string | null;
    };
    const db = loadDb();
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: `CHAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: req.user!.id,
      title: (title || 'New Consultation').trim().slice(0, 80),
      patientId: patientId || null,
      testId: testId || null,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    db.chats.unshift(session);
    saveDb(db);
    res.status(201).json({ chat: session });
  });

  app.patch('/api/chats/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const idx = db.chats.findIndex((c) => c.id === req.params.id && c.userId === req.user!.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }
    const { patientId, testId, clearMessages } = req.body as {
      patientId?: string | null;
      testId?: string | null;
      clearMessages?: boolean;
    };
    if (patientId !== undefined) db.chats[idx].patientId = patientId;
    if (testId !== undefined) db.chats[idx].testId = testId;
    if (clearMessages) {
      db.chats[idx].messages = [];
      db.chats[idx].title = 'New Consultation';
    }
    db.chats[idx].updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ chat: db.chats[idx] });
  });

  app.delete('/api/chats/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const before = db.chats.length;
    db.chats = db.chats.filter((c) => !(c.id === req.params.id && c.userId === req.user!.id));
    if (db.chats.length === before) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }
    saveDb(db);
    res.json({ ok: true });
  });

  app.post('/api/chats/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { message, patientId, testId } = req.body as {
      message?: string;
      patientId?: string | null;
      testId?: string | null;
    };
    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const db = loadDb();
    const chatIdx = db.chats.findIndex((c) => c.id === req.params.id && c.userId === req.user!.id);
    if (chatIdx === -1) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }

    const session = db.chats[chatIdx];
    if (patientId !== undefined) session.patientId = patientId;
    if (testId !== undefined) session.testId = testId;

    const cleanPrompt = message.trim().slice(0, 4000);
    const patient = session.patientId ? db.patients.find((p) => p.id === session.patientId) ?? null : null;
    const test = session.testId ? db.tests.find((t) => t.id === session.testId) ?? null : null;

    const priorHistory = [...session.messages];

    try {
      const replyText = await generateAssistantReply(priorHistory, cleanPrompt, {
        deviceStatus: computeEffectiveDeviceStatus(db),
        patient,
        test,
      });

      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: `MSG-U-${Date.now()}`,
        role: 'user',
        content: cleanPrompt,
        timestamp: now,
        attachedTestId: test?.id ?? null,
      };
      const aiMsg: ChatMessage = {
        id: `MSG-A-${Date.now() + 1}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toISOString(),
        attachedTestId: test?.id ?? null,
      };

      session.messages.push(userMsg, aiMsg);
      if (session.messages.length <= 2 && (session.title === 'New Consultation' || !session.title)) {
        session.title = cleanPrompt.slice(0, 48) + (cleanPrompt.length > 48 ? '...' : '');
      }
      session.updatedAt = new Date().toISOString();
      db.chats[chatIdx] = session;
      saveDb(db);

      res.json({ chat: session, userMessage: userMsg, assistantMessage: aiMsg });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to communicate with Gemini AI.';
      const status = errMsg.includes('API_KEY_INVALID') || errMsg.includes('GEMINI_API_KEY')
        ? 400
        : errMsg.includes('PERMISSION_DENIED')
          ? 403
          : errMsg.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      res.status(status).json({ error: errMsg });
    }
  });

  // ---------------- Settings & Project Export ----------------
  app.get('/api/settings', requireAuth, (_req, res) => {
    const db = loadDb();
    res.json({ settings: db.settings });
  });

  app.get('/api/project/zip', requireAuth, (_req, res) => {
    const rootDir = process.cwd();
    const outZip = path.join(os.tmpdir(), `urisense-ai-${Date.now()}.zip`);
    const pyScript = [
      'import os, sys, zipfile',
      'root, out = sys.argv[1], sys.argv[2]',
      'skip_dirs = {"node_modules", "dist", ".git", "data", "__pycache__"}',
      'with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:',
      '    for dirpath, dirnames, filenames in os.walk(root):',
      '        dirnames[:] = [d for d in dirnames if d not in skip_dirs]',
      '        for f in filenames:',
      '            if f.startswith(".env") and f != ".env.example":',
      '                continue',
      '            if f.endswith(".zip"):',
      '                continue',
      '            full = os.path.join(dirpath, f)',
      '            rel = os.path.relpath(full, root)',
      '            zf.write(full, os.path.join("urisense-ai", rel))',
    ].join('\n');

    execFile('python3', ['-c', pyScript, rootDir, outZip], (err) => {
      if (err) {
        res.status(500).json({ error: `Failed to package project zip: ${err.message}` });
        return;
      }
      res.download(outZip, 'urisense-ai-full-project.zip', () => {
        fs.unlink(outZip, () => {});
      });
    });
  });

  // ---------------- Frontend Serving (Vite Dev / Production Dist) ----------------
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UriSense AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start UriSense AI server:', err);
  process.exit(1);
});
