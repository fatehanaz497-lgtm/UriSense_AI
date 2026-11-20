import { GoogleGenAI, type Content } from '@google/genai';
import {
  evaluateAllReadings,
  type ChatMessage,
  type DeviceStatusState,
  type PatientRecord,
  type UrinalysisTestRecord,
} from '../shared/urinalysis.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface AssistantContext {
  deviceStatus: DeviceStatusState;
  patient?: PatientRecord | null;
  test?: UrinalysisTestRecord | null;
}

function buildSystemInstruction(ctx: AssistantContext): string {
  const lines: string[] = [
    'You are UriSense Assistant, a friendly, professional educational assistant for the UriSense AI Smart AIoT Urinalysis System.',
    '',
    'WRITING STYLE RULES:',
    '- Write simple, beginner-friendly English.',
    '- Always use short paragraphs and clear headings (such as ## Summary, ## What This Means, ## Next Steps).',
    '- Never use slang, casual internet jargon, or overly technical medical jargon without explaining it simply.',
    '- Keep answers focused, accurate, and easy to read.',
    '',
    'SAFETY AND ACCURACY RULES:',
    '- Never invent, guess, or fabricate any urine test readings or sensor measurements.',
    '- If a parameter value is null or "Not measured", state clearly that the sensor or test strip did not measure that parameter.',
    '- Never diagnose a disease or medical condition based on urine test results alone.',
    '- Clearly explain when a result is "Abnormal" or "Needs Review" and recommend consulting a qualified healthcare professional when appropriate.',
    '- Maintain conversation context and answer follow-up questions naturally.',
    '',
    'CURRENT SYSTEM & IoT DEVICE CONTEXT:',
    `- Operation Mode: ${ctx.deviceStatus.mode === 'demo' ? 'DEMO MODE (Simulated sample data)' : 'REAL IoT MODE (ESP32 Hardware)'}`,
    `- Device ID: ${ctx.deviceStatus.deviceId}`,
    `- Connection Status: ${ctx.deviceStatus.connectionState}`,
    `- Last Heartbeat: ${ctx.deviceStatus.lastHeartbeatAt ?? 'None recorded'}`,
  ];

  if (ctx.patient && ctx.test) {
    const evaluated = evaluateAllReadings(ctx.test.readings);
    lines.push(
      '',
      'AUTHORIZED ATTACHED PATIENT & URINALYSIS REPORT:',
      `- Patient: ${ctx.patient.name} (ID: ${ctx.patient.id}, Age: ${ctx.patient.age}, Gender: ${ctx.patient.gender})`,
      `- Test ID: ${ctx.test.id}`,
      `- Test Timestamp: ${ctx.test.timestamp}`,
      `- Data Mode: ${ctx.test.mode === 'demo' ? 'Simulated Demo Sample' : 'Real ESP32 Hardware Reading'}`,
      `- Overall Screening Status: ${ctx.test.overallStatus}`,
      '- Measured Parameters:'
    );
    for (const item of evaluated) {
      lines.push(
        `  * ${item.definition.name}: ${item.displayValue} | Reference: ${item.definition.referenceRange} | Status: ${item.status}`
      );
    }
    if (ctx.test.clinicianNotes) {
      lines.push(`- Clinician Notes: ${ctx.test.clinicianNotes}`);
    }
    lines.push(
      'Use ONLY the verified values listed above when discussing this patient’s test results. Clearly mention whether the report is from Simulated Demo Mode or Real IoT Mode.'
    );
  } else if (ctx.patient) {
    lines.push(
      '',
      `SELECTED PATIENT: ${ctx.patient.name} (ID: ${ctx.patient.id}, Age: ${ctx.patient.age}, Gender: ${ctx.patient.gender})`,
      'No specific urinalysis test report is attached to this chat. If the user asks to explain their results, politely ask them to select a test report from the dropdown at the top of the chat or run a new test.'
    );
  } else {
    lines.push(
      '',
      'NO PATIENT REPORT ATTACHED:',
      'No patient test report is currently attached to this conversation. If the user asks about their personal urine test results, explain clearly that no test report is selected yet and invite them to attach a report using the selector above, without inventing any numbers.'
    );
  }

  return lines.join('\n');
}

export async function generateAssistantReply(
  historyMessages: ChatMessage[],
  userMessage: string,
  context: AssistantContext
): Promise<string> {
  const ai = getGeminiClient();

  const formattedHistory: Content[] = historyMessages
    .slice(-16)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

  const chat = ai.chats.create({
    model: 'gemini-4-hydrogen',
    config: {
      systemInstruction: buildSystemInstruction(context),
    },
    history: formattedHistory,
  });

  const response = await chat.sendMessage({
    message: userMessage,
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
}
