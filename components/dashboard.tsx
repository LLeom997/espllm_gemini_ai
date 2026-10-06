import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Recording,
  TranscriptionStatus,
  SortField,
  SortOrder,
  DashboardStats,
  ToastMessage,
  SupabaseConfigStatus,
} from '../lib/types';
import { StatsCards } from './stats-cards';
import { Filters } from './filters';
import { SyncButton } from './sync-button';
import { RecordingTable } from './recording-table';
import { TranscriptViewer } from './transcript-viewer';
import { SupabaseModal } from './supabase-modal';
import { AISettingsModal } from './ai-settings-modal';
import { DailyAnalysis } from './daily-analysis';
import {
  Sparkles,
  Database,
  Radio,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Volume2,
  Calendar,
  Layers,
  Key,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  // State
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Active transcription jobs in flight
  const [transcribingKeys, setTranscribingKeys] = useState<Set<string>>(new Set());

  // Search, filter, and sort
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TranscriptionStatus>('all');
  const [sortField, setSortField] = useState<SortField>('uploaded');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Main tabs
  const [activeTab, setActiveTab] = useState<'recordings' | 'daily'>('recordings');

  // Modal states
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState(false);

  // System & connection info
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConfigStatus | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Add toast notification
  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, message: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, timestamp: Date.now() }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Fetch current recordings from Supabase API
  const fetchRecordings = useCallback(async () => {
    try {
      const res = await fetch('/api/recordings');
      if (!res.ok) {
        throw new Error(`Failed to load recordings: ${res.statusText}`);
      }
      const data = await res.json();
      if (Array.isArray(data.recordings)) {
        setRecordings(data.recordings);
      }
    } catch (err: any) {
      console.error('Error fetching recordings:', err);
      addToast('error', 'Database Error', err.message || 'Unable to load recordings from database.');
    }
  }, [addToast]);

  // Check health and Supabase status
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data.supabase);
      }
    } catch (err) {
      console.warn('Health check unavailable:', err);
    }
  }, []);

  // 2. Synchronize with Worker
  const handleSync = useCallback(
    async (isInitial = false) => {
      setIsSyncing(true);
      setSyncError(null);
      setSyncSuccess(false);

      try {
        const res = await fetch('/api/sync', { method: 'POST' });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Worker sync failed with HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.recordings && Array.isArray(data.recordings)) {
          setRecordings(data.recordings);
          setLastSyncTime(new Date());
          setSyncSuccess(true);
          setTimeout(() => setSyncSuccess(false), 3000);

          if (!isInitial) {
            addToast(
              'success',
              'Synchronization Complete',
              `Synced ${data.syncedCount} audio recordings from Cloudflare Worker R2.`
            );
          }
        }
      } catch (err: any) {
        console.error('Sync failed:', err);
        setSyncError(err.message || 'Worker unavailable');
        addToast(
          'error',
          'Sync Failed',
          `Unable to sync recordings from Worker: ${err.message || 'Worker unreachable'}.`
        );
      } finally {
        setIsSyncing(false);
      }
    },
    [addToast]
  );

  // Initial workflow on first load
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setIsLoading(true);
      // 1. Fetch Supabase status
      await checkHealth();
      // 2. Load existing recordings
      await fetchRecordings();
      // 3. Sync with Worker
      if (mounted) {
        await handleSync(true);
        setIsLoading(false);
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [checkHealth, fetchRecordings, handleSync]);

  // Transcribe single recording
  const handleTranscribe = async (recordingKey: string) => {
    if (transcribingKeys.has(recordingKey)) return;

    // Optimistically mark row as processing
    setTranscribingKeys((prev) => new Set(prev).add(recordingKey));
    setRecordings((prev) =>
      prev.map((r) =>
        r.recording_key === recordingKey
          ? { ...r, transcription_status: 'processing' as TranscriptionStatus, error_message: null }
          : r
      )
    );

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: recordingKey }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const data = await res.json();

      if (data.recording) {
        // Update row with completed status and transcript
        setRecordings((prev) =>
          prev.map((r) => (r.recording_key === recordingKey ? data.recording : r))
        );

        addToast(
          'success',
          'Transcription Completed',
          `Successfully transcribed ${recordingKey}. Transcript saved to Supabase.`
        );
      }
    } catch (err: any) {
      console.error(`Transcription failed for ${recordingKey}:`, err);
      // Mark as failed in UI
      setRecordings((prev) =>
        prev.map((r) =>
          r.recording_key === recordingKey
            ? {
                ...r,
                transcription_status: 'failed' as TranscriptionStatus,
                error_message: err.message,
              }
            : r
        )
      );

      addToast(
        'error',
        'Transcription Failed',
        `Unable to transcribe ${recordingKey}. Try again.`
      );
    } finally {
      setTranscribingKeys((prev) => {
        const next = new Set(prev);
        next.delete(recordingKey);
        return next;
      });
    }
  };

  // Open transcript modal
  const handleViewTranscript = (recording: Recording) => {
    setSelectedRecording(recording);
    setIsViewerOpen(true);
  };

  // Calculate statistics
  const stats: DashboardStats = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let processing = 0;
    let failed = 0;

    recordings.forEach((r) => {
      if (transcribingKeys.has(r.recording_key) || r.transcription_status === 'processing') {
        processing++;
      } else if (r.transcription_status === 'completed' && r.transcript) {
        completed++;
      } else if (r.transcription_status === 'failed') {
        failed++;
      } else {
        pending++;
      }
    });

    return {
      total: recordings.length,
      completed,
      pending,
      processing,
      failed,
    };
  }, [recordings, transcribingKeys]);

  // Filtered and sorted recordings
  const filteredRecordings = useMemo(() => {
    let list = [...recordings];

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((r) => {
        if (statusFilter === 'processing') {
          return (
            transcribingKeys.has(r.recording_key) ||
            r.transcription_status === 'processing'
          );
        }
        return r.transcription_status === statusFilter;
      });
    }

    // Search query filter (filename, key, transcript text)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const keyMatch = r.recording_key.toLowerCase().includes(q);
        const transcriptMatch = r.transcript?.toLowerCase().includes(q);
        return keyMatch || transcriptMatch;
      });
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'uploaded': {
          const timeA = new Date(a.uploaded_at).getTime() || 0;
          const timeB = new Date(b.uploaded_at).getTime() || 0;
          comparison = timeA - timeB;
          break;
        }
        case 'name':
          comparison = a.recording_key.localeCompare(b.recording_key);
          break;
        case 'size':
          comparison = (a.file_size || 0) - (b.file_size || 0);
          break;
        case 'status':
          comparison = a.transcription_status.localeCompare(b.transcription_status);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [recordings, statusFilter, searchQuery, sortField, sortOrder, transcribingKeys]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-60 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 animate-in slide-in-from-top-2 duration-200 ${
              toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                : toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                : 'bg-zinc-900 dark:bg-zinc-800 border-zinc-700 text-white'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="text-xs font-semibold">{toast.title}</div>
              <div className="text-xs mt-0.5 opacity-90">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Top Header */}
      <header className="border-b border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Recording Transcription Dashboard
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] text-zinc-500 font-mono">
                  Worker API Online
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Cloudflare Worker R2 audio storage &amp; Supabase metadata
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
            <button
              onClick={() => setIsAISettingsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="OpenRouter Gemini API Settings"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              <span>OpenRouter AI</span>
            </button>

            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Supabase connection and SQL migration"
            >
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              <span>Supabase</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  supabaseStatus?.isConnected ? 'bg-emerald-500' : 'bg-zinc-400'
                }`}
              />
            </button>

            <button
              onClick={() => handleSync(false)}
              disabled={isSyncing}
              className="p-1.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Refresh and resync all data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            <SyncButton
              onSync={() => handleSync(false)}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
              syncSuccess={syncSuccess}
              syncError={syncError}
            />
          </div>
        </div>

        {/* Minimal Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-4 text-xs">
          <button
            onClick={() => setActiveTab('recordings')}
            className={`py-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'recordings'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <span>All Recordings</span>
            <span className="text-[11px] text-zinc-400">({recordings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('daily')}
            className={`py-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'daily'
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <span>Daily Analysis</span>
            <span className="text-[10px] text-zinc-400">Gemini</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Error notification if Worker is having trouble */}
        {syncError && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <span className="font-semibold text-rose-900 dark:text-rose-200">
                Worker API Communication Warning
              </span>
              <p className="text-rose-700 dark:text-rose-300 mt-0.5">{syncError}</p>
            </div>
            <button
              onClick={() => handleSync(false)}
              className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        )}

        {activeTab === 'daily' ? (
          <DailyAnalysis
            recordings={recordings}
            onOpenAISettings={() => setIsAISettingsModalOpen(true)}
            onTranscribe={handleTranscribe}
            transcribingKeys={transcribingKeys}
            onViewTranscript={handleViewTranscript}
            onToast={addToast}
          />
        ) : (
          <>
            {/* 1. Summary Cards */}
            <section aria-labelledby="stats-heading">
              <h2 id="stats-heading" className="sr-only">
                Transcription Statistics
              </h2>
              <StatsCards
                stats={stats}
                currentFilter={statusFilter}
                onSelectFilter={setStatusFilter}
                isLoading={isLoading && recordings.length === 0}
              />
            </section>

            {/* 2. Filters & Search */}
            <section aria-labelledby="filter-heading">
              <h2 id="filter-heading" className="sr-only">
                Filters and Search
              </h2>
              <Filters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                sortField={sortField}
                sortOrder={sortOrder}
                onSortChange={(field, order) => {
                  setSortField(field);
                  setSortOrder(order);
                }}
                totalFiltered={filteredRecordings.length}
                totalRecordings={recordings.length}
              />
            </section>

            {/* 3. Main Recording Table */}
            <section aria-labelledby="recordings-heading">
              <h2 id="recordings-heading" className="sr-only">
                Recordings Table
              </h2>
              <RecordingTable
                recordings={filteredRecordings}
                isLoading={isLoading}
                transcribingKeys={transcribingKeys}
                onTranscribe={handleTranscribe}
                onViewTranscript={handleViewTranscript}
              />
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-4 text-center text-xs text-zinc-600 dark:text-zinc-400 mt-auto bg-white/50 dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Recording Transcription Dashboard &bull; Powered by Cloudflare Workers &amp; Supabase</span>
          <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
            Worker Endpoint: black-haze-8d76.lleom23.workers.dev
          </span>
        </div>
      </footer>

      {/* Transcript Viewer Modal */}
      <TranscriptViewer
        recording={selectedRecording}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        onCopySuccess={() => addToast('success', 'Copied', 'Transcript copied to clipboard')}
      />

      {/* Supabase Schema and Status Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        status={supabaseStatus}
        onStatusUpdated={(newStatus) => {
          setSupabaseStatus(newStatus);
          if (newStatus.isConnected) {
            addToast('success', 'Supabase Connected', 'Connected to live Supabase cluster.');
            fetchRecordings();
          }
        }}
      />

      {/* OpenRouter AI Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsModalOpen}
        onClose={() => setIsAISettingsModalOpen(false)}
        onConfigSaved={() => {
          addToast('success', 'AI Config Saved', 'OpenRouter Gemini configuration updated.');
        }}
      />
    </div>
  );
};
