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
  Share,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import {
  Play,
  Pause,
  Download,
  RotateCcw,
  Share2,
  ChevronLeft,
  Music,
  Check,
  Sparkles,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

const { width, height } = Dimensions.get('window');

function ConfettiAnimation({ visible }: { visible: boolean }) {
  const particles = useRef(
    Array.from({ length: 20 }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(-20),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const animations = particles.map((particle) => {
      const startX = Math.random() * width;
      particle.x.setValue(startX);
      particle.y.setValue(-20);
      particle.opacity.setValue(1);

      return Animated.parallel([
        Animated.timing(particle.y, {
          toValue: height,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(particle.x, {
          toValue: startX + (Math.random() * 120 - 60),
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(particle.opacity, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(80, animations).start();
  }, [particles, visible]);

  if (!visible) {
    return null;
  }

  const confettiColors = ['#8B5CF6', '#F59E0B', '#34D399', '#EF4444', '#3B82F6', '#EC4899'];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: confettiColors[index % confettiColors.length],
            transform: [{ translateX: particle.x }, { translateY: particle.y }],
            opacity: particle.opacity,
          }}
        />
      ))}
    </View>
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ projectId: string }>();
  const { projects } = useApp();

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportDone, setExportDone] = useState<boolean>(false);
  const [videoProgress, setVideoProgress] = useState<number>(0);
  const [positionMillis, setPositionMillis] = useState<number>(0);
  const [durationMillis, setDurationMillis] = useState<number>(0);
  const [videoLoading, setVideoLoading] = useState<boolean>(true);
  const playButtonOpacity = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<Video>(null);
  const timelineWidthRef = useRef<number>(1);
  const isPlayingRef = useRef<boolean>(true);
  const lastProgressUpdateRef = useRef<number>(0);

  const project = projects.find((item) => item.id === params.projectId);
  const localVideoPath = project?.localVideoPath ?? null;
  const hasVideo = Boolean(localVideoPath);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setVideoLoading(true);
      return;
    }

    setVideoLoading(false);

    const now = Date.now();
    if (now - lastProgressUpdateRef.current < 250) {
      return;
    }
    lastProgressUpdateRef.current = now;

    const pos = status.positionMillis ?? 0;
    const dur = status.durationMillis ?? 0;

    setPositionMillis(pos);
    setDurationMillis(dur);

    if (dur > 0) {
      setVideoProgress(pos / dur);
    }

    if (status.isPlaying !== isPlayingRef.current) {
      isPlayingRef.current = status.isPlaying;
      setIsPlaying(status.isPlaying);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!hasVideo || !videoRef.current) {
      return;
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const nextIsPlaying = !isPlaying;
    isPlayingRef.current = nextIsPlaying;
    setIsPlaying(nextIsPlaying);

    if (nextIsPlaying) {
      void videoRef.current.playAsync();
    } else {
      void videoRef.current.pauseAsync();
    }

    Animated.sequence([
      Animated.timing(playButtonOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(playButtonOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [hasVideo, isPlaying, playButtonOpacity]);

  const seekToPosition = useCallback((event: GestureResponderEvent) => {
    if (!hasVideo || !videoRef.current || durationMillis <= 0) {
      return;
    }

    const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / Math.max(1, timelineWidthRef.current)));
    const nextPosition = ratio * durationMillis;

    console.log('[Preview] Seeking video:', { ratio, nextPosition, durationMillis });
    setPositionMillis(nextPosition);
    setVideoProgress(ratio);
    void videoRef.current.setPositionAsync(nextPosition);
  }, [durationMillis, hasVideo]);

  const handleShare = useCallback(async () => {
    if (!localVideoPath) {
      Alert.alert('No Video', 'There is no finished montage available to share.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(localVideoPath, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      await Share.share({
        title: 'My Montage',
        message: 'Check out my montage',
        url: localVideoPath,
      });
    } catch (error) {
      console.error('[Preview] Share failed:', error);
      Alert.alert('Share Failed', 'Could not open the share sheet right now.');
    }
  }, [localVideoPath]);

  const handleExport = useCallback(async () => {
    if (!localVideoPath) {
      Alert.alert('No Video', 'There is no finished montage available to export.');
      return;
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setExporting(true);

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(localVideoPath, '_blank', 'noopener,noreferrer');
        }
        setExportDone(true);
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access to save your montage.');
        return;
      }

      console.log('[Preview] Saving composed video to library:', localVideoPath);
      await MediaLibrary.createAssetAsync(localVideoPath);
      setExportDone(true);
      setShowConfetti(true);

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setShowConfetti(false);
      }, 2400);

      await handleShare();
    } catch (error: unknown) {
      console.error('[Preview] Export failed:', error);
      const message = error instanceof Error ? error.message : 'Could not save the video to your library.';
      Alert.alert('Export Failed', message);
    } finally {
      setExporting(false);
    }
  }, [handleShare, localVideoPath]);

  const handleRegenerate = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.back();
  }, [router]);

  const handleBack = useCallback(() => {
    router.replace('/(tabs)/projects' as any);
  }, [router]);

  const effectiveDurationMillis = durationMillis || ((project?.duration ?? 30) * 1000);
  const currentTime = positionMillis / 1000;
  const totalTime = effectiveDurationMillis / 1000;
  const progressWidth = `${Math.min(videoProgress * 100, 100)}%`;

  return (
    <Animated.View style={[previewStyles.container, { opacity: fadeAnim }]} testID="preview-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableOpacity activeOpacity={1} onPress={togglePlay} style={previewStyles.videoContainer} testID="preview-video-tap-target">
        {hasVideo && localVideoPath ? (
          <Video
            ref={videoRef}
            source={{ uri: localVideoPath }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isPlaying}
            isLooping={true}
            progressUpdateIntervalMillis={300}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onLoadStart={() => {
              console.log('[Preview] Video load started');
              setVideoLoading(true);
            }}
            onError={(error) => {
              console.error('[Preview] Video error:', error);
              setVideoLoading(false);
            }}
            videoStyle={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View style={previewStyles.emptyState}>
            <Sparkles size={34} color={Colors.dark.accent} strokeWidth={1.6} />
            <Text style={previewStyles.emptyTitle}>Preview unavailable</Text>
            <Text style={previewStyles.emptySubtitle}>
              This project does not have a composed MP4 yet. Create a new montage to generate one.
            </Text>
          </View>
        )}

        {videoLoading && hasVideo && (
          <View style={previewStyles.loadingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.65)']}
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

        <View style={previewStyles.badgeRow}>
          {project?.musicTrackName ? (
            <View style={previewStyles.musicBadge}>
              <Music size={10} color="#fff" />
              <Text style={previewStyles.musicBadgeText}>
                {project.musicMode === 'ai-generated' ? 'AI Music' : project.musicTrackName}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={[previewStyles.topBar, { paddingTop: insets.top + 8 }]}> 
        <TouchableOpacity onPress={handleBack} style={previewStyles.backButton} testID="preview-back-button">
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={previewStyles.topTitle}>Preview</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={previewStyles.timelineContainer}>
        <Pressable
          onPress={seekToPosition}
          onLayout={(event) => {
            timelineWidthRef.current = event.nativeEvent.layout.width;
          }}
          style={previewStyles.timelineTrack}
          testID="preview-scrubber"
        >
          <View style={[previewStyles.timelineProgress, { width: progressWidth as any }]} />
          <View style={[previewStyles.timelineThumb, { left: progressWidth as any }]} />
        </Pressable>
        <View style={previewStyles.timelineLabels}>
          <Text style={previewStyles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={previewStyles.timeText}>{formatTime(totalTime)}</Text>
        </View>
      </View>

      <View style={[previewStyles.controls, { paddingBottom: insets.bottom + 12 }]}> 
        <View style={previewStyles.controlsRow}>
          <TouchableOpacity onPress={handleRegenerate} style={previewStyles.secondaryButton} testID="preview-regenerate-button">
            <RotateCcw size={18} color={Colors.dark.textSecondary} strokeWidth={1.5} />
            <Text style={previewStyles.secondaryText}>Regenerate</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleExport} activeOpacity={0.85} disabled={exporting} testID="preview-export-button">
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
              <Text style={previewStyles.exportText}>{exporting ? 'Saving...' : exportDone ? 'Saved' : 'Export'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={previewStyles.secondaryButton} testID="preview-share-button">
            <Share2 size={18} color={Colors.dark.textSecondary} strokeWidth={1.5} />
            <Text style={previewStyles.secondaryText}>Share</Text>
          </TouchableOpacity>
        </View>

        {project ? (
          <View style={previewStyles.metaRow}>
            <Text style={previewStyles.metaText}>
              {project.style.charAt(0).toUpperCase() + project.style.slice(1)} · {project.duration}s · {project.mediaCount} items
              {project.musicTrackName ? ` · ${project.musicTrackName}` : ''}
              {project.aiEnhanced ? ' · AI Motion' : ' · Ken Burns'}
            </Text>
          </View>
        ) : null}
      </View>

      <ConfettiAnimation visible={showConfetti} />
    </Animated.View>
  );
}

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
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
    backgroundColor: '#0E0E11',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
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
  badgeRow: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
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
    color: '#fff',
    fontSize: 17,
    fontWeight: '700' as const,
  },
  timelineContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: Colors.dark.background,
  },
  timelineTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.dark.surfaceLight,
    overflow: 'visible',
    justifyContent: 'center',
  },
  timelineProgress: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 999,
    backgroundColor: Colors.dark.accent,
  },
  timelineThumb: {
    position: 'absolute',
    top: -4,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: Colors.dark.accent,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600' as const,
  },
  controls: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  exportButton: {
    minWidth: 120,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  exportText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  metaRow: {
    marginTop: 14,
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
  },
});
