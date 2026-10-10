import React, { useState } from 'react';
import { SupabaseConfigStatus } from '../lib/types';
import { updateSupabaseCredentialsUnified } from '../lib/client-api';
import {
  Database,
  X,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code,
  Download,
  Key,
  Globe,
  RefreshCw,
  Layers,
  FileCode,
} from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../lib/constants';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SupabaseConfigStatus | null;
  onStatusUpdated?: (newStatus: SupabaseConfigStatus) => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'sql'>('connection');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy SQL', err);
    }
  };

  const handleDownloadSchema = () => {
    const blob = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase-transcription-schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setSaveMessage({ success: false, text: 'Please provide both Supabase URL and API Key.' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const newStatus = await updateSupabaseCredentialsUnified(supabaseUrl, supabaseKey);

      if (onStatusUpdated) {
        onStatusUpdated(newStatus);
      }

      setSaveMessage({
        success: newStatus.isConnected,
        text: newStatus.isConnected
          ? 'Successfully connected to Supabase and verified database!'
          : newStatus.error || 'Credentials saved, but verification failed.',
      });
    } catch (err: any) {
      setSaveMessage({ success: false, text: err.message || 'Error connecting to Supabase' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Supabase Metadata &amp; Transcript Store
              </h3>
              <p className="text-[11px] text-zinc-500">
                Store recording names, IDs, transcript previews, and daily analyses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-5 bg-zinc-50/30 dark:bg-zinc-950/30 text-xs">
          <button
            onClick={() => setActiveTab('connection')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'connection'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            Connection Settings
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <span>SQL Schema (schema.sql)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {activeTab === 'connection' ? (
            <div className="space-y-4">
              {/* Current Status banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  status?.isConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {status?.isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Layers className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {status?.isConnected
                      ? 'Live Supabase Connected'
                      : 'Storage Mode: Persistent Store (Ready for Supabase credentials)'}
                  </div>
                  <p className="text-xs mt-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {status?.isConnected
                      ? 'The dashboard is actively persisting recording name, ID, transcript preview, and full transcripts directly into your Supabase database.'
                      : 'Enter your Supabase URL and API Key below to connect your project. Recordings, IDs, and transcript previews will be stored in your Supabase table.'}
                  </p>
                </div>
              </div>

              {/* Form to enter Supabase URL and Key */}
              <form onSubmit={handleSaveConnection} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" /> Supabase Project URL
                    </span>
                    <a
                      href="https://supabase.com/dashboard/project/_/settings/api"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5"
                    >
                      Find in Dashboard <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </label>
                  <input
                    type="url"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzprojectid.supabase.co"
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500" /> Supabase API Key (Anon or Service Role)
                  </label>
                  <input
                    type="password"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-750 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Uses service role key or anon key to read, write, and index recordings.
                  </p>
                </div>

                {saveMessage && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                      saveMessage.success
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {saveMessage.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span>{saveMessage.text}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5" />
                        <span>Save &amp; Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Structure Query File (schema.sql)
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Defines recordings, transcript previews, and daily analysis tables
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDownloadSchema}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium cursor-pointer"
                    title="Download .sql file"
                  >
                    <Download className="w-3 h-3 text-zinc-400" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={handleCopySchema}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <pre className="bg-zinc-950 text-zinc-200 p-3.5 rounded-lg font-mono text-[11px] overflow-x-auto max-h-72 leading-relaxed border border-zinc-800">
                {SUPABASE_SQL_SCHEMA}
              </pre>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
                  How to execute:
                </span>
                1. Open your{' '}
                <a
                  href="https://supabase.com/dashboard/project/_/sql"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 underline inline-flex items-center gap-0.5"
                >
                  Supabase SQL Editor <ExternalLink className="w-2.5 h-2.5" />
                </a>
                .<br />
                2. Paste the SQL script above or upload the downloaded <code>schema.sql</code> file.<br />
                3. Click &ldquo;Run&rdquo; to create the tables. All recordings and daily analyses will sync automatically!
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
