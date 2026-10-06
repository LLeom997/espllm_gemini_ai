import React, { useState, useEffect } from 'react';
import { OpenRouterConfig } from '../lib/types';
import {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_PRESETS,
  getStoredOpenRouterConfig,
  saveStoredOpenRouterConfig,
  testOpenRouterConnection,
} from '../lib/api/openrouter';
import {
  Sparkles,
  X,
  Key,
  Globe,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: OpenRouterConfig) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OPENROUTER_BASE_URL);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);
  const [showKey, setShowKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredOpenRouterConfig();
      setBaseUrl(stored.baseUrl || DEFAULT_OPENROUTER_BASE_URL);
      setApiKey(stored.apiKey || '');
      setModel(stored.model || DEFAULT_GEMINI_MODEL);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const config: OpenRouterConfig = {
      baseUrl: baseUrl.trim() || DEFAULT_OPENROUTER_BASE_URL,
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_GEMINI_MODEL,
    };
    saveStoredOpenRouterConfig(config);
    if (onConfigSaved) onConfigSaved(config);
    onClose();
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testOpenRouterConnection({
        baseUrl: baseUrl.trim() || DEFAULT_OPENROUTER_BASE_URL,
        apiKey: apiKey.trim(),
        model: model.trim() || DEFAULT_GEMINI_MODEL,
      });
      setTestResult({ success: true, message: result.message });
      // Also auto-save on successful test
      saveStoredOpenRouterConfig({
        baseUrl: baseUrl.trim() || DEFAULT_OPENROUTER_BASE_URL,
        apiKey: apiKey.trim(),
        model: model.trim() || DEFAULT_GEMINI_MODEL,
      });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                OpenRouter Settings (Gemini)
              </h3>
              <p className="text-[11px] text-zinc-500">
                API Key and Base URL configuration for audio analysis
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

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-zinc-400" /> OpenRouter Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
              className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Default: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">https://openrouter.ai/api/v1</code>
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-zinc-400" /> OpenRouter API Key
              </span>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline flex items-center gap-0.5"
              >
                Get Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full pl-3 pr-8 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Keys are stored locally in your browser session.
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zinc-400" /> Gemini Model
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {GEMINI_MODEL_PRESETS.map((p) => {
                const isSelected = model === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setModel(p.id)}
                    className={`text-left p-2 rounded border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 font-medium'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                    }`}
                  >
                    <div>{p.name}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{p.badge}</div>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Custom model id (e.g. google/gemini-2.5-flash)"
              className="w-full px-2.5 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-mono text-zinc-800 dark:text-zinc-200"
            />
          </div>

          {/* Connection Test Result */}
          {testResult && (
            <div
              className={`p-2.5 rounded border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-200 dark:border-zinc-700'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              )}
              <span className="truncate">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !apiKey.trim()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-40 cursor-pointer"
          >
            {isTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            <span>Test</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-medium cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
