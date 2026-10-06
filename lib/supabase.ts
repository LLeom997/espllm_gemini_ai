/**
 * Browser-safe Supabase Client & Configuration
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SQL_SCHEMA } from './constants';

export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.VITE_SUPABASE_URL)) ||
  '';

export const SUPABASE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
  '';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_URL.startsWith('http') &&
  SUPABASE_KEY &&
  SUPABASE_KEY.length > 10
);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.warn('[Supabase] Client init failed:', err);
  }
}

export const supabase = client;
export { SUPABASE_SQL_SCHEMA };
