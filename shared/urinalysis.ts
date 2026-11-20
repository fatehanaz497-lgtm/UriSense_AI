export type OperationMode = 'demo' | 'real';

export type DeviceConnectionState =
  | 'Device Connected'
  | 'Device Disconnected'
  | 'Data Receiving'
  | 'Processing Sample';

export type ParameterKey =
  | 'glucose'
  | 'protein'
  | 'ph'
  | 'ketones'
  | 'blood'
  | 'specificGravity'
  | 'bilirubin'
  | 'urobilinogen'
  | 'nitrite'
  | 'leukocytes';

export type ParameterStatus = 'Normal' | 'Abnormal' | 'Needs Review' | 'Not Measured';

export type OverallTestStatus = 'Normal' | 'Needs Review' | 'Abnormal';

export type ReadingValue = string | number | null;

export type UrinalysisReadings = Record<ParameterKey, ReadingValue>;

export interface ParameterDefinition {
  key: ParameterKey;
  name: string;
  shortLabel: string;
  unit: string;
  referenceRange: string;
  inputType: 'select' | 'number';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  explanation: string;
}

export const URINALYSIS_PARAMETERS: ParameterDefinition[] = [
  {
    key: 'glucose',
    name: 'Glucose',
    shortLabel: 'GLU',
    unit: 'mg/dL',
    referenceRange: 'Negative (< 15 mg/dL)',
    inputType: 'select',
    options: ['Negative', 'Trace (100 mg/dL)', '+1 (250 mg/dL)', '+2 (500 mg/dL)', '+3 (1000+ mg/dL)'],
    explanation:
      'Sugar is normally filtered back into the blood by the kidneys. Glucose in urine can happen when blood sugar is elevated.',
  },
  {
    key: 'protein',
    name: 'Protein',
    shortLabel: 'PRO',
    unit: 'mg/dL',
    referenceRange: 'Negative (< 15 mg/dL)',
    inputType: 'select',
    options: ['Negative', 'Trace (15 mg/dL)', '+1 (30 mg/dL)', '+2 (100 mg/dL)', '+3 (300+ mg/dL)'],
    explanation:
      'Healthy kidneys keep most proteins in the bloodstream. Persistent protein in urine can be an early sign that kidney filters need review.',
  },
  {
    key: 'ph',
    name: 'pH',
    shortLabel: 'pH',
    unit: 'pH',
    referenceRange: '4.5 – 8.0',
    inputType: 'number',
    min: 4.0,
    max: 9.0,
    step: 0.5,
    explanation:
      'Urine pH measures how acidic or alkaline the sample is. Diet, hydration, and metabolism all influence daily pH levels.',
  },
  {
    key: 'ketones',
    name: 'Ketones',
    shortLabel: 'KET',
    unit: 'mg/dL',
    referenceRange: 'Negative (< 5 mg/dL)',
    inputType: 'select',
    options: ['Negative', 'Trace (5 mg/dL)', 'Small (15 mg/dL)', 'Moderate (40 mg/dL)', 'Large (80+ mg/dL)'],
    explanation:
      'Ketones appear when the body breaks down fat for energy instead of glucose, such as during fasting, low-carb diets, or uncontrolled diabetes.',
  },
  {
    key: 'blood',
    name: 'Blood',
    shortLabel: 'BLD',
    unit: 'RBC/µL',
    referenceRange: 'Negative',
    inputType: 'select',
    options: ['Negative', 'Trace (Non-hemolyzed)', 'Small (+1)', 'Moderate (+2)', 'Large (+3)'],
    explanation:
      'Detects red blood cells or hemoglobin. Even small amounts should be reviewed by a clinician to rule out infection, irritation, or kidney stones.',
  },
  {
    key: 'specificGravity',
    name: 'Specific Gravity',
    shortLabel: 'SG',
    unit: 'SG',
    referenceRange: '1.005 – 1.030',
    inputType: 'number',
    min: 1.0,
    max: 1.04,
    step: 0.005,
    explanation:
      'Shows how concentrated your urine is compared to pure water. It is a helpful indicator of hydration status.',
  },
  {
    key: 'bilirubin',
    name: 'Bilirubin',
    shortLabel: 'BIL',
    unit: 'mg/dL',
    referenceRange: 'Negative',
    inputType: 'select',
    options: ['Negative', 'Small (+1)', 'Moderate (+2)', 'Large (+3)'],
    explanation:
      'Bilirubin is a yellow pigment processed by the liver. Healthy urine normally contains no detectable bilirubin.',
  },
  {
    key: 'urobilinogen',
    name: 'Urobilinogen',
    shortLabel: 'URO',
    unit: 'mg/dL',
    referenceRange: '0.2 – 1.0 mg/dL',
    inputType: 'number',
    min: 0.0,
    max: 8.0,
    step: 0.2,
    explanation:
      'Formed from bilirubin breakdown in the digestive tract. Small amounts are normal; elevated values can relate to liver or red blood cell turnover.',
  },
  {
    key: 'nitrite',
    name: 'Nitrite',
    shortLabel: 'NIT',
    unit: 'Qualitative',
    referenceRange: 'Negative',
    inputType: 'select',
    options: ['Negative', 'Positive'],
    explanation:
      'Certain bacteria convert urinary nitrates into nitrites. A positive result often points toward a possible urinary tract infection.',
  },
  {
    key: 'leukocytes',
    name: 'Leukocytes',
    shortLabel: 'LEU',
    unit: 'WBC/µL',
    referenceRange: 'Negative (< 15 WBC/µL)',
    inputType: 'select',
    options: ['Negative', 'Trace (15 WBC/µL)', 'Small (70 WBC/µL)', 'Moderate (125 WBC/µL)', 'Large (500 WBC/µL)'],
    explanation:
      'Leukocytes are white blood cells that respond to inflammation or infection in the urinary tract.',
  },
];

export function createEmptyReadings(): UrinalysisReadings {
  return {
    glucose: null,
    protein: null,
    ph: null,
    ketones: null,
    blood: null,
    specificGravity: null,
    bilirubin: null,
    urobilinogen: null,
    nitrite: null,
    leukocytes: null,
  };
}

export interface EvaluatedParameter {
  definition: ParameterDefinition;
  rawValue: ReadingValue;
  displayValue: string;
  status: ParameterStatus;
}

export function evaluateParameter(key: ParameterKey, value: ReadingValue): EvaluatedParameter {
  const definition = URINALYSIS_PARAMETERS.find((p) => p.key === key)!;

  if (value === null || value === undefined || value === '') {
    return {
      definition,
      rawValue: null,
      displayValue: 'Not measured',
      status: 'Not Measured',
    };
  }

  const str = String(value).trim();
  const lower = str.toLowerCase();

  if (key === 'ph') {
    const num = Number(value);
    if (Number.isNaN(num)) {
      return { definition, rawValue: value, displayValue: str, status: 'Needs Review' };
    }
    const status: ParameterStatus =
      num >= 4.5 && num <= 8.0 ? 'Normal' : num >= 4.0 && num <= 8.5 ? 'Needs Review' : 'Abnormal';
    return { definition, rawValue: num, displayValue: num.toFixed(1), status };
  }

  if (key === 'specificGravity') {
    const num = Number(value);
    if (Number.isNaN(num)) {
      return { definition, rawValue: value, displayValue: str, status: 'Needs Review' };
    }
    const status: ParameterStatus =
      num >= 1.005 && num <= 1.03 ? 'Normal' : num >= 1.001 && num <= 1.035 ? 'Needs Review' : 'Abnormal';
    return { definition, rawValue: num, displayValue: num.toFixed(3), status };
  }

  if (key === 'urobilinogen') {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      const status: ParameterStatus =
        num >= 0.2 && num <= 1.0 ? 'Normal' : num <= 2.0 ? 'Needs Review' : 'Abnormal';
      return { definition, rawValue: num, displayValue: `${num.toFixed(1)} mg/dL`, status };
    }
    if (lower.includes('normal') || lower.includes('0.2') || lower.includes('1.0')) {
      return { definition, rawValue: value, displayValue: str, status: 'Normal' };
    }
    return { definition, rawValue: value, displayValue: str, status: 'Needs Review' };
  }

  if (lower === 'negative' || lower === 'neg' || lower === 'normal' || lower === '0') {
    return { definition, rawValue: value, displayValue: 'Negative', status: 'Normal' };
  }

  if (lower.includes('trace') || lower.includes('small')) {
    return { definition, rawValue: value, displayValue: str, status: 'Needs Review' };
  }

  if (lower === 'positive' || lower.includes('+1') || lower.includes('+2') || lower.includes('+3') || lower.includes('moderate') || lower.includes('large')) {
    return { definition, rawValue: value, displayValue: str, status: 'Abnormal' };
  }

  // Fallback numeric handling for qualitative markers if ESP32 sends mg/dL numbers
  const num = Number(value);
  if (!Number.isNaN(num)) {
    if (key === 'glucose' || key === 'protein') {
      if (num < 15) return { definition, rawValue: num, displayValue: `${num} mg/dL (Negative)`, status: 'Normal' };
      if (num < 30) return { definition, rawValue: num, displayValue: `${num} mg/dL (Trace)`, status: 'Needs Review' };
      return { definition, rawValue: num, displayValue: `${num} mg/dL`, status: 'Abnormal' };
    }
    if (key === 'ketones') {
      if (num < 5) return { definition, rawValue: num, displayValue: `${num} mg/dL (Negative)`, status: 'Normal' };
      if (num < 15) return { definition, rawValue: num, displayValue: `${num} mg/dL (Trace)`, status: 'Needs Review' };
      return { definition, rawValue: num, displayValue: `${num} mg/dL`, status: 'Abnormal' };
    }
    if (key === 'leukocytes') {
      if (num < 15) return { definition, rawValue: num, displayValue: `${num} WBC/µL (Negative)`, status: 'Normal' };
      if (num < 70) return { definition, rawValue: num, displayValue: `${num} WBC/µL (Trace)`, status: 'Needs Review' };
      return { definition, rawValue: num, displayValue: `${num} WBC/µL`, status: 'Abnormal' };
    }
  }

  return { definition, rawValue: value, displayValue: str, status: 'Needs Review' };
}

export function evaluateAllReadings(readings: UrinalysisReadings): EvaluatedParameter[] {
  return URINALYSIS_PARAMETERS.map((param) => evaluateParameter(param.key, readings[param.key]));
}

export function computeOverallStatus(readings: UrinalysisReadings): OverallTestStatus {
  const evaluated = evaluateAllReadings(readings).filter((e) => e.status !== 'Not Measured');
  if (evaluated.some((e) => e.status === 'Abnormal')) {
    return 'Abnormal';
  }
  if (evaluated.some((e) => e.status === 'Needs Review')) {
    return 'Needs Review';
  }
  return 'Normal';
}

export function buildEducationalSummary(readings: UrinalysisReadings): string {
  const evaluated = evaluateAllReadings(readings);
  const measured = evaluated.filter((e) => e.status !== 'Not Measured');
  if (measured.length === 0) {
    return 'No sensor readings were recorded for this test.';
  }
  const abnormal = measured.filter((e) => e.status === 'Abnormal');
  const review = measured.filter((e) => e.status === 'Needs Review');

  if (abnormal.length === 0 && review.length === 0) {
    return `All ${measured.length} measured urine parameters are within expected reference ranges. Stay well hydrated and continue routine monitoring as advised by your healthcare provider.`;
  }

  const flaggedNames = [...abnormal, ...review].map((e) => `${e.definition.name} (${e.displayValue})`).join(', ');
  return `${measured.length} parameters were measured. Highlighted findings requiring attention: ${flaggedNames}. These results are educational indicators only and should be reviewed with a qualified healthcare professional for proper clinical interpretation.`;
}

export interface PatientRecord {
  id: string;
  name: string;
  age: number;
  gender: 'Female' | 'Male' | 'Other';
  contact: string;
  registrationDate: string;
  notes?: string;
}

export interface UrinalysisTestRecord {
  id: string;
  deviceId: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  mode: OperationMode;
  source: 'esp32' | 'simulated' | 'manual';
  readings: UrinalysisReadings;
  overallStatus: OverallTestStatus;
  clinicianNotes: string;
  saved: boolean;
}

export interface DeviceTelemetryEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'reading' | 'warning' | 'error';
  message: string;
}

export interface DeviceStatusState {
  deviceId: string;
  mode: OperationMode;
  connectionState: DeviceConnectionState;
  lastHeartbeatAt: string | null;
  lastReadingAt: string | null;
  wifiRssi: number | null;
  firmwareVersion: string;
  ipAddress: string | null;
  batteryPercent: number | null;
  enabledChannels: Record<ParameterKey, boolean>;
  events: DeviceTelemetryEvent[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachedTestId?: string | null;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  patientId: string | null;
  testId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}
