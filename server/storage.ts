import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Recording, TranscriptionStatus, SupabaseConfigStatus } from '../lib/types';
import { SUPABASE_SQL_SCHEMA } from '../lib/constants';
import fs from 'node:fs';
import path from 'node:path';

// Supabase environment keys
export const SUPABASE_URL = 
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

export const SUPABASE_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_URL.startsWith('http') && 
  SUPABASE_KEY && 
  SUPABASE_KEY.length > 10
);

let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
  }
}

// Fallback local persistent storage file when Supabase credentials are not yet supplied
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'recordings.json');

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[Storage] Error ensuring data file:', err);
  }
}

function readLocalRecordings(): Recording[] {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalRecordings(recordings: Recording[]) {
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(recordings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Failed to write local recordings:', err);
  }
}

/**
 * Get current Supabase connection status
 */
export async function getSupabaseStatus(): Promise<SupabaseConfigStatus> {
  if (!isSupabaseConfigured || !supabaseClient) {
    return {
      isConfigured: false,
      hasUrl: Boolean(SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
      hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      isConnected: false,
      error: 'Supabase credentials not configured in environment. Using persistent server store.',
    };
  }

  try {
    // Ping table
    const { error } = await supabaseClient.from('recordings').select('id').limit(1);
    if (error) {
      return {
        isConfigured: true,
        hasUrl: true,
        hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
        hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        isConnected: false,
        error: `Connected to Supabase project, but query on 'recordings' failed: ${error.message}. Table may need to be created.`,
      };
    }
    return {
      isConfigured: true,
      hasUrl: true,
      hasAnonKey: true,
      hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      isConnected: true,
      error: null,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      hasUrl: true,
      hasAnonKey: true,
      hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      isConnected: false,
      error: err.message || 'Failed to ping Supabase database',
    };
  }
}

/**
 * Fetch all recordings
 */
export async function getAllRecordings(): Promise<Recording[]> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('recordings')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (!error && data) {
        return data as Recording[];
      }
      console.warn('[Supabase] Query error, falling back to local persistent store:', error?.message);
    } catch (err) {
      console.warn('[Supabase] Exception querying recordings:', err);
    }
  }

  return readLocalRecordings();
}

/**
 * Get recording by key
 */
export async function getRecordingByKey(key: string): Promise<Recording | null> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('recordings')
        .select('*')
        .eq('recording_key', key)
        .maybeSingle();

      if (!error && data) {
        return data as Recording;
      }
    } catch (err) {
      console.warn('[Supabase] Error getting recording by key:', err);
    }
  }

  const list = readLocalRecordings();
  return list.find((r) => r.recording_key === key) || null;
}

/**
 * Update dynamic Supabase credentials at runtime from user settings
 */
export async function updateSupabaseCredentials(url: string, key: string): Promise<SupabaseConfigStatus> {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = key.trim();

  if (!cleanUrl || !cleanKey) {
    supabaseClient = null;
    return getSupabaseStatus();
  }

  try {
    const testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    // Test pinging recordings
    const { error } = await testClient.from('recordings').select('id').limit(1);
    if (error && !error.message.includes('relation "recordings" does not exist')) {
      throw new Error(error.message);
    }

    supabaseClient = testClient;
    process.env.SUPABASE_URL = cleanUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = cleanKey;

    return {
      isConfigured: true,
      hasUrl: true,
      hasAnonKey: true,
      hasServiceKey: true,
      isConnected: !error,
      error: error ? `Connected to Supabase, but 'recordings' table missing: ${error.message}` : null,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      hasUrl: true,
      hasAnonKey: true,
      hasServiceKey: true,
      isConnected: false,
      error: err.message || 'Failed to authenticate with Supabase',
    };
  }
}

/**
 * Upsert a single recording
 */
export async function upsertRecording(rec: Partial<Recording> & { recording_key: string }): Promise<Recording> {
  const now = new Date().toISOString();
  const transcriptText = rec.transcript ?? null;
  const transcriptPreview =
    rec.transcript_preview ||
    (transcriptText
      ? transcriptText.slice(0, 180).trim() + (transcriptText.length > 180 ? '...' : '')
      : null);
  const recordingName = rec.recording_name || rec.recording_key;
  
  if (supabaseClient) {
    try {
      const payload: Record<string, any> = {
        recording_name: recordingName,
        recording_key: rec.recording_key,
        transcript_preview: transcriptPreview,
        file_size: rec.file_size,
        uploaded_at: rec.uploaded_at,
        transcription_status: rec.transcription_status || 'pending',
        transcript: transcriptText,
        transcript_key: rec.transcript_key ?? null,
        transcribed_at: rec.transcribed_at ?? null,
        updated_at: now,
      };

      const { data, error } = await supabaseClient
        .from('recordings')
        .upsert(payload, { onConflict: 'recording_key' })
        .select('*')
        .single();

      if (!error && data) {
        return data as Recording;
      }
      console.warn('[Supabase] Upsert error, syncing to local store:', error?.message);
    } catch (err) {
      console.warn('[Supabase] Exception upserting recording:', err);
    }
  }

  // Fallback to local storage
  const list = readLocalRecordings();
  const existingIdx = list.findIndex((r) => r.recording_key === rec.recording_key);
  let updatedRecord: Recording;

  if (existingIdx >= 0) {
    updatedRecord = {
      ...list[existingIdx],
      ...rec,
      recording_name: recordingName,
      transcript_preview: transcriptPreview,
      updated_at: now,
    };
    list[existingIdx] = updatedRecord;
  } else {
    updatedRecord = {
      id: crypto.randomUUID(),
      recording_name: recordingName,
      recording_key: rec.recording_key,
      transcript_preview: transcriptPreview,
      file_size: rec.file_size || 0,
      uploaded_at: rec.uploaded_at || now,
      transcription_status: rec.transcription_status || 'pending',
      transcript: transcriptText,
      transcript_key: rec.transcript_key ?? null,
      transcribed_at: rec.transcribed_at ?? null,
      created_at: now,
      updated_at: now,
      error_message: null,
    };
    list.push(updatedRecord);
  }

  writeLocalRecordings(list);
  return updatedRecord;
}

/**
 * Batch synchronize recordings from Worker files
 */
export async function syncRecordingsFromWorker(workerFiles: { key: string; size: number; uploaded: string }[]): Promise<Recording[]> {
  const currentList = await getAllRecordings();
  const existingMap = new Map<string, Recording>();
  currentList.forEach((r) => existingMap.set(r.recording_key, r));

  const result: Recording[] = [];
  const now = new Date().toISOString();

  // Also check if any .txt files correspond to transcripts
  const txtFilesMap = new Map<string, string>();
  workerFiles.forEach((f) => {
    if (f.key.endsWith('.txt')) {
      // e.g. REC0020.WAV.txt -> base is REC0020.WAV
      const baseKey = f.key.slice(0, -4);
      txtFilesMap.set(baseKey, f.key);
      txtFilesMap.set(baseKey.replace(/^\/+/, ''), f.key);
    }
  });

  // Filter out .txt files as recording candidates (recordings are the audio files)
  const audioCandidates = workerFiles.filter((f) => !f.key.endsWith('.txt'));

  for (const file of audioCandidates) {
    const rawKey = file.key;
    const cleanKey = rawKey.replace(/^\/+/, '');
    const existing = existingMap.get(rawKey) || existingMap.get(cleanKey);

    const hasTxtFile = txtFilesMap.has(rawKey) || txtFilesMap.has(cleanKey);

    if (existing) {
      // Preserve existing transcript and completed status!
      const updated: Recording = {
        ...existing,
        file_size: file.size,
        uploaded_at: file.uploaded || existing.uploaded_at,
        updated_at: now,
        // If not completed yet but Worker has a .txt transcript file in R2, we note its transcript_key
        transcript_key: existing.transcript_key || (hasTxtFile ? (txtFilesMap.get(rawKey) || txtFilesMap.get(cleanKey) || null) : null),
      };

      await upsertRecording(updated);
      result.push(updated);
    } else {
      // Brand new recording
      const newRec: Recording = {
        id: crypto.randomUUID(),
        recording_key: cleanKey,
        file_size: file.size,
        uploaded_at: file.uploaded || now,
        transcription_status: 'pending',
        transcript: null,
        transcript_key: hasTxtFile ? (txtFilesMap.get(rawKey) || txtFilesMap.get(cleanKey) || null) : null,
        transcribed_at: null,
        created_at: now,
        updated_at: now,
      };

      const saved = await upsertRecording(newRec);
      result.push(saved);
    }
  }

  // Also preserve recordings that were already in the database
  for (const existing of currentList) {
    if (!result.some((r) => r.recording_key === existing.recording_key)) {
      result.push(existing);
    }
  }

  return result;
}

/**
 * Save transcription result
 */
export async function saveTranscript(
  recordingKey: string,
  transcript: string,
  transcriptKey: string
): Promise<Recording> {
  const existing = await getRecordingByKey(recordingKey);
  const now = new Date().toISOString();

  const toSave: Partial<Recording> & { recording_key: string } = {
    recording_key: recordingKey,
    file_size: existing?.file_size || 0,
    uploaded_at: existing?.uploaded_at || now,
    transcription_status: 'completed',
    transcript: transcript,
    transcript_key: transcriptKey,
    transcribed_at: now,
    error_message: null,
  };

  return upsertRecording(toSave);
}

/**
 * Update recording status (e.g. processing or failed)
 */
export async function updateRecordingStatus(
  recordingKey: string,
  status: TranscriptionStatus,
  errorMessage?: string
): Promise<Recording> {
  const existing = await getRecordingByKey(recordingKey);
  const now = new Date().toISOString();

  const toSave: Partial<Recording> & { recording_key: string } = {
    recording_key: recordingKey,
    file_size: existing?.file_size || 0,
    uploaded_at: existing?.uploaded_at || now,
    transcription_status: status,
    transcript: existing?.transcript || null,
    transcript_key: existing?.transcript_key || null,
    transcribed_at: existing?.transcribed_at || null,
    error_message: errorMessage || null,
  };

  return upsertRecording(toSave);
}

export { SUPABASE_SQL_SCHEMA };
