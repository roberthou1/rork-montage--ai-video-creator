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
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { usePhotoLibrary } from '@/contexts/PhotoLibraryContext';
import { Project, MontageStyle, TargetDuration, BeatSyncData } from '@/types';
import { generateMusic } from '@/services/fal-music';
import { analyzeMusicTrack, generateClipTimings } from '@/services/beat-analysis';
import { analyzeClips, assignClipSegments } from '@/services/clip-analysis';
import { resolveAllUris } from '@/services/video-cache';

const _screen = Dimensions.get('window');

const stepLabels: Record<string, { label: string; sublabel: string }> = {
  analyzing: { label: 'Analyzing your clips...', sublabel: 'Finding the best moments in each clip' },
  music: { label: 'Composing your soundtrack...', sublabel: 'AI is creating custom music' },
  'beat-analysis': { label: 'Analyzing the beat...', sublabel: 'Mapping rhythm and energy patterns' },
  syncing: { label: 'Syncing to the beat...', sublabel: 'Aligning clip cuts with the rhythm' },
  optimizing: { label: 'Selecting best moments...', sublabel: 'Choosing the most engaging parts' },
  finalizing: { label: 'Adding finishing touches...', sublabel: 'Polishing your masterpiece' },
  complete: { label: 'Your montage is ready!', sublabel: 'Looking great' },
  error: { label: 'Something went wrong', sublabel: 'Please try again' },
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
    return () => { rotate.stop(); pulse.stop(); };
  }, [pulseAnim, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[progressStyles.container, { transform: [{ scale: pulseAnim }] }]}>
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
    const animations = sparkles.map((s, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 400),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(s.scale, { toValue: 1, friction: 3, useNativeDriver: true }),
          ]),
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(s.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
          Animated.delay(800),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [sparkles]);

  return (
    <View style={sparkleStyles.container}>
      {sparkles.map((s, i) => (
        <Animated.View
          key={i}
          style={[
            sparkleStyles.sparkle,
            {
              transform: [
                { translateX: s.x },
                { translateY: s.y },
                { scale: s.scale },
              ],
              opacity: s.opacity,
            },
          ]}
        >
          <Text style={sparkleStyles.sparkleText}>✦</Text>
        </Animated.View>
      ))}
    </View>
  );
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

  const [currentStep, setCurrentStep] = useState<string>('analyzing');
  const [progress, setProgress] = useState<number>(0);
  const [statusDetail, setStatusDetail] = useState<string>('');
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const abortRef = useRef({ aborted: false });
  const hasStarted = useRef(false);

  const animateStepChange = useCallback((newStep: string) => {
    Animated.sequence([
      Animated.timing(stepOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(stepOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setCurrentStep(newStep);
  }, [stepOpacity]);

  const getSelectedVideos = useCallback(() => {
    const selectedIds = params.selectedIds ? params.selectedIds.split(',').filter(Boolean) : [];
    if (selectedIds.length === 0) {
      return photos.filter(p => p.type === 'video').slice(0, Number(params.photoCount) || 8);
    }

    const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
    const orderedSelected = selectedIds
      .map((id) => photoMap.get(id))
      .filter((item): item is (typeof photos)[number] => Boolean(item));

    if (orderedSelected.length === 0) {
      return photos.filter(p => p.type === 'video').slice(0, Number(params.photoCount) || 8);
    }

    return orderedSelected;
  }, [params.selectedIds, params.photoCount, photos]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const runGeneration = async () => {
      const style = (params.style as MontageStyle) || 'dynamic';
      const musicMode = (params.musicMode as 'preset' | 'ai-generated' | 'none') || 'none';
      const targetDuration = Number(params.duration) || 30;
      const musicBpm = Number(params.musicBpm) || 0;
      const musicUrl = params.musicUrl || '';
      const projectId = `p-${Date.now()}`;
      const selectedVideos = getSelectedVideos();

      console.log('[Generation] Starting with', selectedVideos.length, 'video clips, style:', style, 'musicMode:', musicMode);
      console.log('[Generation] Music URL:', musicUrl?.substring(0, 80), 'BPM:', musicBpm);

      try {
        animateStepChange('analyzing');
        setProgress(3);
        setStatusDetail(`Preparing ${selectedVideos.length} video clips...`);

        if (abortRef.current.aborted) return;

        const rawUris = selectedVideos.map((item) => item.uri);
        const clipDurations = selectedVideos.map((item) => (item.duration || 5) * 1000);

        setProgress(4);
        setStatusDetail('Resolving video files...');

        const videoUris = await resolveAllUris(rawUris, (done, total) => {
          if (abortRef.current.aborted) return;
          setStatusDetail(`Preparing clip ${done}/${total}...`);
        });

        console.log('[Generation] Resolved URIs:', videoUris.map(u => u.substring(0, 60)));

        if (abortRef.current.aborted) return;

        setProgress(5);
        setStatusDetail(`Analyzing ${selectedVideos.length} clips for best moments...`);

        const analyzedClips = await analyzeClips(
          videoUris,
          clipDurations,
          (p, msg) => {
            if (abortRef.current.aborted) return;
            setProgress(5 + (p / 100) * 10);
            setStatusDetail(msg);
          },
        );

        console.log('[Generation] Clip analysis complete:', analyzedClips.length, 'clips analyzed');

        if (abortRef.current.aborted) return;

        let generatedMusicUrl: string | undefined;
        let finalBpm = musicBpm;
        let finalMusicUrl = musicUrl;

        if (musicMode === 'ai-generated') {
          animateStepChange('music');
          setStatusDetail('');
          setProgress(18);

          try {
            generatedMusicUrl = await generateMusic(
              style,
              targetDuration,
              (mp) => {
                if (abortRef.current.aborted) return;
                setProgress(18 + (mp.progress / 100) * 25);
                setStatusDetail(mp.statusMessage);
              },
              abortRef.current,
            );
            console.log('[Generation] Music generated:', generatedMusicUrl?.substring(0, 80));
            finalMusicUrl = generatedMusicUrl || '';

            const styleBpmMap: Record<MontageStyle, number> = {
              dynamic: 128,
              cinematic: 80,
              energetic: 140,
              dreamy: 85,
            };
            finalBpm = styleBpmMap[style];
          } catch (error: any) {
            if (error?.message === 'Generation cancelled') return;
            console.error('[Generation] Music generation failed:', error?.message);
            setStatusDetail('Music generation failed, continuing without music...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (abortRef.current.aborted) return;
        } else if (musicMode === 'preset' && musicUrl) {
          finalMusicUrl = musicUrl;
          generatedMusicUrl = musicUrl;
        }

        if (finalBpm <= 0) {
          finalBpm = style === 'energetic' ? 140 : style === 'cinematic' ? 80 : style === 'dreamy' ? 85 : 120;
          console.log('[Generation] No BPM provided, using default for style:', finalBpm);
        }

        const beatAnalysisStart = musicMode === 'ai-generated' ? 45 : 18;
        animateStepChange('beat-analysis');
        setProgress(beatAnalysisStart);
        setStatusDetail(`Analyzing ${finalBpm} BPM rhythm pattern...`);

        if (abortRef.current.aborted) return;

        const beatMap = await analyzeMusicTrack(
          finalMusicUrl,
          finalBpm,
          targetDuration,
          (p, msg) => {
            if (abortRef.current.aborted) return;
            setProgress(beatAnalysisStart + (p / 100) * 20);
            setStatusDetail(msg);
          },
        );

        console.log('[Generation] Beat analysis complete:', beatMap.beats.length, 'beats,', beatMap.sections.length, 'sections');

        if (abortRef.current.aborted) return;

        const syncStart = beatAnalysisStart + 22;
        animateStepChange('syncing');
        setProgress(syncStart);
        setStatusDetail('Generating beat-synced clip timeline...');

        const clipTimings = generateClipTimings(
          beatMap,
          selectedVideos.length,
          targetDuration * 1000,
          style,
        );

        console.log('[Generation] Generated', clipTimings.length, 'clip timings');
        setProgress(syncStart + 8);

        if (abortRef.current.aborted) return;

        animateStepChange('optimizing');
        setStatusDetail('Assigning best clip segments to timeline...');
        setProgress(syncStart + 12);

        const optimizedTimings = assignClipSegments(analyzedClips, clipTimings);

        console.log('[Generation] Optimized timings with best segments');
        setProgress(syncStart + 18);
        setStatusDetail(`${optimizedTimings.length} cuts synced to beat with best moments`);
        await new Promise(resolve => setTimeout(resolve, 400));

        if (abortRef.current.aborted) return;

        animateStepChange('finalizing');
        setStatusDetail('Almost done...');
        setProgress(92);
        await new Promise(resolve => setTimeout(resolve, 500));

        if (abortRef.current.aborted) return;

        setProgress(100);
        animateStepChange('complete');

        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        const thumbnailUri = videoUris[0] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop';

        const beatSyncData: BeatSyncData = {
          bpm: beatMap.bpm,
          beatIntervalMs: beatMap.beatIntervalMs,
          clipTimings: optimizedTimings.map(t => ({
            clipIndex: t.clipIndex,
            startMs: t.startMs,
            durationMs: t.durationMs,
          })),
          totalDurationMs: beatMap.totalDurationMs,
        };

        const newProject: Project = {
          id: projectId,
          createdAt: new Date().toISOString(),
          musicTrackId: params.musicTrackId || null,
          musicTrackName: musicMode === 'ai-generated' ? 'AI Generated' : (params.musicTrackName || null),
          style,
          duration: (targetDuration as TargetDuration) || 30,
          aiEnhanced: false,
          status: 'complete',
          thumbnailUri,
          mediaCount: selectedVideos.length,
          originalImageUris: videoUris,
          videoClipUris: videoUris,
          localVideoUris: videoUris,
          generatedMusicUrl: generatedMusicUrl || finalMusicUrl || undefined,
          musicMode,
          beatSyncData,
        };

        addProject(newProject);
        console.log('[Generation] Project created:', projectId, 'with', videoUris.length, 'video clips, BPM:', finalBpm);
        console.log('[Generation] Music URL saved:', (generatedMusicUrl || finalMusicUrl || 'none').substring(0, 80));

        setTimeout(() => {
          if (!abortRef.current.aborted) {
            router.replace({
              pathname: '/preview',
              params: { projectId: newProject.id },
            });
          }
        }, 800);

      } catch (error: any) {
        if (error?.message === 'Generation cancelled') {
          console.log('[Generation] Cancelled by user');
          return;
        }
        console.error('[Generation] Error:', error);
        animateStepChange('error');
        setStatusDetail(error?.message || 'An unexpected error occurred');
      }
    };

    void runGeneration();

    return () => {
      abortRef.current.aborted = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
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
  };

  const handleRetry = () => {
    abortRef.current = { aborted: false };
    hasStarted.current = false;
    setProgress(0);
    setCurrentStep('analyzing');
    setStatusDetail('');
  };

  const step = stepLabels[currentStep] || stepLabels.analyzing;

  return (
    <View style={genStyles.container}>
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
          <Text style={genStyles.statusSublabel}>
            {statusDetail || step.sublabel}
          </Text>
        </Animated.View>

        {currentStep === 'error' && (
          <TouchableOpacity onPress={handleRetry} style={genStyles.retryButton}>
            <Text style={genStyles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={handleCancel} style={genStyles.cancelButton}>
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
    pointerEvents: 'none',
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleText: {
    fontSize: 16,
    color: Colors.dark.accent,
  },
});
