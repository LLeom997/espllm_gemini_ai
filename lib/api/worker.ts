/**
 * Cloudflare Worker API Client for Transcription & R2 Audio
 * Base Worker: https://black-haze-8d76.lleom23.workers.dev
 */

import { TranscribeResponse, WorkerFile, WorkerFilesResponse } from '../types';

// Centralized Worker URL with fallback to the configured worker
const getBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NEXT_PUBLIC_WORKER_URL) return process.env.NEXT_PUBLIC_WORKER_URL;
    if (process.env.VITE_WORKER_URL) return process.env.VITE_WORKER_URL;
  }
  // Vite client-side environment
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    if (import.meta.env.VITE_WORKER_URL) return import.meta.env.VITE_WORKER_URL;
    // @ts-ignore
    if (import.meta.env.NEXT_PUBLIC_WORKER_URL) return import.meta.env.NEXT_PUBLIC_WORKER_URL;
  }
  return 'https://black-haze-8d76.lleom23.workers.dev';
};

export const WORKER_URL = getBaseUrl().replace(/\/$/, '');

/**
 * Clean filename to ensure no leading slash interferes with worker route
 */
export function sanitizeFilename(filename: string): string {
  // Strip leading slash if present
  let clean = filename.trim().replace(/^\/+/, '');
  return clean;
}

/**
 * 1. Get recordings
 * GET https://black-haze-8d76.lleom23.workers.dev/files
 */
export async function getRecordings(): Promise<WorkerFile[]> {
  const url = `${WORKER_URL}/files`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Worker returned HTTP ${response.status} (${response.statusText})`);
    }

    const data: WorkerFilesResponse = await response.json();
    if (!data || !Array.isArray(data.files)) {
      throw new Error('Invalid response structure from Worker: missing files array');
    }

    return data.files;
  } catch (error: any) {
    console.error(`[Worker API] Failed to fetch recordings from ${url}:`, error);
    throw new Error(`Unable to fetch recordings: ${error.message || 'Network error'}`);
  }
}

/**
 * 2. Transcribe recording
 * POST https://black-haze-8d76.lleom23.workers.dev/transcribe/{filename}
 */
export async function transcribeRecording(filename: string): Promise<TranscribeResponse> {
  const sanitized = sanitizeFilename(filename);
  const encodedName = encodeURIComponent(sanitized);
  const url = `${WORKER_URL}/transcribe/${encodedName}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Transcription failed with HTTP ${response.status}: ${errorText || response.statusText}`
      );
    }

    const data = await response.json();
    if (!data || typeof data.transcript !== 'string') {
      throw new Error('Worker response missing expected transcript field');
    }

    return {
      filename: data.filename || sanitized,
      transcript: data.transcript,
      transcriptKey: data.transcriptKey || `${sanitized}.txt`,
    };
  } catch (error: any) {
    console.error(`[Worker API] Transcription failed for ${sanitized}:`, error);
    throw new Error(`Transcription failed for ${sanitized}: ${error.message || 'Worker error'}`);
  }
}

/**
 * 3. Retrieve existing transcript
 * GET https://black-haze-8d76.lleom23.workers.dev/transcript/{filename}
 */
export async function getTranscript(filename: string): Promise<string> {
  const sanitized = sanitizeFilename(filename);
  const encodedName = encodeURIComponent(sanitized);
  const url = `${WORKER_URL}/transcript/${encodedName}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain, application/json, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to retrieve transcript: HTTP ${response.status} (${response.statusText})`);
    }

    const text = await response.text();
    return text;
  } catch (error: any) {
    console.error(`[Worker API] Failed to retrieve transcript for ${sanitized}:`, error);
    throw new Error(`Unable to retrieve transcript for ${sanitized}: ${error.message || 'Worker error'}`);
  }
}
