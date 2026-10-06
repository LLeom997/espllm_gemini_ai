/**
 * Cloudflare Worker API Client for Transcription & R2 Audio
 * Base Worker: https://black-haze-8d76.lleom23.workers.dev
 */

import { TranscribeResponse, WorkerFile, WorkerFilesResponse } from '../types';
import { safeJsonParse } from '../utils/api';

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
      const errorText = await response.text().catch(() => '');
      throw new Error(`Worker returned HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const data: WorkerFilesResponse = await safeJsonParse<WorkerFilesResponse>(response);
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
 * Generates candidate path encodings for a given filename.
 * In Cloudflare R2, some keys contain leading slashes (e.g. "/Recording%20(20).m4a")
 * and others do not (e.g. "REC0015.WAV").
 */
function getPathCandidates(filename: string): string[] {
  const candidates: string[] = [];
  const trimmed = filename.trim();

  const addVariants = (str: string) => {
    candidates.push(encodeURIComponent(str));
    if (str.startsWith('/')) {
      candidates.push(encodeURIComponent(str.slice(1)));
    } else {
      candidates.push(encodeURIComponent(`/${str}`));
    }
  };

  addVariants(trimmed);

  // In Cloudflare R2, files uploaded with spaces can have keys literally named "/Recording%20(20).m4a"
  // To reach /transcript/{key} through Cloudflare routing, the % in %20 must be sent as %2520 and / as %2F
  const baseNoSlash = trimmed.replace(/^\/+/, '');
  const baseWithSlash = `/${baseNoSlash}`;

  [baseNoSlash, baseWithSlash].forEach((variant) => {
    // If it has spaces or %20
    const withPct20 = variant.replace(/ /g, '%20');
    const withDoublePct20 = withPct20.replace(/%20/g, '%2520');
    candidates.push(encodeURIComponent(withPct20));
    candidates.push(encodeURIComponent(withDoublePct20));
    // Literal path with %2F for leading slash
    if (variant.startsWith('/')) {
      candidates.push(`%2F${encodeURIComponent(withPct20.slice(1))}`);
      candidates.push(`%2F${withDoublePct20.slice(1)}`);
    }
  });

  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded !== trimmed) {
      addVariants(decoded);
    }
  } catch {}

  // Deduplicate preserving order
  return Array.from(new Set(candidates));
}

/**
 * 2. Transcribe recording
 * POST https://black-haze-8d76.lleom23.workers.dev/transcribe/{filename}
 */
export async function transcribeRecording(filename: string): Promise<TranscribeResponse> {
  const candidates = getPathCandidates(filename);
  let lastErrorMsg = 'Worker transcription failed';

  for (const encodedName of candidates) {
    const url = `${WORKER_URL}/transcribe/${encodedName}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await safeJsonParse<any>(response);
        if (data && typeof data.transcript === 'string') {
          return {
            filename: data.filename || filename,
            transcript: data.transcript,
            transcriptKey: data.transcriptKey || `${filename}.txt`,
          };
        }
      } else {
        const errText = await response.text().catch(() => '');
        lastErrorMsg = errText || response.statusText;
        // If not 404, stop trying candidates
        if (response.status !== 404) {
          throw new Error(`Worker returned HTTP ${response.status}: ${lastErrorMsg}`);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('Worker returned HTTP')) {
        throw error;
      }
      lastErrorMsg = error.message || 'Worker error';
    }
  }

  throw new Error(`Transcription failed for ${filename}: ${lastErrorMsg}`);
}

/**
 * 3. Retrieve existing transcript
 * GET https://black-haze-8d76.lleom23.workers.dev/transcript/{filename}
 */
export async function getTranscript(filename: string): Promise<string> {
  const candidates = getPathCandidates(filename);
  let lastError: Error | null = null;

  for (const encodedName of candidates) {
    const url = `${WORKER_URL}/transcript/${encodedName}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain, application/json, */*',
        },
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      }
    } catch (error: any) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Unable to retrieve transcript for ${filename}`);
}

