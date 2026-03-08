export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  duration_seconds: number;
  bpm: number;
  category: MusicCategory;
  preview_url: string;
  download_url: string;
}

export type MusicCategory = 'trending' | 'chill' | 'upbeat' | 'cinematic' | 'lofi' | 'electronic';

export type MontageStyle = 'dynamic' | 'cinematic' | 'energetic' | 'dreamy';

export type TargetDuration = 15 | 30 | 60;

export type ExportQuality = '720p' | '1080p' | '4k';

export interface PhotoItem {
  id: string;
  uri: string;
  type: 'photo' | 'video';
  date: string;
  duration?: number;
  isFavorite: boolean;
  location?: string;
}

export interface SmartCollection {
  id: string;
  name: string;
  icon: string;
  photos: PhotoItem[];
}

export interface BeatSyncData {
  bpm: number;
  beatIntervalMs: number;
  clipTimings: { clipIndex: number; startMs: number; durationMs: number }[];
  totalDurationMs: number;
}

export interface Project {
  id: string;
  createdAt: string;
  musicTrackId: string | null;
  musicTrackName: string | null;
  style: MontageStyle;
  duration: TargetDuration;
  aiEnhanced: boolean;
  status: 'complete' | 'failed';
  thumbnailUri: string;
  mediaCount: number;
  enhancedImageUris?: string[];
  originalImageUris?: string[];
  videoClipUris?: string[];
  localVideoUris?: string[];
  generatedMusicUrl?: string;
  musicMode?: 'preset' | 'ai-generated' | 'none';
  beatSyncData?: BeatSyncData;
}

export interface AppSettings {
  exportQuality: ExportQuality;
  defaultStyle: MontageStyle;
  aiEnhancementDefault: boolean;
  hasCompletedOnboarding: boolean;
}

export type JobStatus = 'queued' | 'analyzing' | 'generating_ai_clips' | 'compositing' | 'finalizing' | 'complete' | 'failed';

export interface GenerationJob {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStep: string;
  resultUrl?: string;
}
