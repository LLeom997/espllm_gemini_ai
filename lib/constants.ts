export const SUPABASE_SQL_SCHEMA = `-- =========================================================================
-- Supabase Schema for Recording Transcription Dashboard
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================================

-- 1. Recordings Table
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_name TEXT NOT NULL,
  recording_key TEXT UNIQUE NOT NULL,
  transcript_preview TEXT,
  transcript TEXT,
  transcript_key TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  transcription_status TEXT NOT NULL DEFAULT 'pending',
  transcribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for speedy lookups and status filtering
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(transcription_status);
CREATE INDEX IF NOT EXISTS idx_recordings_uploaded ON recordings(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_name ON recordings(recording_name);

-- Row Level Security (RLS) for Recordings
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on recordings" ON recordings
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert and update on recordings" ON recordings
  FOR ALL USING (true);

-- 2. Daily Analysis Table (For OpenRouter Gemini batch insights)
CREATE TABLE IF NOT EXISTS daily_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_date DATE NOT NULL UNIQUE,
  recordings_count INT DEFAULT 0,
  analysis_type TEXT NOT NULL,
  model_used TEXT NOT NULL,
  analysis_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) for Daily Analyses
ALTER TABLE daily_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on daily_analyses" ON daily_analyses
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert and update on daily_analyses" ON daily_analyses
  FOR ALL USING (true);
`;

