/**
 * OpenRouter Gemini Integration Client
 * Allows analyzing day's recordings with Gemini via OpenRouter API
 */

import { OpenRouterConfig, Recording } from '../types';
import { safeJsonParse } from '../utils/api';

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_GEMINI_MODEL = 'google/gemini-2.5-flash';

export const GEMINI_MODEL_PRESETS = [
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', badge: 'Fast & Smart (Recommended)' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', badge: 'Complex Reasoning' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', badge: 'Ultra Fast' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash', badge: 'Standard' },
];

const STORAGE_KEY_KEY = 'openrouter_api_key';
const STORAGE_KEY_URL = 'openrouter_base_url';
const STORAGE_KEY_MODEL = 'openrouter_model';

export function normalizeOpenRouterBaseUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) return DEFAULT_OPENROUTER_BASE_URL;
  let clean = rawUrl.trim().replace(/\/+$/, '');
  // If user entered openrouter.ai without /api/v1
  if (clean === 'https://openrouter.ai' || clean === 'http://openrouter.ai') {
    return `${clean}/api/v1`;
  }
  if (clean.endsWith('/openrouter.ai/api')) {
    return `${clean}/v1`;
  }
  return clean;
}

export function getStoredOpenRouterConfig(): OpenRouterConfig {
  if (typeof window === 'undefined') {
    return {
      apiKey: '',
      baseUrl: DEFAULT_OPENROUTER_BASE_URL,
      model: DEFAULT_GEMINI_MODEL,
    };
  }

  const rawUrl = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_OPENROUTER_BASE_URL;
  return {
    apiKey: localStorage.getItem(STORAGE_KEY_KEY) || '',
    baseUrl: normalizeOpenRouterBaseUrl(rawUrl),
    model: localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_GEMINI_MODEL,
  };
}

export function saveStoredOpenRouterConfig(config: Partial<OpenRouterConfig>) {
  if (typeof window === 'undefined') return;

  if (config.apiKey !== undefined) {
    localStorage.setItem(STORAGE_KEY_KEY, config.apiKey.trim());
  }
  if (config.baseUrl !== undefined) {
    const normalized = normalizeOpenRouterBaseUrl(config.baseUrl);
    localStorage.setItem(STORAGE_KEY_URL, normalized);
  }
  if (config.model !== undefined) {
    localStorage.setItem(STORAGE_KEY_MODEL, config.model.trim() || DEFAULT_GEMINI_MODEL);
  }
}

/**
 * Test OpenRouter connection with a quick ping
 */
export async function testOpenRouterConnection(config: OpenRouterConfig): Promise<{ success: boolean; message: string }> {
  if (!config.apiKey || !config.apiKey.trim()) {
    throw new Error('Please enter your OpenRouter API key first');
  }

  const baseUrl = normalizeOpenRouterBaseUrl(config.baseUrl);
  const endpoint = `${baseUrl}/chat/completions`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.trim()}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://aistudio.google.com',
        'X-Title': 'Recording Transcription Dashboard',
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_GEMINI_MODEL,
        messages: [
          {
            role: 'user',
            content: 'Hello Gemini! Reply with exactly: "OpenRouter Gemini is connected and ready."',
          },
        ],
        max_tokens: 40,
      }),
    });
  } catch (netErr: any) {
    throw new Error(`Failed to reach OpenRouter endpoint (${endpoint}): ${netErr.message || 'Network error'}`);
  }

  const data = await safeJsonParse<any>(response);

  if (!response.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`OpenRouter Error (${response.status}): ${msg}`);
  }

  const content = data.choices?.[0]?.message?.content?.trim() || 'Connected successfully!';

  return {
    success: true,
    message: content,
  };
}

export interface AnalyzeDailyParams {
  date: string;
  recordings: Recording[];
  analysisType: 'summary' | 'action_items' | 'themes' | 'custom';
  customPrompt?: string;
  config: OpenRouterConfig;
}

/**
 * Run comprehensive Gemini analysis across a day's recording transcripts
 */
export async function analyzeDailyRecordings(params: AnalyzeDailyParams): Promise<string> {
  const { date, recordings, analysisType, customPrompt, config } = params;

  if (!config.apiKey || !config.apiKey.trim()) {
    throw new Error('OpenRouter API key is required. Please add your key in the AI Settings.');
  }

  // Filter only recordings with transcripts
  const transcribedRecordings = recordings.filter((r) => r.transcript && r.transcript.trim().length > 0);

  if (transcribedRecordings.length === 0) {
    throw new Error(`No transcripts found for ${date}. Transcribe at least one recording before analyzing.`);
  }

  // Build structured transcripts text
  const transcriptsBlock = transcribedRecordings
    .map((r, index) => {
      const time = r.uploaded_at ? new Date(r.uploaded_at).toLocaleTimeString() : 'Unknown time';
      return `### Recording ${index + 1}: ${r.recording_name || r.recording_key} (Uploaded: ${time})\n"${r.transcript}"\n`;
    })
    .join('\n');

  let instruction = '';
  switch (analysisType) {
    case 'summary':
      instruction = `Provide a comprehensive Executive Synthesis for the audio recordings from ${date}:
1. **Executive Overview**: High-level summary of what took place across all recordings.
2. **Chronological / Topic Flow**: Key milestones or discussions in sequence.
3. **Important Statements & Highlights**: Notable quotes or observations.
4. **Conclusion**: Overall takeaway for the day.`;
      break;

    case 'action_items':
      instruction = `Analyze all recordings from ${date} and extract actionable outputs:
1. **Direct Action Items**: Concrete tasks mentioned or implied, with owners/context where discernible.
2. **Decisions Made**: Explicit or implicit agreements and determinations.
3. **Follow-ups Needed**: Unresolved questions or items requiring further investigation.
4. **Key Deadlines / References**: Any dates, names, or metrics mentioned.`;
      break;

    case 'themes':
      instruction = `Conduct an in-depth thematic analysis of the recordings from ${date}:
1. **Core Discussion Themes**: Group discussions into 3-5 distinct thematic pillars.
2. **Cross-Recording Connections**: Ideas, topics, or patterns linking different audio files.
3. **Tone & Sentiment**: Mood, urgency, and clarity of the speakers.
4. **Notable Nuances**: Subtleties or interesting insights.`;
      break;

    case 'custom':
      instruction = customPrompt || `Provide an intelligent analysis of the recordings from ${date}.`;
      break;
  }

  const systemMessage = `You are an elite audio intelligence analyst powered by Google Gemini.
You have been provided with all audio transcriptions recorded on date: ${date}.
Analyze the transcripts thoroughly, connect ideas across recordings, and produce a clear, beautifully structured Markdown response with headers, bullet points, and bold emphasis.
Focus on accuracy to what was actually said, avoiding speculation.`;

  const userMessage = `${instruction}

---
## Transcribed Audio Recordings for ${date} (Total: ${transcribedRecordings.length})
${transcriptsBlock}
---
Please format your response in clean Markdown.`;

  const baseUrl = normalizeOpenRouterBaseUrl(config.baseUrl);
  const endpoint = `${baseUrl}/chat/completions`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.trim()}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://aistudio.google.com',
        'X-Title': 'Recording Transcription Dashboard',
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_GEMINI_MODEL,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
      }),
    });
  } catch (netErr: any) {
    throw new Error(`Failed to reach OpenRouter endpoint (${endpoint}): ${netErr.message || 'Network error'}`);
  }

  const data = await safeJsonParse<any>(response);

  if (!response.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`OpenRouter Gemini request failed (${response.status}): ${msg}`);
  }

  const result = data.choices?.[0]?.message?.content;

  if (!result) {
    throw new Error('Received empty response from OpenRouter Gemini');
  }

  return result;
}

