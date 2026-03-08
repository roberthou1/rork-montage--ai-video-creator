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

export type MusicMode = 'preset' | 'ai-generated' | 'none';

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

export type BackendJobState =
  | 'queued'
  | 'uploading_media'
  | 'submitting'
  | 'generating_music'
  | 'analyzing_beats'
  | 'generating_ai_clips'
  | 'compositing'
  | 'encoding'
  | 'complete'
  | 'failed';

export interface JobStatus {
  status: BackendJobState;
  progress: number;
  current_step: string;
  result_url: string | null;
  error?: string | null;
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
  localVideoPath?: string;
  backendJobId?: string;
  generatedMusicUrl?: string;
  musicMode?: MusicMode;
}

export interface AppSettings {
  exportQuality: ExportQuality;
  defaultStyle: MontageStyle;
  aiEnhancementDefault: boolean;
  hasCompletedOnboarding: boolean;
}

export interface GenerationJob {
  jobId: string;
  status: BackendJobState;
  progress: number;
  currentStep: string;
  resultUrl?: string | null;
  error?: string | null;
}
