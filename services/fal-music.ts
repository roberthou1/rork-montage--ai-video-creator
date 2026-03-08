import { fal } from '@fal-ai/client';
import { MontageStyle } from '@/types';

const FAL_API_KEY = process.env.EXPO_PUBLIC_FAL_API_KEY || '';

fal.config({ credentials: FAL_API_KEY });

const MODEL_ID = 'cassetteai/music-generator';

const STYLE_MUSIC_PROMPTS: Record<MontageStyle, string> = {
  dynamic: 'Energetic upbeat electronic pop beat with punchy drums, synth bass, and driving percussion. Fast tempo around 128 BPM. Perfect for dynamic video montage with quick cuts. Key: E Minor.',
  cinematic: 'Cinematic orchestral ambient track with soaring strings, gentle piano, and atmospheric pads. Slow tempo around 80 BPM. Emotional and sweeping, perfect for cinematic video. Key: D Major.',
  energetic: 'High energy dance electronic beat with heavy bass drops, fast hi-hats, and energetic synth leads. Tempo around 140 BPM. Intense and vibrant for fast-paced video content. Key: F Minor.',
  dreamy: 'Dreamy lo-fi chill beat with soft piano melodies, mellow bass, warm vinyl texture, and gentle drums. Relaxing and atmospheric. Tempo around 85 BPM. Key: G Major.',
};

export interface MusicGenerationProgress {
  currentStep: 'queued' | 'generating' | 'complete' | 'error';
  progress: number;
  statusMessage: string;
}

export type MusicProgressCallback = (progress: MusicGenerationProgress) => void;

export async function generateMusic(
  style: MontageStyle,
  durationSeconds: number,
  onProgress: MusicProgressCallback,
  abortSignal?: { aborted: boolean },
): Promise<string> {
  if (!FAL_API_KEY) {
    throw new Error('FAL API key is not configured. Please set EXPO_PUBLIC_FAL_API_KEY.');
  }

  if (abortSignal?.aborted) throw new Error('Generation cancelled');

  console.log('[FAL Music] Starting music generation, style:', style, 'duration:', durationSeconds);

  onProgress({
    currentStep: 'queued',
    progress: 5,
    statusMessage: 'Queuing music generation...',
  });

  try {
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: STYLE_MUSIC_PROMPTS[style],
        duration: Math.min(durationSeconds, 150),
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (abortSignal?.aborted) return;

        if (update.status === 'IN_QUEUE') {
          console.log('[FAL Music] In queue, position:', (update as any).queue_position);
          onProgress({
            currentStep: 'queued',
            progress: 10,
            statusMessage: 'Waiting in queue...',
          });
        } else if (update.status === 'IN_PROGRESS') {
          console.log('[FAL Music] Generating...');
          onProgress({
            currentStep: 'generating',
            progress: 50,
            statusMessage: 'Creating your soundtrack...',
          });
          if (update.logs) {
            update.logs.map((log) => log.message).forEach((msg) => console.log('[FAL Music] Log:', msg));
          }
        }
      },
    });

    if (abortSignal?.aborted) throw new Error('Generation cancelled');

    const data = result.data as any;
    const audioUrl = data?.audio_file?.url || data?.audio?.url;

    if (!audioUrl) {
      console.error('[FAL Music] No audio URL in result:', JSON.stringify(data).substring(0, 300));
      throw new Error('No audio URL in FAL music response');
    }

    console.log('[FAL Music] Got audio URL:', audioUrl.substring(0, 80));

    onProgress({
      currentStep: 'complete',
      progress: 100,
      statusMessage: 'Music ready!',
    });

    return audioUrl;
  } catch (error: any) {
    if (error?.message === 'Generation cancelled') throw error;
    console.error('[FAL Music] Generation failed:', error?.message || error);
    onProgress({
      currentStep: 'error',
      progress: 0,
      statusMessage: error?.message || 'Music generation failed',
    });
    throw error;
  }
}
