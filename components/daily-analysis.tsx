import React, { useState, useMemo } from 'react';
import { Recording, DailyGroup } from '../lib/types';
import {
  analyzeDailyRecordings,
  getStoredOpenRouterConfig,
} from '../lib/api/openrouter';
import {
  Calendar,
  Sparkles,
  FileAudio,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Download,
  Key,
  RefreshCw,
  Send,
  Layers,
  BookOpen,
} from 'lucide-react';

interface DailyAnalysisProps {
  recordings: Recording[];
  onOpenAISettings: () => void;
  onTranscribe: (recordingKey: string) => void;
  transcribingKeys: Set<string>;
  onViewTranscript: (recording: Recording) => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => void;
}

export const DailyAnalysis: React.FC<DailyAnalysisProps> = ({
  recordings,
  onOpenAISettings,
  onTranscribe,
  transcribingKeys,
  onViewTranscript,
  onToast,
}) => {
  // Group recordings by calendar day (YYYY-MM-DD)
  const dailyGroups: DailyGroup[] = useMemo(() => {
    const map = new Map<string, Recording[]>();

    recordings.forEach((rec) => {
      let dateKey = 'Unknown Date';
      if (rec.uploaded_at) {
        try {
          const d = new Date(rec.uploaded_at);
          if (!isNaN(d.getTime())) {
            dateKey = d.toISOString().split('T')[0];
          }
        } catch {
          // Fallback
        }
      }
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(rec);
    });

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return sortedDates.map((dateStr) => {
      const recs = map.get(dateStr)!;
      let displayDate = dateStr;

      if (dateStr === todayStr) {
        displayDate = `Today (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      } else if (dateStr === yesterdayStr) {
        displayDate = `Yesterday (${yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      } else if (dateStr !== 'Unknown Date') {
        try {
          const [y, m, d] = dateStr.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          displayDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        } catch {
          displayDate = dateStr;
        }
      }

      const completed = recs.filter((r) => r.transcription_status === 'completed' && Boolean(r.transcript));
      const pending = recs.length - completed.length;
      const totalSize = recs.reduce((acc, curr) => acc + (curr.file_size || 0), 0);
      const totalWords = completed.reduce((acc, curr) => {
        const text = curr.transcript?.trim() || '';
        return acc + (text ? text.split(/\s+/).length : 0);
      }, 0);

      return {
        date: dateStr,
        displayDate,
        recordings: recs,
        totalCount: recs.length,
        completedCount: completed.length,
        pendingCount: pending,
        totalSize,
        totalWords,
      };
    });
  }, [recordings]);

  // Selected Date state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return dailyGroups[0]?.date || '';
  });

  const activeGroup = useMemo(() => {
    return dailyGroups.find((g) => g.date === selectedDate) || dailyGroups[0] || null;
  }, [dailyGroups, selectedDate]);

  // Analysis state
  const [analysisType, setAnalysisType] = useState<'summary' | 'action_items' | 'themes' | 'custom'>('summary');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [copiedAnalysis, setCopiedAnalysis] = useState(false);
  const [lastModelUsed, setLastModelUsed] = useState<string>('');

  const handleTranscribeAllPending = () => {
    if (!activeGroup) return;
    const pendingRecs = activeGroup.recordings.filter(
      (r) => r.transcription_status !== 'completed' || !r.transcript
    );
    pendingRecs.forEach((r) => {
      onTranscribe(r.recording_key);
    });
    onToast(
      'info',
      'Batch Transcription',
      `Queued ${pendingRecs.length} recordings for transcription.`
    );
  };

  const handleRunAnalysis = async () => {
    if (!activeGroup) return;

    const config = getStoredOpenRouterConfig();
    if (!config.apiKey || !config.apiKey.trim()) {
      onOpenAISettings();
      onToast('warning', 'API Key Required', 'Please configure your OpenRouter API key first.');
      return;
    }

    const transcribed = activeGroup.recordings.filter((r) => r.transcript && r.transcript.trim().length > 0);
    if (transcribed.length === 0) {
      onToast(
        'error',
        'No Transcripts',
        `No recordings on ${activeGroup.displayDate} have transcripts yet.`
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await analyzeDailyRecordings({
        date: activeGroup.displayDate,
        recordings: activeGroup.recordings,
        analysisType,
        customPrompt,
        config,
      });

      setAnalysisResult(result);
      setLastModelUsed(config.model);
      onToast('success', 'Analysis Generated', 'Daily synthesis generated.');
    } catch (err: any) {
      console.error('Gemini analysis failed:', err);
      onToast('error', 'Analysis Failed', err.message || 'Error communicating with OpenRouter.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyAnalysis = async () => {
    if (!analysisResult) return;
    try {
      await navigator.clipboard.writeText(analysisResult);
      setCopiedAnalysis(true);
      setTimeout(() => setCopiedAnalysis(false), 2000);
      onToast('success', 'Copied', 'Analysis copied to clipboard.');
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleDownloadAnalysis = () => {
    if (!analysisResult || !activeGroup) return;
    const blob = new Blob([analysisResult], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-analysis-${activeGroup.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (dailyGroups.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-10 text-center">
        <Calendar className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
        <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          No Daily Recordings
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto mt-0.5">
          Sync recordings to view day-by-day analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-lg p-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Day:</span>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {activeGroup?.displayDate}
            </span>
          </div>

          <button
            onClick={onOpenAISettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 cursor-pointer transition-colors"
          >
            <Key className="w-3 h-3 text-zinc-400" />
            <span>OpenRouter Settings</span>
          </button>
        </div>

        {/* Date Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {dailyGroups.map((group) => {
            const isSelected = (activeGroup?.date || '') === group.date;
            return (
              <button
                key={group.date}
                onClick={() => {
                  setSelectedDate(group.date);
                  setAnalysisResult(null);
                }}
                className={`px-3 py-1.5 rounded text-xs transition-colors cursor-pointer border whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 font-medium'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <span>{group.displayDate}</span>
                <span
                  className={`text-[10px] ${
                    isSelected ? 'opacity-80' : 'text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {group.completedCount}/{group.totalCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeGroup && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Recordings for the Day */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-lg p-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Recordings ({activeGroup.totalCount})
                  </h3>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {activeGroup.completedCount} transcribed &bull; {activeGroup.totalWords.toLocaleString()} words
                  </div>
                </div>

                {activeGroup.pendingCount > 0 && (
                  <button
                    onClick={handleTranscribeAllPending}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                  >
                    <span>Transcribe Pending ({activeGroup.pendingCount})</span>
                  </button>
                )}
              </div>

              {/* Recordings list */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[480px] overflow-y-auto mt-1 pr-0.5">
                {activeGroup.recordings.map((rec) => {
                  const isProcessing =
                    transcribingKeys.has(rec.recording_key) || rec.transcription_status === 'processing';
                  const isCompleted = rec.transcription_status === 'completed' && Boolean(rec.transcript);

                  return (
                    <div key={rec.id || rec.recording_key} className="py-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileAudio className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate" title={rec.recording_key}>
                            {rec.recording_name || rec.recording_key}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 shrink-0">
                          {formatFileSize(rec.file_size)}
                        </span>
                      </div>

                      {isCompleted ? (
                        <div
                          onClick={() => onViewTranscript(rec)}
                          className="p-2 rounded bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                        >
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                            {rec.transcript_preview || rec.transcript}
                          </p>
                          <div className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium mt-1 flex justify-end">
                            <span className="hover:underline">View Transcript &rarr;</span>
                          </div>
                        </div>
                      ) : isProcessing ? (
                        <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] py-0.5">
                          <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
                          <span>Transcribing...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                          <button
                            onClick={() => onTranscribe(rec.recording_key)}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
                          >
                            Transcribe
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Minimalist Synthesis */}
          <div className="lg:col-span-7 space-y-3">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Day Synthesis (Gemini)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Analyze all recordings from this day together
                  </p>
                </div>
              </div>

              {/* Analysis Type */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-zinc-500">
                  Select Focus:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'summary', label: 'Summary', icon: BookOpen },
                    { id: 'action_items', label: 'Action Items', icon: CheckCircle2 },
                    { id: 'themes', label: 'Themes', icon: Layers },
                    { id: 'custom', label: 'Custom', icon: Send },
                  ].map((tab) => {
                    const isSelected = analysisType === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAnalysisType(tab.id as any)}
                        className={`p-2 rounded border text-left transition-colors cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 font-medium'
                            : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                        }`}
                      >
                        <Icon className="w-3 h-3 mb-1 opacity-70" />
                        <div>{tab.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Prompt */}
              {analysisType === 'custom' && (
                <div>
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter custom analysis prompt..."
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
                  />
                </div>
              )}

              {/* Action Button */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400">
                  {activeGroup.completedCount} transcripts available
                </span>

                <button
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing || activeGroup.completedCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>Analyze Day</span>
                    </>
                  )}
                </button>
              </div>

              {/* Output Result */}
              {analysisResult && (
                <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-500">
                      Synthesis Result
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopyAnalysis}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 cursor-pointer"
                      >
                        {copiedAnalysis ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedAnalysis ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        onClick={handleDownloadAnalysis}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 cursor-pointer"
                        title="Download Markdown"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200/70 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[460px] overflow-y-auto">
                    {analysisResult}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
