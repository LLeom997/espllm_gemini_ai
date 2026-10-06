import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import {
  getRecordings,
  transcribeRecording,
  getTranscript,
  WORKER_URL,
} from './lib/api/worker';
import {
  getAllRecordings,
  syncRecordingsFromWorker,
  saveTranscript,
  updateRecordingStatus,
  getRecordingByKey,
  getSupabaseStatus,
  updateSupabaseCredentials,
} from './server/storage';
import { SUPABASE_SQL_SCHEMA } from './lib/constants';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Request logging for API routes
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

/**
 * GET /api/health
 * Health check and configuration status
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const supabaseStatus = await getSupabaseStatus();
  res.json({
    status: 'ok',
    workerUrl: WORKER_URL,
    supabase: supabaseStatus,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/schema or /api/schema.sql
 * Return SQL schema for Supabase
 */
app.get(['/api/schema', '/api/schema.sql'], (req: Request, res: Response) => {
  if (req.path.endsWith('.sql')) {
    res.setHeader('Content-Disposition', 'attachment; filename="supabase-recordings-schema.sql"');
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(SUPABASE_SQL_SCHEMA);
});

/**
 * POST /api/settings/supabase
 * Dynamically configure or update Supabase credentials
 */
app.post('/api/settings/supabase', async (req: Request, res: Response) => {
  try {
    const { url, key } = req.body || {};
    if (!url || !key) {
      return res.status(400).json({ error: 'Supabase URL and API Key are required' });
    }

    const status = await updateSupabaseCredentials(url, key);
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update Supabase credentials' });
  }
});

/**
 * GET /api/recordings
 * Fetch all recordings from database
 */
app.get('/api/recordings', async (_req: Request, res: Response) => {
  try {
    const recordings = await getAllRecordings();
    res.json({ recordings, count: recordings.length });
  } catch (err: any) {
    console.error('[API] /api/recordings error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch recordings' });
  }
});

/**
 * POST /api/sync
 * 1. Calls Worker GET /files
 * 2. Synchronizes files with Supabase
 * 3. Preserves completed transcripts
 */
app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    // 1. Fetch from worker
    const workerFiles = await getRecordings();

    // 2. Synchronize to Supabase / store
    const syncedRecordings = await syncRecordingsFromWorker(workerFiles);

    // Optional: Auto-fetch existing transcripts from Worker for any recordings that have .txt in bucket but not in DB
    const txtKeys = new Set(
      workerFiles
        .filter((f) => f.key.endsWith('.txt'))
        .map((f) => f.key.slice(0, -4).replace(/^\/+/, ''))
    );

    for (const rec of syncedRecordings) {
      if (rec.transcription_status === 'pending' && !rec.transcript && txtKeys.has(rec.recording_key)) {
        try {
          const existingText = await getTranscript(rec.recording_key);
          if (existingText && existingText.trim().length > 0) {
            await saveTranscript(rec.recording_key, existingText.trim(), `${rec.recording_key}.txt`);
            rec.transcription_status = 'completed';
            rec.transcript = existingText.trim();
            rec.transcript_key = `${rec.recording_key}.txt`;
            rec.transcribed_at = new Date().toISOString();
          }
        } catch {
          // Ignore if transcript not reachable
        }
      }
    }

    res.json({
      success: true,
      recordings: syncedRecordings,
      totalWorkerFiles: workerFiles.length,
      syncedCount: syncedRecordings.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[API] /api/sync error:', err);
    res.status(502).json({
      error: `Worker sync failed: ${err.message || 'Worker unavailable'}`,
      details: err.stack,
    });
  }
});

/**
 * POST /api/transcribe/:filename(*) or POST /api/transcribe
 * Triggers transcription on the Worker and saves to Supabase
 */
const handleTranscribe = async (filename: string, res: Response) => {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const cleanFilename = filename.replace(/^\/+/, '');

  try {
    // 1. Update status to 'processing'
    await updateRecordingStatus(cleanFilename, 'processing');

    // 2. Request transcription from Worker
    const result = await transcribeRecording(cleanFilename);

    // 3. Save to Supabase
    const updated = await saveTranscript(
      cleanFilename,
      result.transcript,
      result.transcriptKey || `${cleanFilename}.txt`
    );

    return res.json({
      success: true,
      recording: updated,
      transcript: result.transcript,
      transcriptKey: result.transcriptKey,
    });
  } catch (err: any) {
    console.error(`[API] Transcribe failed for ${cleanFilename}:`, err);
    // Mark as failed in Supabase
    await updateRecordingStatus(cleanFilename, 'failed', err.message);

    return res.status(502).json({
      error: `Transcription failed for ${cleanFilename}: ${err.message || 'Worker error'}`,
      filename: cleanFilename,
    });
  }
};

app.post('/api/transcribe', async (req: Request, res: Response) => {
  const filename = req.body?.filename || req.query?.filename;
  return handleTranscribe(String(filename || ''), res);
});

app.post('/api/transcribe/*', async (req: Request, res: Response) => {
  const filename = req.params[0];
  return handleTranscribe(filename, res);
});

/**
 * GET /api/transcript/:filename(*) or GET /api/transcript
 * Retrieves transcript text from database or Worker
 */
const handleGetTranscript = async (filename: string, res: Response) => {
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  const cleanFilename = filename.replace(/^\/+/, '');

  try {
    // Check Supabase first
    const record = await getRecordingByKey(cleanFilename);
    if (record?.transcript) {
      return res.json({
        filename: cleanFilename,
        transcript: record.transcript,
        source: 'database',
        transcribed_at: record.transcribed_at,
      });
    }

    // Fall back to Worker
    const text = await getTranscript(cleanFilename);
    if (text) {
      // Save it to Supabase since we have it
      await saveTranscript(cleanFilename, text, `${cleanFilename}.txt`);
      return res.json({
        filename: cleanFilename,
        transcript: text,
        source: 'worker',
      });
    }

    return res.status(404).json({ error: `Transcript not found for ${cleanFilename}` });
  } catch (err: any) {
    console.error(`[API] Get transcript failed for ${cleanFilename}:`, err);
    return res.status(502).json({
      error: `Failed to retrieve transcript: ${err.message || 'Worker error'}`,
    });
  }
};

app.get('/api/transcript', async (req: Request, res: Response) => {
  const filename = req.query?.filename;
  return handleGetTranscript(String(filename || ''), res);
});

app.get('/api/transcript/*', async (req: Request, res: Response) => {
  const filename = req.params[0];
  return handleGetTranscript(filename, res);
});

// Setup Vite or static serving
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (isDev || !fs.existsSync(distPath)) {
    console.log('[Server] Initializing Vite dev middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Server] Serving production build from dist/');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Transcription Dashboard running at http://0.0.0.0:${PORT}`);
    console.log(`[Server] Worker URL: ${WORKER_URL}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
