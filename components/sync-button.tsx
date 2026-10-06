import React from 'react';
import { RefreshCw, Check, CloudAlert } from 'lucide-react';

interface SyncButtonProps {
  onSync: () => void;
  isSyncing: boolean;
  lastSyncTime?: Date | null;
  syncSuccess?: boolean;
  syncError?: string | null;
}

export const SyncButton: React.FC<SyncButtonProps> = ({
  onSync,
  isSyncing,
  lastSyncTime,
  syncSuccess,
  syncError,
}) => {
  const formatLastSync = (date?: Date | null) => {
    if (!date) return 'Not yet synced';
    const secondsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secondsAgo < 10) return 'Just now';
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex items-center gap-2">
      {lastSyncTime && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400 hidden sm:inline">
          Synced: <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatLastSync(lastSyncTime)}</span>
        </span>
      )}

      <button
        onClick={onSync}
        disabled={isSyncing}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
          isSyncing
            ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
            : syncError
            ? 'border border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-400 hover:bg-rose-50'
            : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
        }`}
        title="Fetch all available files from Worker and synchronize Supabase"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
            <span>Syncing...</span>
          </>
        ) : syncSuccess ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span>Synced</span>
          </>
        ) : syncError ? (
          <>
            <CloudAlert className="w-3 h-3 text-rose-500" />
            <span>Retry Sync</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3" />
            <span>Sync</span>
          </>
        )}
      </button>
    </div>
  );
};
