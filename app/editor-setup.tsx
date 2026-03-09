import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  FlatList,
  Platform,
  // Switch, // TODO: Re-enable when AI photo motion toggle is added back
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Music,
  Play,
  Pause,
  Search,
  X,
  Zap,
  Film,
  Sparkles,
  CloudFog,
  Check,
  ChevronRight,
  Wand2,
  Radio,
  AudioLines,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { musicTracks } from '@/mocks/music';
import { MusicTrack, MontageStyle, TargetDuration, MusicCategory } from '@/types';
import { useApp } from '@/contexts/AppContext';

const styleOptions: { id: MontageStyle; name: string; description: string; icon: React.ReactNode }[] = [
  { id: 'dynamic', name: 'Dynamic', description: 'Fast cuts, zoom transitions', icon: <Zap size={22} color="#F59E0B" strokeWidth={1.5} /> },
  { id: 'cinematic', name: 'Cinematic', description: 'Slow pans, fade transitions', icon: <Film size={22} color="#8B5CF6" strokeWidth={1.5} /> },
  { id: 'energetic', name: 'Energetic', description: 'Beat-matched, flash cuts', icon: <Sparkles size={22} color="#EF4444" strokeWidth={1.5} /> },
  { id: 'dreamy', name: 'Dreamy', description: 'Soft dissolves, gentle motion', icon: <CloudFog size={22} color="#34D399" strokeWidth={1.5} /> },
];

const durationOptions: TargetDuration[] = [15, 30, 60];

const categories: { id: MusicCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'chill', label: 'Chill' },
  { id: 'upbeat', label: 'Upbeat' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'electronic', label: 'Electronic' },
];

function MusicBrowser({
  visible,
  onClose,
  onSelect,
  selectedTrack,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack | null) => void;
  selectedTrack: MusicTrack | null;
}) {
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<MusicCategory | 'all'>('all');
  const [playing, setPlaying] = useState<string | null>(null);
  const previewSoundRef = React.useRef<Audio.Sound | null>(null);

  const filtered = musicTracks.filter(t => {
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.artist.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || t.category === category;
    return matchesSearch && matchesCategory;
  });

  React.useEffect(() => {
    return () => {
      if (previewSoundRef.current) {
        void previewSoundRef.current.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!visible && previewSoundRef.current) {
      void previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
      setPlaying(null);
    }
  }, [visible]);

  const handlePlay = async (trackId: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (playing === trackId) {
      if (previewSoundRef.current) {
        await previewSoundRef.current.pauseAsync().catch(() => {});
      }
      setPlaying(null);
      return;
    }

    if (previewSoundRef.current) {
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
    }

    const track = musicTracks.find(t => t.id === trackId);
    if (!track) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.preview_url },
        { shouldPlay: true, volume: 1.0 },
      );

      previewSoundRef.current = sound;
      setPlaying(trackId);
      console.log('[MusicBrowser] Playing preview for:', track.name);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(null);
        }
      });
    } catch (error) {
      console.error('[MusicBrowser] Error playing preview:', error);
      setPlaying(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={musicStyles.overlay}>
        <View style={musicStyles.sheet}>
          <View style={musicStyles.handle} />
          <View style={musicStyles.sheetHeader}>
            <Text style={musicStyles.sheetTitle}>Choose Music</Text>
            <TouchableOpacity onPress={onClose} style={musicStyles.closeButton}>
              <X size={20} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={musicStyles.searchContainer}>
            <Search size={18} color={Colors.dark.textTertiary} />
            <TextInput
              style={musicStyles.searchInput}
              placeholder="Search tracks..."
              placeholderTextColor={Colors.dark.textTertiary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={musicStyles.chips}>
            {categories.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[musicStyles.chip, category === c.id && musicStyles.chipActive]}
              >
                <Text style={[musicStyles.chipText, category === c.id && musicStyles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => {
              if (previewSoundRef.current) {
                void previewSoundRef.current.unloadAsync().catch(() => {});
                previewSoundRef.current = null;
              }
              setPlaying(null);
              onSelect(null);
              onClose();
            }}
            style={musicStyles.noMusicButton}
          >
            <Text style={musicStyles.noMusicText}>No music</Text>
          </TouchableOpacity>

          <FlatList
            data={filtered}
            keyExtractor={t => t.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  if (previewSoundRef.current) {
                    void previewSoundRef.current.unloadAsync().catch(() => {});
                    previewSoundRef.current = null;
                  }
                  setPlaying(null);
                  onSelect(item);
                  onClose();
                }}
                style={[musicStyles.trackRow, selectedTrack?.id === item.id && musicStyles.trackRowSelected]}
              >
                <TouchableOpacity onPress={() => void handlePlay(item.id)} style={musicStyles.playBtn}>
                  {playing === item.id ? (
                    <Pause size={16} color={Colors.dark.accent} fill={Colors.dark.accent} />
                  ) : (
                    <Play size={16} color={Colors.dark.accent} fill={Colors.dark.accent} />
                  )}
                </TouchableOpacity>
                <View style={musicStyles.trackInfo}>
                  <Text style={musicStyles.trackName} numberOfLines={1}>{item.name}</Text>
                  <Text style={musicStyles.trackArtist} numberOfLines={1}>{item.artist}</Text>
                </View>
                <Text style={musicStyles.trackDuration}>{formatDuration(item.duration_seconds)}</Text>
                <View style={musicStyles.bpmBadge}>
                  <Text style={musicStyles.bpmText}>{item.bpm}</Text>
                </View>
                {selectedTrack?.id === item.id && (
                  <Check size={18} color={Colors.dark.accent} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function EditorSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ collectionId?: string; collectionName?: string; selectedIds?: string }>();
  const { settings } = useApp();

  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [musicMode, setMusicMode] = useState<'preset' | 'ai-generated' | 'none'>('none');
  const [style, setStyle] = useState<MontageStyle>(settings.defaultStyle);
  const [duration, setDuration] = useState<TargetDuration>(30);
  const [musicBrowserVisible, setMusicBrowserVisible] = useState<boolean>(false);
  // TODO: Re-enable AI photo-to-video enhancement when ready
  // const [aiEnhance, setAiEnhance] = useState<boolean>(settings.aiEnhancementDefault);
  const aiEnhance = false;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const photoCount = params.selectedIds ? params.selectedIds.split(',').length : 8;

  const handleGenerate = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(buttonScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start(() => {
      router.push({
        pathname: '/generation',
        params: {
          style,
          duration: String(duration),
          aiEnhance: String(aiEnhance),
          musicTrackId: selectedTrack?.id ?? '',
          musicTrackName: selectedTrack?.name ?? '',
          musicBpm: selectedTrack ? String(selectedTrack.bpm) : '',
          musicUrl: selectedTrack?.download_url ?? '',
          musicMode,
          photoCount: String(photoCount),
          selectedIds: params.selectedIds ?? '',
        },
      });
    });
  }, [style, duration, selectedTrack, photoCount, musicMode, aiEnhance, params.selectedIds, router, buttonScale]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: params.collectionName || 'Editor Setup',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.text,
          headerShadowVisible: false,
        }}
      />
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.photoCountBanner}>
          <Text style={styles.photoCountText}>{photoCount} items selected</Text>
        </View>

        <Text style={styles.sectionLabel}>MUSIC</Text>
        <View style={styles.musicModeRow}>
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMusicMode('ai-generated');
              setSelectedTrack(null);
            }}
            style={[styles.musicModeCard, musicMode === 'ai-generated' && styles.musicModeCardActive]}
            activeOpacity={0.8}
          >
            <View style={[styles.musicModeIcon, musicMode === 'ai-generated' && styles.musicModeIconActive]}>
              <Wand2 size={20} color={musicMode === 'ai-generated' ? '#fff' : Colors.dark.secondary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.musicModeTitle, musicMode === 'ai-generated' && styles.musicModeTitleActive]}>AI Generate</Text>
            <Text style={styles.musicModeDesc}>Custom soundtrack</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMusicMode('preset');
              setMusicBrowserVisible(true);
            }}
            style={[styles.musicModeCard, musicMode === 'preset' && styles.musicModeCardActive]}
            activeOpacity={0.8}
          >
            <View style={[styles.musicModeIcon, musicMode === 'preset' && styles.musicModeIconActive]}>
              <Radio size={20} color={musicMode === 'preset' ? '#fff' : Colors.dark.accent} strokeWidth={1.5} />
            </View>
            <Text style={[styles.musicModeTitle, musicMode === 'preset' && styles.musicModeTitleActive]}>Browse</Text>
            <Text style={styles.musicModeDesc}>Pick a track</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMusicMode('none');
              setSelectedTrack(null);
            }}
            style={[styles.musicModeCard, musicMode === 'none' && styles.musicModeCardActive]}
            activeOpacity={0.8}
          >
            <View style={[styles.musicModeIcon, musicMode === 'none' && styles.musicModeIconActive]}>
              <X size={20} color={musicMode === 'none' ? '#fff' : Colors.dark.textTertiary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.musicModeTitle, musicMode === 'none' && styles.musicModeTitleActive]}>No Music</Text>
            <Text style={styles.musicModeDesc}>Silent</Text>
          </TouchableOpacity>
        </View>

        {musicMode === 'ai-generated' && (
          <View style={styles.aiMusicNote}>
            <Wand2 size={14} color={Colors.dark.secondary} />
            <Text style={styles.aiMusicNoteText}>
              AI will generate a unique {style} soundtrack as part of your montage
            </Text>
          </View>
        )}

        {musicMode === 'preset' && selectedTrack && (
          <TouchableOpacity
            onPress={() => setMusicBrowserVisible(true)}
            style={styles.musicCard}
            activeOpacity={0.8}
          >
            <View style={styles.musicIconCircle}>
              <Music size={22} color={Colors.dark.accent} strokeWidth={1.5} />
            </View>
            <View style={styles.musicInfo}>
              <Text style={styles.musicTitle}>{selectedTrack.name}</Text>
              <Text style={styles.musicArtist}>{selectedTrack.artist} · {selectedTrack.bpm} BPM</Text>
            </View>
            <ChevronRight size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>
        )}

        {musicMode === 'preset' && !selectedTrack && (
          <TouchableOpacity
            onPress={() => setMusicBrowserVisible(true)}
            style={styles.musicCard}
            activeOpacity={0.8}
          >
            <View style={styles.musicIconCircle}>
              <Music size={22} color={Colors.dark.accent} strokeWidth={1.5} />
            </View>
            <View style={styles.musicInfo}>
              <Text style={styles.musicTitle}>Choose a Track</Text>
              <Text style={styles.musicArtist}>Tap to browse library</Text>
            </View>
            <ChevronRight size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>STYLE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.styleRow}
        >
          {styleOptions.map(opt => {
            const isActive = style === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStyle(opt.id);
                }}
                style={[styles.styleCard, isActive && styles.styleCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.styleIconCircle, isActive && styles.styleIconCircleActive]}>
                  {opt.icon}
                </View>
                <Text style={[styles.styleCardTitle, isActive && styles.styleCardTitleActive]}>
                  {opt.name}
                </Text>
                <Text style={styles.styleCardDesc}>{opt.description}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>DURATION</Text>
        <View style={styles.durationRow}>
          {durationOptions.map(d => {
            const isActive = duration === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => {
                  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDuration(d);
                }}
                style={[styles.durationButton, isActive && styles.durationButtonActive]}
              >
                <Text style={[styles.durationText, isActive && styles.durationTextActive]}>
                  {d}s
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.durationNote}>Clips will be trimmed and synced to fit your target duration</Text>

        {/* TODO: Re-enable AI photo motion when image-to-video is supported
        <Text style={styles.sectionLabel}>PHOTO MOTION</Text>
        <View style={styles.aiCard}>
          <View style={styles.aiCardLeft}>
            <Wand2 size={20} color={Colors.dark.accent} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Bring photos to life with AI</Text>
            <Text style={styles.aiSubtitle}>
              {aiEnhance
                ? 'Uses AI to add subtle motion to still photos — gentle parallax, slow zooms, and natural movement. Takes ~2-3 min.'
                : 'Still photos will use a smooth Ken Burns pan-and-zoom effect (instant, no AI needed)'}
            </Text>
          </View>
          <Switch
            value={aiEnhance}
            onValueChange={(value) => {
              if (Platform.OS !== 'web') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setAiEnhance(value);
            }}
            trackColor={{ false: Colors.dark.surfaceLight, true: Colors.dark.accentDark }}
            thumbColor={aiEnhance ? Colors.dark.accent : Colors.dark.textTertiary}
          />
        </View>
        */}

        <Text style={styles.sectionLabel}>BEAT SYNC</Text>
        <View style={styles.aiCard}>
          <View style={styles.aiCardLeft}>
            <AudioLines size={20} color={Colors.dark.accent} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>Auto beat-sync</Text>
            <Text style={styles.aiSubtitle}>
              Clips will automatically cut and transition in rhythm with the music beat
            </Text>
            {musicMode !== 'none' && selectedTrack && (
              <Text style={styles.aiEstimate}>{selectedTrack.bpm} BPM · Cuts every {Math.round(60 / selectedTrack.bpm * 4 * 10) / 10}s</Text>
            )}
            {musicMode === 'ai-generated' && (
              <Text style={styles.aiEstimate}>AI music will be generated with a matching BPM</Text>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      <View style={styles.bottomArea}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity onPress={handleGenerate} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.dark.accent, Colors.dark.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.generateButton}
            >
              <Sparkles size={20} color="#fff" strokeWidth={2} />
              <Text style={styles.generateText}>Create Montage</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <MusicBrowser
        visible={musicBrowserVisible}
        onClose={() => setMusicBrowserVisible(false)}
        onSelect={setSelectedTrack}
        selectedTrack={selectedTrack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  photoCountBanner: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  photoCountText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.dark.textTertiary,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  musicIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicInfo: {
    flex: 1,
  },
  musicTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  musicArtist: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  styleRow: {
    gap: 12,
    paddingBottom: 4,
    marginBottom: 24,
  },
  styleCard: {
    width: 130,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  styleCardActive: {
    borderColor: Colors.dark.accent,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  styleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  styleIconCircleActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  styleCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  styleCardTitleActive: {
    color: Colors.dark.accent,
  },
  styleCardDesc: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    lineHeight: 15,
  },
  durationRow: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 8,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: Colors.dark.accent,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.dark.textTertiary,
  },
  durationTextActive: {
    color: '#fff',
  },
  durationNote: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 6,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    marginBottom: 8,
  },
  aiCardLeft: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  aiSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 17,
  },
  aiEstimate: {
    fontSize: 12,
    color: Colors.dark.secondary,
    fontWeight: '600' as const,
    marginTop: 6,
  },
  kenBurnsNote: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginBottom: 24,
  },
  musicModeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  musicModeCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  musicModeCardActive: {
    borderColor: Colors.dark.accent,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  musicModeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  musicModeIconActive: {
    backgroundColor: Colors.dark.accent,
  },
  musicModeTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  musicModeTitleActive: {
    color: Colors.dark.accent,
  },
  musicModeDesc: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  aiMusicNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  aiMusicNoteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.secondary,
    lineHeight: 17,
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 0.5,
    borderTopColor: Colors.dark.cardBorder,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    gap: 8,
  },
  generateText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: -0.3,
  },
});

const musicStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.textTertiary,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: Colors.dark.text,
  },
  chips: {
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
  },
  chipActive: {
    backgroundColor: Colors.dark.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
  },
  noMusicButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark.separator,
    marginBottom: 8,
  },
  noMusicText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark.separator,
  },
  trackRowSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  trackArtist: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  trackDuration: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    fontWeight: '500' as const,
  },
  bpmBadge: {
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bpmText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.dark.textSecondary,
  },
});
