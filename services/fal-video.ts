import { fal } from '@fal-ai/client';

const FAL_API_KEY = process.env.EXPO_PUBLIC_FAL_API_KEY || '';

fal.config({ credentials: FAL_API_KEY });

export interface VideoGenerationProgress {
  completedClips: number;
  totalClips: number;
  currentStep: 'uploading' | 'generating' | 'polling' | 'complete' | 'error';
  overallProgress: number;
  statusMessage: string;
}

export type VideoProgressCallback = (progress: VideoGenerationProgress) => void;

export interface MediaItemForGeneration {
  id: string;
  uri: string;
  type: 'photo' | 'video';
}
