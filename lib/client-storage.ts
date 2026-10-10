import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Recording, TranscriptionStatus, SupabaseConfigStatus } from './types';

const STORAGE_KEY_RECORDINGS = 'transcription_recordings_cache';
const STORAGE_KEY_SUPABASE_URL = 'transcription_supabase_url';
const STORAGE_KEY_SUPABASE_KEY = 'transcription_supabase_anon_key';

/**
 * Retrieve stored Supabase credentials (from env or localStorage)
 */
export function getStoredSupabaseCredentials(): { url: string; key: string } {
  let url = '';
  let key = '';

  // 1. Check Vite / Next.js environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    url = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '') as string;
    key = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '') as string;
  }

  // 2. Check localStorage overrides if window available
  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem(STORAGE_KEY_SUPABASE_URL);
    const localKey = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY);
    if (localUrl) url = localUrl;
    if (localKey) key = localKey;
  }

  return {
    url: url.trim().replace(/\/+$/, ''),
    key: key.trim(),
  };
}

export function saveStoredSupabaseCredentials(url: string, key: string) {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = key.trim();

  if (cleanUrl) {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, cleanUrl);
  } else {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_URL);
  }

  if (cleanKey) {
    localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_KEY);
  }

  // Reset client cache
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;
let lastClientConfig = { url: '', key: '' };

export function getClientSupabase(): SupabaseClient | null {
  const { url, key } = getStoredSupabaseCredentials();
  if (!url || !key || !url.startsWith('http')) {
    return null;
  }

  if (cachedClient && lastClientConfig.url === url && lastClientConfig.key === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    lastClientConfig = { url, key };
    return cachedClient;
  } catch (err) {
    console.warn('[ClientStorage] Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Check connection status of Supabase directly on the client
 */
export async function checkClientSupabaseStatus(): Promise<SupabaseConfigStatus> {
  const { url, key } = getStoredSupabaseCredentials();
  const isConfigured = Boolean(url && key && url.startsWith('http') && key.length > 10);

  if (!isConfigured) {
    return {
      isConfigured: false,
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(key),
      hasServiceKey: false,
      isConnected: false,
      error: 'Supabase credentials not configured. Using client storage.',
    };
  }

  const client = getClientSupabase();
  if (!client) {
    return {
      isConfigured: true,
      hasUrl: true,
      hasAnonKey: true,
      hasServiceKey: false,
      isConnected: false,
      error: 'Unable to initialize Supabase client.',
    };
  }

  try {
    const { error } = await client.from('recordings').select('id').limit(1);
    if (error) {
      return {
        isConfigured: true,
        hasUrl: true,
        hasAnonKey: true,
        hasServiceKey: false,
        isConnected: false,
        error: error.message.includes('relation "recordings" does not exist')
          ? "Connected to Supabase, but the 'recordings' table has not been created yet. Run the SQL schema to create it."
          : `Supabase query error: ${error.message}`,
      };
    }

    return {
      isConfigured: true,
      hasUrl: true,
      hasAnonKey: true,
      hasServiceKey: false,
      isConnected: true,
      error: null,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      hasUrl: true,
      hasAnonKey: true,
      hasServiceKey: false,
      isConnected: false,
      error: err.message || 'Failed to ping Supabase database.',
    };
  }
}

/**
 * Read recordings from client localStorage cache
 */
export function getLocalRecordings(): Recording[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECORDINGS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save recordings to client localStorage cache
 */
export function saveLocalRecordings(recordings: Recording[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_RECORDINGS, JSON.stringify(recordings));
  } catch (err) {
    console.warn('[ClientStorage] Error caching recordings to localStorage:', err);
  }
}

/**
 * Upsert a recording in localStorage cache
 */
export function upsertLocalRecording(rec: Partial<Recording> & { recording_key: string }): Recording {
  const current = getLocalRecordings();
  const now = new Date().toISOString();
  const transcriptText = rec.transcript ?? null;
  const transcriptPreview =
    rec.transcript_preview ||
    (transcriptText
      ? transcriptText.slice(0, 180).trim() + (transcriptText.length > 180 ? '...' : '')
      : null);
  const recordingName = rec.recording_name || rec.recording_key;

  const idx = current.findIndex((r) => r.recording_key === rec.recording_key);
  let updatedRecord: Recording;

  if (idx >= 0) {
    updatedRecord = {
      ...current[idx],
      ...rec,
      recording_name: recordingName,
      transcript_preview: transcriptPreview,
      updated_at: now,
    };
    current[idx] = updatedRecord;
  } else {
    updatedRecord = {
      id: rec.id || crypto.randomUUID(),
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
    current.push(updatedRecord);
  }

  saveLocalRecordings(current);
  return updatedRecord;
}

/**
 * Query recordings from Supabase
 */
export async function getRecordingsFromSupabase(): Promise<Recording[] | null> {
  const client = getClientSupabase();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('recordings')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      saveLocalRecordings(data as Recording[]);
      return data as Recording[];
    }
  } catch (err) {
    console.warn('[ClientStorage] Error querying Supabase recordings:', err);
  }
  return null;
}

/**
 * Save recording to Supabase
 */
export async function saveRecordingToSupabase(rec: Partial<Recording> & { recording_key: string }): Promise<Recording> {
  const client = getClientSupabase();
  const now = new Date().toISOString();
  const transcriptText = rec.transcript ?? null;
  const transcriptPreview =
    rec.transcript_preview ||
    (transcriptText
      ? transcriptText.slice(0, 180).trim() + (transcriptText.length > 180 ? '...' : '')
      : null);
  const recordingName = rec.recording_name || rec.recording_key;

  // Always update local cache first
  const localUpdated = upsertLocalRecording(rec);

  if (client) {
    try {
      const payload: Record<string, any> = {
        recording_name: recordingName,
        recording_key: rec.recording_key,
        transcript_preview: transcriptPreview,
        file_size: rec.file_size,
        uploaded_at: rec.uploaded_at || now,
        transcription_status: rec.transcription_status || 'pending',
        transcript: transcriptText,
        transcript_key: rec.transcript_key ?? null,
        transcribed_at: rec.transcribed_at ?? null,
        updated_at: now,
      };

      const { data, error } = await client
        .from('recordings')
        .upsert(payload, { onConflict: 'recording_key' })
        .select('*')
        .single();

      if (!error && data) {
        upsertLocalRecording(data as Recording);
        return data as Recording;
      }
    } catch (err) {
      console.warn('[ClientStorage] Failed to upsert to Supabase, cached locally:', err);
    }
  }

  return localUpdated;
}
