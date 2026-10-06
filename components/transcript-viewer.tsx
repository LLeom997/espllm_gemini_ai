import React, { useState } from 'react';
import { Recording } from '../lib/types';
import {
  X,
  Copy,
  Check,
  Download,
  FileAudio,
  Calendar,
  Clock,
  FileText,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface TranscriptViewerProps {
  recording: Recording | null;
  isOpen: boolean;
  onClose: () => void;
  onCopySuccess?: () => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  recording,
  isOpen,
  onClose,
  onCopySuccess,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !recording) return null;

  const transcriptText = recording.transcript || 'No transcript text available.';
  const wordCount = transcriptText.trim() ? transcriptText.trim().split(/\s+/).length : 0;
  const charCount = transcriptText.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      if (onCopySuccess) onCopySuccess();
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([transcriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.recording_key}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <FileAudio className="w-4 h-4 text-zinc-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 id="modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {recording.recording_name || recording.recording_key}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Completed
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata Bar */}
        <div className="px-5 py-2.5 bg-zinc-50/70 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-zinc-400 block text-[11px]">Recording</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
              {recording.recording_name || recording.recording_key}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">Status</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Completed
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">Transcribed</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {formatDateTime(recording.transcribed_at || recording.updated_at)}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[11px]">Length</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {wordCount.toLocaleString()} words
            </span>
          </div>
        </div>

        {/* Transcript Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Transcript Content
            </span>
            <span className="text-zinc-400 lowercase font-normal">
              Stored in Supabase & Cloudflare R2
            </span>
          </div>

          <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

          <div className="mt-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 p-6 border border-zinc-200/80 dark:border-zinc-800">
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-sans selection:bg-blue-100 dark:selection:bg-blue-900/40">
              {transcriptText}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-zinc-50/70 dark:bg-zinc-950/70 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
            Identifier: <code className="bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">{recording.id}</code>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.txt)</span>
            </button>

            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Transcript</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
