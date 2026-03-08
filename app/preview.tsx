import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Play,
  Pause,
  Download,
  RotateCcw,
  Share2,
  ChevronLeft,
  Music,
  Check,
  AudioLines,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { saveAllClipsToLibrary } from '@/services/video-cache';
import { BeatSyncData } from '@/types';

const { width, height } = Dimensions.get('window');

function ConfettiAnimation({ visible }: { visible: boolean }) {
  const particles = useRef(
    Array.from({ length: 20 }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(-20),
      opacity: new Animated.Value(1),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;
    const animations = particles.map((p) => {
      const startX = Math.random() * width;
      p.x.setValue(startX);
      p.y.setValue(-20);
      p.opacity.setValue(1);

      return Animated.parallel([
        Animated.timing(p.y, {
          toValue: height,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: startX + (Math.random() * 100 - 50),
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: Math.random() * 10,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]);
    });
    Animated.stagger(80, animations).start();
  }, [visible, particles]);

  if (!visible) return null;

  const confettiColors = ['#8B5CF6', '#F59E0B', '#34D399', '#EF4444', '#3B82F6', '#EC4899'];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute' as const,
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: confettiColors[i % confettiColors.length],
            transform: [
              { translateX: p.x },
              { translateY: p.y },
            ],
            opacity: p.opacity,
          }}
        />
      ))}
    </View>
  );
}

function BeatIndicator({ isOnBeat }: { isOnBeat: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isOnBeat) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.4, duration: 80, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [isOnBeat, scaleAnim, opacityAnim]);

  return (
    <Animated.View style={[beatStyles.dot, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
      <View style={beatStyles.dotInner} />
    </Animated.View>
  );
}

export default function PreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ projectId: string }>();
  const { projects } = useApp();

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentClipIndex, setCurrentClipIndex] = useState<number>(0);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [showSharePrompt, setShowSharePrompt] = useState<boolean>(false);
  const [audioLoaded, setAudioLoaded] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportDone, setExportDone] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [clipLoading, setClipLoading] = useState<boolean>(false);
  const [currentBeatIndex, setCurrentBeatIndex] = useState<number>(0);
  const [isOnBeat, setIsOnBeat] = useState<boolean>(false);
  const [videoKey, setVideoKey] = useState<number>(0);
  const playButtonOpacity = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const crossfadeAnim = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<Video>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const beatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);

  const project = projects.find(p => p.id === params.projectId);
  const beatSync: BeatSyncData | undefined = project?.beatSyncData;

  const playbackUris = React.useMemo(() =>
    project?.localVideoUris?.length
      ? project.localVideoUris
      : (project?.videoClipUris ?? []),
    [project?.localVideoUris, project?.videoClipUris]
  );

  const hasVideoClips = playbackUris.length > 0;
  const hasGeneratedMusic = !!project?.generatedMusicUrl;
  const hasBeatSync = !!beatSync && beatSync.clipTimings.length > 0;
  const totalDuration = project?.duration || 30;
  const totalDurationMs = hasBeatSync ? beatSync!.totalDurationMs : totalDuration * 1000;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (!hasGeneratedMusic || !project?.generatedMusicUrl) return;

    let mounted = true;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;

    const loadAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: project.generatedMusicUrl! },
          { shouldPlay: true, isLooping: false, volume: 1.0 },
        );

        if (!mounted) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        setAudioLoaded(true);
        console.log('[Preview] Audio loaded and playing, duration limit:', totalDurationMs, 'ms');

        const setupLooping = () => {
          if (!mounted) return;
          loopTimer = setTimeout(async () => {
            if (!mounted || !soundRef.current) return;
            try {
              await soundRef.current.setPositionAsync(0);
              await soundRef.current.playAsync();
              console.log('[Preview] Audio looped back to start');
              setupLooping();
            } catch (e) {
              console.error('[Preview] Loop error:', e);
            }
          }, totalDurationMs);
        };
        setupLooping();
      } catch (error) {
        console.error('[Preview] Error loading audio:', error);
      }
    };

    void loadAudio();

    return () => {
      mounted = false;
      if (loopTimer) clearTimeout(loopTimer);
      if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [hasGeneratedMusic, project?.generatedMusicUrl, totalDurationMs]);

  useEffect(() => {
    if (!soundRef.current) return;

    if (isPlaying) {
      void soundRef.current.playAsync().catch(() => {});
    } else {
      void soundRef.current.pauseAsync().catch(() => {});
    }
  }, [isPlaying, audioLoaded]);

  const currentClipIndexRef = useRef<number>(0);
  currentClipIndexRef.current = currentClipIndex;

  const startBeatSyncPlayback = useCallback(() => {
    if (!hasBeatSync || !beatSync) return;

    if (beatTimerRef.current) clearInterval(beatTimerRef.current);
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current);

    startTimeRef.current = Date.now();
    let currentTimingIndex = 0;

    const scheduleNextClip = () => {
      if (!isPlayingRef.current) return;
      if (currentTimingIndex >= beatSync.clipTimings.length) {
        currentTimingIndex = 0;
        startTimeRef.current = Date.now();
      }

      const timing = beatSync.clipTimings[currentTimingIndex];
      if (timing.clipIndex !== currentClipIndexRef.current) {
        setVideoKey(prev => prev + 1);
      }
      setCurrentClipIndex(timing.clipIndex);
      setCurrentBeatIndex(currentTimingIndex);

      const elapsed = Date.now() - startTimeRef.current;
      const nextTimingIndex = currentTimingIndex + 1;

      if (nextTimingIndex < beatSync.clipTimings.length) {
        const nextStart = beatSync.clipTimings[nextTimingIndex].startMs;
        const delay = Math.max(nextStart - elapsed, 50);

        clipTimerRef.current = setTimeout(() => {
          currentTimingIndex = nextTimingIndex;
          const progressPct = nextStart / beatSync.totalDurationMs;
          setVideoProgress(progressPct);

          Animated.sequence([
            Animated.timing(crossfadeAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }),
            Animated.timing(crossfadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
          ]).start();

          scheduleNextClip();
        }, delay);
      } else {
        const loopDelay = Math.max(beatSync.totalDurationMs - elapsed, 50);
        clipTimerRef.current = setTimeout(() => {
          currentTimingIndex = 0;
          startTimeRef.current = Date.now();
          setVideoProgress(0);
          scheduleNextClip();
        }, loopDelay);
      }
    };

    scheduleNextClip();

    beatTimerRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      setIsOnBeat(true);
      setTimeout(() => setIsOnBeat(false), 150);
    }, beatSync.beatIntervalMs);

    return () => {
      if (beatTimerRef.current) clearInterval(beatTimerRef.current);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    };
  }, [hasBeatSync, beatSync, crossfadeAnim]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;

    if (isPlaying && hasBeatSync) {
      const cleanup = startBeatSyncPlayback();
      return cleanup;
    } else {
      if (beatTimerRef.current) clearInterval(beatTimerRef.current);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    }
  }, [isPlaying, hasBeatSync, startBeatSyncPlayback]);

  const handleVideoStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setClipLoading(true);
      return;
    }
    setClipLoading(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsPlaying(prev => !prev);

    if (hasVideoClips && videoRef.current) {
      void videoRef.current.getStatusAsync().then(status => {
        if (status.isLoaded) {
          if (status.isPlaying) {
            void videoRef.current?.pauseAsync();
          } else {
            void videoRef.current?.playAsync();
          }
        }
      });
    }

    Animated.sequence([
      Animated.timing(playButtonOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(playButtonOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [hasVideoClips, playButtonOpacity]);

  const handleExport = useCallback(async () => {
    const urisToSave = playbackUris.length > 0
      ? playbackUris
      : (project?.videoClipUris ?? []);

    if (urisToSave.length === 0) {
      Alert.alert('No Video', 'No video clips available to export.');
      return;
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setExporting(true);
    try {
      console.log('[Preview] Exporting', urisToSave.length, 'clips to library...');
      const success = await saveAllClipsToLibrary(urisToSave, (done, total) => {
        console.log(`[Preview] Saved clip ${done}/${total}`);
      });

      if (success) {
        setExportDone(true);
        setShowConfetti(true);
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setTimeout(() => {
          setShowSharePrompt(true);
        }, 1200);
      }
    } catch (error: any) {
      console.error('[Preview] Export failed:', error);
      Alert.alert('Export Failed', error?.message || 'Could not save video to your library. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [playbackUris, project?.videoClipUris]);

  const handleRegenerate = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (soundRef.current) {
      void soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    router.back();
  }, [router]);

  const handleShare = useCallback((platform: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowSharePrompt(false);
    console.log(`[Preview] Sharing to ${platform}`);
  }, []);

  const progressWidth = `${Math.min(videoProgress * 100, 100)}%`;

  const currentVideoUri = hasVideoClips ? playbackUris[currentClipIndex] : null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const currentTime = totalDuration * videoProgress;
  const totalClipTimings = hasBeatSync ? beatSync!.clipTimings.length : playbackUris.length;

  return (
    <Animated.View style={[previewStyles.container, { opacity: fadeAnim }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableOpacity
        activeOpacity={1}
        onPress={togglePlay}
        style={previewStyles.videoContainer}
      >
        {hasVideoClips && currentVideoUri ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: crossfadeAnim }]}>
            <Video
              key={`clip-${videoKey}-${currentClipIndex}`}
              ref={videoRef}
              source={{ uri: currentVideoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isPlaying}
              isLooping={true}
              isMuted={hasGeneratedMusic}
              onPlaybackStatusUpdate={handleVideoStatusUpdate}
              videoStyle={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]} />
        )}

        {clipLoading && hasVideoClips && (
          <View style={previewStyles.loadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[previewStyles.playOverlay, { opacity: playButtonOpacity }]}>
          <View style={previewStyles.playCircle}>
            {isPlaying ? (
              <Pause size={32} color="#fff" fill="#fff" />
            ) : (
              <Play size={32} color="#fff" fill="#fff" />
            )}
          </View>
        </Animated.View>

        {totalClipTimings > 1 && (
          <View style={previewStyles.imageCounter}>
            <Text style={previewStyles.imageCounterText}>
              {currentBeatIndex + 1} / {totalClipTimings}
            </Text>
          </View>
        )}

        <View style={previewStyles.badgeRow}>
          {hasBeatSync && (
            <View style={previewStyles.beatSyncBadge}>
              <AudioLines size={10} color="#fff" />
              <Text style={previewStyles.beatSyncBadgeText}>{beatSync!.bpm} BPM</Text>
            </View>
          )}
          {hasGeneratedMusic && (
            <View style={previewStyles.musicBadge}>
              <Music size={10} color="#fff" />
              <Text style={previewStyles.musicBadgeText}>
                {project?.musicMode === 'ai-generated' ? 'AI Music' : project?.musicTrackName || 'Music'}
              </Text>
            </View>
          )}
          {isPlaying && hasBeatSync && (
            <BeatIndicator isOnBeat={isOnBeat} />
          )}
        </View>
      </TouchableOpacity>

      <View style={[previewStyles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => {
            if (soundRef.current) {
              void soundRef.current.unloadAsync().catch(() => {});
              soundRef.current = null;
            }
            router.replace('/(tabs)/(create)' as any);
          }}
          style={previewStyles.backButton}
        >
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={previewStyles.topTitle}>Preview</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={previewStyles.timelineContainer}>
        {hasBeatSync && (
          <View style={previewStyles.segmentsRow}>
            {beatSync!.clipTimings.map((timing, idx) => (
              <View
                key={idx}
                style={[
                  previewStyles.segment,
                  {
                    flex: timing.durationMs,
                    backgroundColor: idx <= currentBeatIndex
                      ? Colors.dark.accent
                      : Colors.dark.surfaceLight,
                  },
                ]}
              />
            ))}
          </View>
        )}
        <View style={previewStyles.timelineTrack}>
          <View style={[previewStyles.timelineProgress, { width: progressWidth as any }]} />
        </View>
        <View style={previewStyles.timelineLabels}>
          <Text style={previewStyles.timeText}>
            {formatTime(currentTime)}
          </Text>
          <Text style={previewStyles.timeText}>
            {formatTime(totalDuration)}
          </Text>
        </View>
      </View>

      <View style={[previewStyles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <View style={previewStyles.controlsRow}>
          <TouchableOpacity onPress={handleRegenerate} style={previewStyles.secondaryButton}>
            <RotateCcw size={18} color={Colors.dark.textSecondary} strokeWidth={1.5} />
            <Text style={previewStyles.secondaryText}>Regenerate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleExport}
            activeOpacity={0.85}
            disabled={exporting}
          >
            <LinearGradient
              colors={exportDone ? ['#34D399', '#059669'] : [Colors.dark.accent, Colors.dark.accentDark]}
              style={previewStyles.exportButton}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : exportDone ? (
                <Check size={18} color="#fff" strokeWidth={2.5} />
              ) : (
                <Download size={18} color="#fff" strokeWidth={2} />
              )}
              <Text style={previewStyles.exportText}>
                {exporting ? 'Saving...' : exportDone ? 'Saved' : 'Export'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleShare('general')}
            style={previewStyles.secondaryButton}
          >
            <Share2 size={18} color={Colors.dark.textSecondary} strokeWidth={1.5} />
            <Text style={previewStyles.secondaryText}>Share</Text>
          </TouchableOpacity>
        </View>

        {project && (
          <View style={previewStyles.metaRow}>
            <Text style={previewStyles.metaText}>
              {project.style.charAt(0).toUpperCase() + project.style.slice(1)} · {project.duration}s · {project.mediaCount} clips
              {project.musicTrackName ? ` · ${project.musicTrackName}` : ''}
              {hasBeatSync ? ` · ${beatSync!.bpm} BPM` : ''}
            </Text>
          </View>
        )}
      </View>

      <ConfettiAnimation visible={showConfetti} />

      {showSharePrompt && (
        <View style={previewStyles.sharePromptOverlay}>
          <View style={previewStyles.sharePromptCard}>
            <Text style={previewStyles.sharePromptTitle}>Share your montage!</Text>
            <Text style={previewStyles.sharePromptSubtitle}>
              {playbackUris.length > 1
                ? `${playbackUris.length} clips saved to your photo library`
                : 'Your video has been saved to your library'}
            </Text>
            <View style={previewStyles.shareButtons}>
              <TouchableOpacity
                onPress={() => handleShare('tiktok')}
                style={[previewStyles.shareButton, { backgroundColor: '#000' }]}
              >
                <Text style={previewStyles.shareButtonText}>TikTok</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleShare('instagram')}
                style={[previewStyles.shareButton, { backgroundColor: '#E1306C' }]}
              >
                <Text style={previewStyles.shareButtonText}>Instagram</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowSharePrompt(false)}>
              <Text style={previewStyles.dismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const beatStyles = StyleSheet.create({
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
});

const previewStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCounterText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  badgeRow: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  beatSyncBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  beatSyncBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  musicBadge: {
    backgroundColor: 'rgba(245,158,11,0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  musicBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  timelineContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  segmentsRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  segment: {
    height: 3,
    borderRadius: 1.5,
  },
  timelineTrack: {
    height: 4,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  timelineProgress: {
    height: '100%',
    backgroundColor: Colors.dark.accent,
    borderRadius: 2,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontWeight: '500' as const,
  },
  controls: {
    backgroundColor: Colors.dark.background,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    minWidth: 140,
  },
  exportText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  secondaryButton: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  metaRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  metaText: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  sharePromptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  sharePromptCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  sharePromptTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  sharePromptSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  shareButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  shareButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  dismissText: {
    fontSize: 14,
    color: Colors.dark.textTertiary,
    fontWeight: '500' as const,
    paddingVertical: 8,
  },
});
