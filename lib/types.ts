export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Recording {
  id: string;
  recording_key: string;
  recording_name?: string;
  transcript_preview?: string | null;
  file_size: number;
  uploaded_at: string;
  transcription_status: TranscriptionStatus;
  transcript: string | null;
  transcript_key: string | null;
  transcribed_at: string | null;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
}

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface DailyAnalysis {
  id?: string;
  date: string;
  recordingsCount: number;
  analysisType: 'summary' | 'action_items' | 'themes' | 'custom';
  analysisContent: string;
  modelUsed: string;
  createdAt: string;
}

export interface DailyGroup {
  date: string; // YYYY-MM-DD
  displayDate: string;
  recordings: Recording[];
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  totalSize: number;
  totalWords: number;
}


export interface WorkerFile {
  key: string;
  size: number;
  uploaded: string;
}

export interface WorkerFilesResponse {
  files: WorkerFile[];
}

export interface TranscribeResponse {
  filename: string;
  transcript: string;
  transcriptKey: string;
}

export interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
}

export type SortField = 'uploaded' | 'name' | 'size' | 'status' | 'transcribed';
export type SortOrder = 'asc' | 'desc';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp?: number;
}

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceKey: boolean;
  isConnected: boolean;
  error?: string | null;
}
