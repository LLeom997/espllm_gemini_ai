import React from 'react';
import { Recording, TranscriptionStatus } from '../lib/types';
import {
  FileAudio,
  Eye,
  Disc3,
  RotateCcw,
  Sparkles,
  Inbox,
} from 'lucide-react';

interface RecordingTableProps {
  recordings: Recording[];
  isLoading: boolean;
  transcribingKeys: Set<string>;
  onTranscribe: (recordingKey: string) => void;
  onViewTranscript: (recording: Recording) => void;
}

export const RecordingTable: React.FC<RecordingTableProps> = ({
  recordings,
  isLoading,
  transcribingKeys,
  onTranscribe,
  onViewTranscript,
}) => {
  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: TranscriptionStatus, isTranscribing: boolean) => {
    if (isTranscribing || status === 'processing') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
          <Disc3 className="w-3 h-3 animate-spin text-zinc-500" />
          <span>Processing</span>
        </span>
      );
    }

    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Completed</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>Pending</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Failed</span>
          </span>
        );
      default:
        return <span className="text-xs text-zinc-500">{status}</span>;
    }
  };

  const getFileExtension = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() : 'AUDIO';
  };

  if (isLoading && recordings.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 flex-1">
                <div className="w-7 h-7 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <div className="space-y-1 flex-1">
                  <div className="h-3.5 w-36 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
                </div>
              </div>
              <div className="h-5 w-20 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
              <div className="h-7 w-24 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-lg p-10 text-center">
        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center mb-2.5">
          <Inbox className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          No recordings found
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-0.5">
          Try adjusting your search filter or click &ldquo;Sync Recordings&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-lg overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 text-zinc-500 dark:text-zinc-400 font-medium text-[11px] uppercase tracking-wider">
              <th scope="col" className="py-2.5 px-4 font-medium">Recording</th>
              <th scope="col" className="py-2.5 px-4 hidden md:table-cell font-medium">Uploaded</th>
              <th scope="col" className="py-2.5 px-4 hidden sm:table-cell font-medium">Size</th>
              <th scope="col" className="py-2.5 px-4 font-medium">Status</th>
              <th scope="col" className="py-2.5 px-4 hidden lg:table-cell font-medium">Transcript Preview</th>
              <th scope="col" className="py-2.5 px-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {recordings.map((recording) => {
              const isTranscribing =
                transcribingKeys.has(recording.recording_key) ||
                recording.transcription_status === 'processing';
              const isCompleted =
                recording.transcription_status === 'completed' &&
                Boolean(recording.transcript);
              const ext = getFileExtension(recording.recording_key);

              return (
                <tr
                  key={recording.id || recording.recording_key}
                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/40 transition-colors"
                >
                  {/* Recording Key */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <FileAudio className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-medium text-zinc-900 dark:text-zinc-100 truncate block max-w-[220px]"
                            title={recording.recording_key}
                          >
                            {recording.recording_name || recording.recording_key}
                          </span>
                          <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase shrink-0">
                            {ext}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block md:hidden mt-0.5">
                          {formatDate(recording.uploaded_at)} &bull; {formatFileSize(recording.file_size)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Uploaded */}
                  <td className="py-3 px-4 hidden md:table-cell text-zinc-500 dark:text-zinc-400 text-xs">
                    {formatDate(recording.uploaded_at)}
                  </td>

                  {/* Size */}
                  <td className="py-3 px-4 hidden sm:table-cell text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                    {formatFileSize(recording.file_size)}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {renderStatusBadge(recording.transcription_status, isTranscribing)}
                  </td>

                  {/* Transcript Preview */}
                  <td className="py-3 px-4 hidden lg:table-cell max-w-xs">
                    {recording.transcript ? (
                      <p
                        className="text-xs text-zinc-500 dark:text-zinc-400 truncate cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-200"
                        title={recording.transcript}
                        onClick={() => onViewTranscript(recording)}
                      >
                        {recording.transcript_preview || recording.transcript}
                      </p>
                    ) : (
                      <span className="text-xs text-zinc-350 dark:text-zinc-600">—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {isCompleted ? (
                      <button
                        onClick={() => onViewTranscript(recording)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700/80 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-zinc-400" />
                        <span>View</span>
                      </button>
                    ) : isTranscribing ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-zinc-400 cursor-not-allowed"
                      >
                        <Disc3 className="w-3 h-3 animate-spin" />
                        <span>Transcribing</span>
                      </button>
                    ) : recording.transcription_status === 'failed' ? (
                      <button
                        onClick={() => onTranscribe(recording.recording_key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onTranscribe(recording.recording_key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Transcribe</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
