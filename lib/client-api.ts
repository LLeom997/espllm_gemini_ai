/**
 * Unified Client API Service
 * Supports both:
 * 1. Server Mode (Express /api/* routes when hosted in Node/AI Studio)
 * 2. Direct Client Mode (Calls Cloudflare Worker & Supabase directly when deployed on Vercel, Netlify, or static hosts)
 * 
 * Automatically detects if /api/* routes return 404 on Vercel and seamlessly falls back
 * to direct Cloudflare Worker & Supabase client synchronization.
 */

import { Recording, SupabaseConfigStatus, TranscriptionStatus } from './types';
import { getRecordings, transcribeRecording, getTranscript, WORKER_URL } from './api/worker';
import {
  getLocalRecordings,
  getRecordingsFromSupabase,
  saveRecordingToSupabase,
  checkClientSupabaseStatus,
  saveStoredSupabaseCredentials,
  upsertLocalRecording,
  saveLocalRecordings,
} from './client-storage';
import { safeJsonParse } from './utils/api';

let directModeActive = false;

export function isDirectMode(): boolean {
  return directModeActive;
}

export function setDirectMode(active: boolean) {
  directModeActive = active;
}

/**
 * 1. Fetch current recordings
 */
export async function fetchRecordingsUnified(): Promise<Recording[]> {
  if (!directModeActive) {
    try {
      const res = await fetch('/api/recordings');
      if (res.status === 404) {
        console.info('[ClientAPI] /api/recordings returned 404. Switching to Direct Mode.');
        directModeActive = true;
      } else {
        const data = await safeJsonParse<{ recordings?: Recording[] }>(res);
        if (res.ok && Array.isArray(data?.recordings)) {
          // Keep local cache synced
          saveLocalRecordings(data.recordings);
          return data.recordings;
        }
      }
    } catch {
      // If server unreachable, fall back to direct mode
      directModeActive = true;
    }
  }

  // Direct Mode: Fetch from Supabase first, then local cache
  const supabaseRecs = await getRecordingsFromSupabase();
  if (supabaseRecs && supabaseRecs.length > 0) {
    return supabaseRecs;
  }

  return getLocalRecordings();
}

/**
 * 2. Synchronize recordings from Cloudflare Worker
 */
export async function syncRecordingsUnified(): Promise<{
  recordings: Recording[];
  syncedCount: number;
  totalWorkerFiles: number;
  source: 'server' | 'direct';
}> {
  if (!directModeActive) {
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.status === 404) {
        console.info('[ClientAPI] /api/sync returned 404 on host (e.g. Vercel). Activating Direct Mode.');
        directModeActive = true;
      } else {
        const data = await safeJsonParse<any>(res);
        if (res.ok && data?.recordings) {
          saveLocalRecordings(data.recordings);
          return {
            recordings: data.recordings,
            syncedCount: data.syncedCount || data.recordings.length,
            totalWorkerFiles: data.totalWorkerFiles || data.recordings.length,
            source: 'server',
          };
        }
        // If error message indicates 404 or page not found
        if (data?.error?.includes('404') || data?.error?.includes('page could not be found')) {
          directModeActive = true;
        } else {
          throw new Error(data?.error || `Server sync failed with HTTP ${res.status}`);
        }
      }
    } catch (err: any) {
      if (
        err.message?.includes('404') ||
        err.message?.includes('page could not be found') ||
        err.message?.includes('NOT_FOUND')
      ) {
        console.info('[ClientAPI] Vercel static deployment detected. Falling back to direct worker sync.');
        directModeActive = true;
      } else {
        throw err;
      }
    }
  }

  // Direct Mode Sync: Directly call Cloudflare Worker
  console.info('[ClientAPI] Running direct synchronization against Cloudflare Worker...');
  const workerFiles = await getRecordings();

  // Get current recordings from Supabase or cache
  const existingList = (await getRecordingsFromSupabase()) || getLocalRecordings();
  const existingMap = new Map<string, Recording>();
  existingList.forEach((r) => {
    existingMap.set(r.recording_key, r);
    existingMap.set(r.recording_key.replace(/^\/+/, ''), r);
  });

  // Collect .txt files from worker
  const txtMap = new Map<string, string>();
  workerFiles.forEach((f) => {
    if (f.key.endsWith('.txt')) {
      const base = f.key.slice(0, -4);
      txtMap.set(base, f.key);
      txtMap.set(base.replace(/^\/+/, ''), f.key);
    }
  });

  // Filter audio candidate recordings
  const audioCandidates = workerFiles.filter((f) => !f.key.endsWith('.txt'));
  const syncedList: Recording[] = [];
  const now = new Date().toISOString();

  for (const file of audioCandidates) {
    const rawKey = file.key;
    const cleanKey = rawKey.replace(/^\/+/, '');
    const existing = existingMap.get(rawKey) || existingMap.get(cleanKey);
    const hasTxt = txtMap.has(rawKey) || txtMap.has(cleanKey);

    let rec: Recording;

    if (existing) {
      rec = {
        ...existing,
        file_size: file.size,
        uploaded_at: file.uploaded || existing.uploaded_at,
        updated_at: now,
        transcript_key: existing.transcript_key || (hasTxt ? txtMap.get(rawKey) || txtMap.get(cleanKey) || null : null),
      };
    } else {
      rec = {
        id: crypto.randomUUID(),
        recording_name: cleanKey,
        recording_key: cleanKey,
        transcript_preview: null,
        file_size: file.size,
        uploaded_at: file.uploaded || now,
        transcription_status: 'pending',
        transcript: null,
        transcript_key: hasTxt ? txtMap.get(rawKey) || txtMap.get(cleanKey) || null : null,
        transcribed_at: null,
        created_at: now,
        updated_at: now,
        error_message: null,
      };
    }

    // Auto-fetch transcript if R2 bucket has .txt file and transcript is not yet loaded
    if ((!rec.transcript || rec.transcription_status !== 'completed') && hasTxt) {
      try {
        const text = await getTranscript(rawKey);
        if (text && text.trim().length > 0) {
          rec.transcript = text.trim();
          rec.transcript_preview =
            rec.transcript.slice(0, 180).trim() + (rec.transcript.length > 180 ? '...' : '');
          rec.transcription_status = 'completed';
          rec.transcript_key = txtMap.get(rawKey) || `${cleanKey}.txt`;
          rec.transcribed_at = now;
          rec.error_message = null;
        }
      } catch {
        // Continue if transcript retrieval fails
      }
    }

    const saved = await saveRecordingToSupabase(rec);
    syncedList.push(saved);
  }

  // Preserve any older records
  for (const existing of existingList) {
    if (!syncedList.some((r) => r.recording_key === existing.recording_key)) {
      syncedList.push(existing);
    }
  }

  saveLocalRecordings(syncedList);

  return {
    recordings: syncedList,
    syncedCount: syncedList.length,
    totalWorkerFiles: workerFiles.length,
    source: 'direct',
  };
}

/**
 * 3. Transcribe single recording
 */
export async function transcribeRecordingUnified(recordingKey: string): Promise<{
  recording: Recording;
  transcript: string;
  transcriptKey: string;
}> {
  if (!directModeActive) {
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: recordingKey }),
      });

      if (res.status === 404) {
        console.info('[ClientAPI] /api/transcribe returned 404. Falling back to direct transcription.');
        directModeActive = true;
      } else {
        const data = await safeJsonParse<any>(res);
        if (res.ok && data?.recording) {
          upsertLocalRecording(data.recording);
          return {
            recording: data.recording,
            transcript: data.transcript,
            transcriptKey: data.transcriptKey,
          };
        }
        if (data?.error?.includes('404') || data?.error?.includes('page could not be found')) {
          directModeActive = true;
        } else {
          throw new Error(data?.error || `Transcription failed with HTTP ${res.status}`);
        }
      }
    } catch (err: any) {
      if (
        err.message?.includes('404') ||
        err.message?.includes('page could not be found') ||
        err.message?.includes('NOT_FOUND')
      ) {
        directModeActive = true;
      } else {
        throw err;
      }
    }
  }

  // Direct Mode: Call Worker directly
  console.info(`[ClientAPI] Transcribing ${recordingKey} directly via Cloudflare Worker...`);
  const result = await transcribeRecording(recordingKey);

  const now = new Date().toISOString();
  const transcriptText = result.transcript;
  const transcriptPreview =
    transcriptText.slice(0, 180).trim() + (transcriptText.length > 180 ? '...' : '');

  const updatedRec: Partial<Recording> & { recording_key: string } = {
    recording_key: recordingKey,
    recording_name: recordingKey,
    transcript: transcriptText,
    transcript_preview: transcriptPreview,
    transcript_key: result.transcriptKey,
    transcription_status: 'completed',
    transcribed_at: now,
    updated_at: now,
    error_message: null,
  };

  const saved = await saveRecordingToSupabase(updatedRec);

  return {
    recording: saved,
    transcript: result.transcript,
    transcriptKey: result.transcriptKey,
  };
}

/**
 * 4. Retrieve health & Supabase status
 */
export async function getHealthStatusUnified(): Promise<{
  status: string;
  workerUrl: string;
  supabase: SupabaseConfigStatus;
  isDirectMode: boolean;
}> {
  if (!directModeActive) {
    try {
      const res = await fetch('/api/health');
      if (res.status === 404) {
        directModeActive = true;
      } else {
        const data = await safeJsonParse<any>(res);
        if (res.ok && data?.supabase) {
          return {
            status: 'ok',
            workerUrl: data.workerUrl || WORKER_URL,
            supabase: data.supabase,
            isDirectMode: false,
          };
        }
      }
    } catch {
      directModeActive = true;
    }
  }

  // Direct Mode
  const clientStatus = await checkClientSupabaseStatus();
  return {
    status: 'ok',
    workerUrl: WORKER_URL,
    supabase: clientStatus,
    isDirectMode: true,
  };
}

/**
 * 5. Update Supabase Credentials
 */
export async function updateSupabaseCredentialsUnified(url: string, key: string): Promise<SupabaseConfigStatus> {
  // Always update browser client storage immediately
  saveStoredSupabaseCredentials(url, key);

  // If server is available, also notify server
  if (!directModeActive) {
    try {
      const res = await fetch('/api/settings/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, key }),
      });
      if (res.ok) {
        const data = await safeJsonParse<any>(res);
        if (data?.status) return data.status;
      }
    } catch {
      // Ignore server failure and rely on client status
    }
  }

  return checkClientSupabaseStatus();
}
