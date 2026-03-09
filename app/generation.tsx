import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { usePhotoLibrary } from '@/contexts/PhotoLibraryContext';
import { MontageStyle, MusicMode, PhotoItem, Project, TargetDuration } from '@/types';
import {
  createMontageJob,
  downloadVideo,
  FileTooLargeError,
  FRIENDLY_BACKEND_ERROR,
  pollJobStatus,
  uploadMediaToSupabase,
} from '@/services/backend-api';

type GenerationStepKey =
  | 'uploading'
  | 'starting'
  | 'generating_music'
  | 'analyzing_beats'
  | 'generating_ai_clips'
  | 'compositing'
  | 'encoding'
  | 'downloading'
  | 'complete'
  | 'error';

const stepLabels: Record<GenerationStepKey, { label: string; sublabel: string }> = {
  uploading: {
    label: 'Uploading your photos and videos...',
    sublabel: 'Preparing your media for the montage server',
  },
  starting: {
    label: 'Starting montage creation...',
    sublabel: 'Sending your edit settings to the server',
  },
  generating_music: {
    label: 'Composing your soundtrack...',
    sublabel: 'Building a score that fits your montage',
  },
  analyzing_beats: {
    label: 'Analyzing the beat...',
    sublabel: 'Finding the best rhythm for each cut',
  },
  generating_ai_clips: {
    label: 'Bringing photos to life with AI...',
    sublabel: 'Animating your stills with subtle movement',
  },
  compositing: {
    label: 'Compositing your montage...',
    sublabel: 'Blending clips, timing, and motion together',
  },
  encoding: {
    label: 'Encoding for iPhone...',
    sublabel: 'Finalizing a smooth playback file',
  },
  downloading: {
    label: 'Downloading your montage...',
    sublabel: 'Saving the finished MP4 to your device',
  },
  complete: {
    label: 'Your montage is ready!',
    sublabel: 'Opening preview',
  },
  error: {
    label: 'Something went wrong',
    sublabel: 'Please try again',
  },
};

function CircularProgress({ progress }: { progress: number }) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    rotate.start();
    pulse.start();
    return () => {
      rotate.stop();
      pulse.stop();
    };
  }, [pulseAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[progressStyles.container, { transform: [{ scale: pulseAnim }] }]} testID="generation-progress-ring">
      <Animated.View style={[progressStyles.glowRing, { transform: [{ rotate: rotation }] }]}> 
        <LinearGradient
          colors={[Colors.dark.accent, Colors.dark.secondary, Colors.dark.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={progressStyles.glowGradient}
        />
      </Animated.View>
      <View style={progressStyles.innerCircle}>
        <Text style={progressStyles.percentText}>{Math.round(progress)}%</Text>
      </View>
    </Animated.View>
  );
}

function SparkleAnimation() {
  const sparkles = useRef(
    Array.from({ length: 6 }, () => ({
      x: new Animated.Value(Math.random() * 200 - 100),
      y: new Animated.Value(Math.random() * 200 - 100),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = sparkles.map((sparkle, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 400),
          Animated.parallel([
            Animated.timing(sparkle.opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(sparkle.scale, { toValue: 1, friction: 3, useNativeDriver: true }),
          ]),
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(sparkle.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(sparkle.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
          Animated.delay(800),
        ])
      )
    );

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [sparkles]);

  return (
    <View style={sparkleStyles.container} pointerEvents="none">
      {sparkles.map((sparkle, index) => (
        <Animated.View
          key={index}
          style={[
            sparkleStyles.sparkle,
            {
              transform: [
                { translateX: sparkle.x },
                { translateY: sparkle.y },
                { scale: sparkle.scale },
              ],
              opacity: sparkle.opacity,
            },
          ]}
        >
          <Text style={sparkleStyles.sparkleText}>✦</Text>
        </Animated.View>
      ))}
    </View>
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function mapBackendStepToUiStep(status: string): GenerationStepKey {
  if (status === 'generating_music') return 'generating_music';
  if (status === 'analyzing_beats') return 'analyzing_beats';
  if (status === 'generating_ai_clips') return 'generating_ai_clips';
  if (status === 'compositing') return 'compositing';
  if (status === 'encoding') return 'encoding';
  if (status === 'complete') return 'complete';
  if (status === 'failed') return 'error';
  return 'starting';
}

export default function GenerationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    style: string;
    duration: string;
    aiEnhance: string;
    musicTrackId: string;
    musicTrackName: string;
    musicBpm: string;
    musicMode: string;
    musicUrl: string;
    photoCount: string;
    selectedIds: string;
  }>();
  const { addProject } = useApp();
  const { photos } = usePhotoLibrary();

  const [currentStep, setCurrentStep] = useState<GenerationStepKey>('uploading');
  const [progress, setProgress] = useState<number>(0);
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const currentStepRef = useRef<GenerationStepKey>('uploading');

  const animateStepChange = useCallback((newStep: GenerationStepKey) => {
    if (currentStepRef.current === newStep) {
      return;
    }

    currentStepRef.current = newStep;
    Animated.sequence([
      Animated.timing(stepOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(stepOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setCurrentStep(newStep);
  }, [stepOpacity]);

  const getSelectedMedia = useCallback((): PhotoItem[] => {
    const selectedIds = params.selectedIds ? params.selectedIds.split(',').filter(Boolean) : [];
    const fallbackCount = Number(params.photoCount) || 8;

    if (selectedIds.length === 0) {
      return photos.slice(0, fallbackCount);
    }

    const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
    const orderedSelected = selectedIds
      .map((id) => photoMap.get(id))
      .filter((item): item is PhotoItem => Boolean(item));

    if (orderedSelected.length > 0) {
      return orderedSelected;
    }

    return photos.slice(0, fallbackCount);
  }, [params.photoCount, params.selectedIds, photos]);

  useEffect(() => {
    abortRef.current = { aborted: false };

    const runGeneration = async () => {
      const selectedMedia = getSelectedMedia();
      const style = (params.style as MontageStyle) || 'dynamic';
      const duration = (Number(params.duration) || 30) as TargetDuration;
      const aiEnhance = params.aiEnhance === 'true';
      const requestedMusicMode: MusicMode =
        params.musicMode === 'preset' || params.musicMode === 'ai-generated'
          ? params.musicMode
          : 'none';
      const musicBpm = params.musicBpm ? Number(params.musicBpm) : null;
      const normalizedMusicBpm = Number.isFinite(musicBpm) ? musicBpm : null;
      const musicUrl = params.musicUrl || null;
      const musicMode: MusicMode =
        requestedMusicMode === 'preset' && !musicUrl ? 'none' : requestedMusicMode;
      const projectId = `p-${Date.now()}`;

      console.log('[Generation] Starting backend montage generation', {
        projectId,
        selectedCount: selectedMedia.length,
        style,
        duration,
        aiEnhance,
        musicMode,
        musicBpm: normalizedMusicBpm,
        musicUrl,
      });

      try {
        if (selectedMedia.length === 0) {
          throw new Error('Please select at least one video to create a montage.');
        }

        animateStepChange('uploading');
        setProgress(0);
        setStatusDetail(`Uploading 0 of ${selectedMedia.length}...`);

        const uploadedMediaItems: { url: string; type: PhotoItem['type']; duration: number | null }[] = [];

        for (let index = 0; index < selectedMedia.length; index += 1) {
          if (abortRef.current.aborted) {
            return;
          }

          const mediaItem = selectedMedia[index];
          setStatusDetail(`Uploading ${index + 1} of ${selectedMedia.length}...`);

          let uploadUrl: string | null = null;
          let lastError: unknown = null;
          let skippedTooLarge = false;

          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              console.log('[Generation] Upload attempt', attempt + 1, 'for media', mediaItem.id);
              uploadUrl = await uploadMediaToSupabase(mediaItem.uri, mediaItem.id);
              break;
            } catch (error) {
              if (error instanceof FileTooLargeError) {
                console.warn('[Generation] Skipping oversized file:', mediaItem.id, error.message);
                skippedTooLarge = true;
                break;
              }
              lastError = error;
              console.error('[Generation] Upload failed for media', mediaItem.id, 'attempt', attempt + 1, error);
              if (attempt < 2) {
                await delay(600);
              }
            }
          }

          if (skippedTooLarge) {
            setStatusDetail(`Skipped oversized clip (${index + 1}/${selectedMedia.length})`);
            const uploadProgress = ((index + 1) / selectedMedia.length) * 30;
            setProgress(clampProgress(uploadProgress));
            continue;
          }

          if (!uploadUrl) {
            const uploadErrorMessage = lastError instanceof Error ? lastError.message : 'Failed to upload media.';
            throw new Error(uploadErrorMessage);
          }

          uploadedMediaItems.push({
            url: uploadUrl,
            type: mediaItem.type,
            duration: mediaItem.type === 'video' ? mediaItem.duration ?? null : null,
          });

          const uploadProgress = ((index + 1) / selectedMedia.length) * 30;
          setProgress(clampProgress(uploadProgress));
          console.log('[Generation] Upload complete for media', mediaItem.id, 'progress:', uploadProgress);
        }

        if (abortRef.current.aborted) {
          return;
        }

        if (uploadedMediaItems.length === 0) {
          throw new Error('All selected clips were too large to upload. Please choose shorter or lower-resolution videos.');
        }

        animateStepChange('starting');
        setProgress(32);
        setStatusDetail('Starting montage creation...');

        const job = await createMontageJob({
          mediaItems: uploadedMediaItems,
          musicMode,
          musicTrackUrl: musicMode === 'preset' ? musicUrl : null,
          musicBpm: musicMode === 'preset' ? normalizedMusicBpm : null,
          style,
          targetDuration: duration,
          aiEnhance,
        });

        console.log('[Generation] Backend job created:', job);
        setProgress(35);
        setStatusDetail(
          job.estimatedSeconds > 0
            ? `Job started. Estimated time: ${job.estimatedSeconds}s`
            : 'Job started. Waiting for the montage server...'
        );

        let finalResultUrl: string | null = null;

        while (!abortRef.current.aborted) {
          const status = await pollJobStatus(job.jobId);
          const mappedStep = mapBackendStepToUiStep(status.status);
          const mappedProgress = 35 + (clampProgress(status.progress) / 100) * 60;

          animateStepChange(mappedStep);
          setProgress(clampProgress(mappedProgress));
          setStatusDetail(status.current_step || stepLabels[mappedStep].sublabel);

          console.log('[Generation] Polled backend status:', status.status, mappedProgress, status.current_step);

          if (status.status === 'failed') {
            throw new Error(status.error || status.current_step || 'Montage generation failed.');
          }

          if (status.status === 'complete') {
            finalResultUrl = status.result_url;
            break;
          }

          await delay(2000);
        }

        if (abortRef.current.aborted) {
          return;
        }

        if (!finalResultUrl) {
          throw new Error('The montage finished without a downloadable video URL.');
        }

        animateStepChange('downloading');
        setProgress(95);
        setStatusDetail('Downloading your montage...');

        const localVideoPath = await downloadVideo(finalResultUrl);

        if (abortRef.current.aborted) {
          return;
        }

        setProgress(100);
        animateStepChange('complete');
        setStatusDetail('Opening preview...');

        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        const thumbnailUri = selectedMedia[0]?.uri || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop';
        const newProject: Project = {
          id: projectId,
          createdAt: new Date().toISOString(),
          musicTrackId: params.musicTrackId || null,
          musicTrackName: musicMode === 'ai-generated' ? 'AI Generated' : params.musicTrackName || null,
          style,
          duration,
          aiEnhanced: aiEnhance,
          status: 'complete',
          thumbnailUri,
          mediaCount: selectedMedia.length,
          localVideoPath,
          backendJobId: job.jobId,
          generatedMusicUrl: musicMode === 'preset' ? musicUrl ?? undefined : undefined,
          musicMode,
        };

        console.log('[Generation] Saving completed project:', newProject);
        addProject(newProject);

        setTimeout(() => {
          if (!abortRef.current.aborted) {
            router.replace({
              pathname: '/preview',
              params: { projectId: newProject.id },
            });
          }
        }, 600);
      } catch (error) {
        if (abortRef.current.aborted) {
          console.log('[Generation] Generation aborted by user');
          return;
        }

        console.error('[Generation] Backend montage generation failed:', error);
        animateStepChange('error');

        const message = error instanceof Error ? error.message : FRIENDLY_BACKEND_ERROR;
        if (!message || message.includes('Network request failed')) {
          setStatusDetail(FRIENDLY_BACKEND_ERROR);
          return;
        }

        setStatusDetail(message);
      }
    };

    void runGeneration();

    return () => {
      abortRef.current.aborted = true;
    };
  }, [
    addProject,
    animateStepChange,
    getSelectedMedia,
    params.aiEnhance,
    params.duration,
    params.musicBpm,
    params.musicMode,
    params.musicTrackId,
    params.musicTrackName,
    params.musicUrl,
    params.style,
    retryNonce,
    router,
  ]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Generation',
      'Are you sure? Your montage progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            abortRef.current.aborted = true;
            router.back();
          },
        },
      ]
    );
  }, [router]);

  const handleRetry = useCallback(() => {
    abortRef.current.aborted = true;
    currentStepRef.current = 'uploading';
    setProgress(0);
    setStatusDetail('');
    setCurrentStep('uploading');
    setRetryNonce((previous) => previous + 1);
  }, []);

  const step = stepLabels[currentStep] || stepLabels.uploading;

  return (
    <View style={genStyles.container} testID="generation-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0f0a1a', Colors.dark.background, '#0a0f14']}
        style={StyleSheet.absoluteFill}
      />

      <SparkleAnimation />

      <View style={genStyles.content}>
        <CircularProgress progress={progress} />

        <Animated.View style={[genStyles.statusContainer, { opacity: stepOpacity }]}> 
          <Text style={genStyles.statusLabel}>{step.label}</Text>
          <Text style={genStyles.statusSublabel}>{statusDetail || step.sublabel}</Text>
        </Animated.View>

        {currentStep === 'error' && (
          <TouchableOpacity onPress={handleRetry} style={genStyles.retryButton} testID="generation-retry-button">
            <Text style={genStyles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={handleCancel} style={genStyles.cancelButton} testID="generation-cancel-button">
        <X size={18} color={Colors.dark.textSecondary} />
        <Text style={genStyles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const genStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  statusLabel: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  statusSublabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: Colors.dark.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 50,
    paddingTop: 20,
  },
  cancelText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
});

const progressStyles = StyleSheet.create({
  container: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    opacity: 0.6,
  },
  glowGradient: {
    width: '100%',
    height: '100%',
  },
  innerCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: Colors.dark.text,
    letterSpacing: -1,
  },
});

const sparkleStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleText: {
    fontSize: 16,
    color: Colors.dark.accent,
  },
});
