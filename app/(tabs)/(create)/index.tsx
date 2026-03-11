import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Sparkles, Heart, Calendar, MapPin, Star, Grid3x3, ChevronRight, ImageIcon, Video, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePhotoLibrary } from '@/contexts/PhotoLibraryContext';
import { SmartCollection } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = 130;

function GradientBorderCard() {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[heroStyles.glowCircle, { transform: [{ rotate }] }]}>
      <LinearGradient
        colors={['#8B5CF6', '#F59E0B', '#8B5CF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const iconMap: Record<string, React.ReactNode> = {
  Heart: <Heart size={14} color={Colors.dark.accent} strokeWidth={2} />,
  Calendar: <Calendar size={14} color={Colors.dark.secondary} strokeWidth={2} />,
  MapPin: <MapPin size={14} color="#34D399" strokeWidth={2} />,
  Star: <Star size={14} color={Colors.dark.secondary} strokeWidth={2} />,
  Video: <Video size={14} color="#60A5FA" strokeWidth={2} />,
  Clock: <Clock size={14} color={Colors.dark.secondary} strokeWidth={2} />,
};

function CollectionCard({ collection, onPress }: { collection: SmartCollection; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const previews = collection.photos.slice(0, 4);
  const videoCount = collection.photos.filter(p => p.type === 'video').length;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={collectionStyles.card}
      >
        <View style={collectionStyles.grid}>
          {previews.map((photo, idx) => (
            <Image
              key={photo.id}
              source={{ uri: photo.uri }}
              style={[
                collectionStyles.thumbnail,
                idx === 0 && collectionStyles.topLeft,
                idx === 1 && collectionStyles.topRight,
                idx === 2 && collectionStyles.bottomLeft,
                idx === 3 && collectionStyles.bottomRight,
              ]}
              contentFit="cover"
            />
          ))}
        </View>
        <View style={collectionStyles.info}>
          {iconMap[collection.icon]}
          <Text style={collectionStyles.name} numberOfLines={1}>{collection.name}</Text>
          <Text style={collectionStyles.count}>{collection.photos.length}</Text>
        </View>
        {videoCount > 0 && (
          <View style={collectionStyles.videoBadge}>
            <Video size={10} color="#60A5FA" strokeWidth={2.5} />
            <Text style={collectionStyles.videoBadgeText}>{videoCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { permissionStatus, photos, loadInitialPhotos, requestPermission, smartCollections } = usePhotoLibrary();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (permissionStatus === 'granted' || permissionStatus === 'limited') {
      if (photos.length === 0) {
        void loadInitialPhotos();
      }
    }
  }, [loadInitialPhotos, permissionStatus, photos.length]);

  const handleRequestPermission = useCallback(async () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const result = await requestPermission();
    if (result === 'granted' || result === 'limited') {
      await loadInitialPhotos();
    } else if (result === 'denied') {
      if (Platform.OS !== 'web') {
        void Linking.openSettings();
      }
    }
  }, [loadInitialPhotos, requestPermission]);

  const handleCollectionPress = useCallback((collection: SmartCollection) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({
      pathname: '/editor-setup',
      params: { collectionId: collection.id, collectionName: collection.name },
    });
  }, [router]);

  const handleBrowseAll = useCallback(async () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (permissionStatus === 'denied' || permissionStatus === 'undetermined') {
      await handleRequestPermission();
      return;
    }
    router.push('/select-photos');
  }, [handleRequestPermission, permissionStatus, router]);

  const handleHeroPress = useCallback(async () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (permissionStatus === 'denied' || permissionStatus === 'undetermined') {
      await handleRequestPermission();
      return;
    }
    router.push('/select-photos');
  }, [handleRequestPermission, permissionStatus, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Montage</Text>
            <Text style={styles.headerSubtitle}>Create something beautiful</Text>
          </View>

          <TouchableOpacity
            onPress={handleHeroPress}
            activeOpacity={0.9}
            style={heroStyles.container}
          >
            <View style={heroStyles.glowWrapper}>
              <GradientBorderCard />
            </View>
            <LinearGradient
              colors={['#1a1025', '#141414']}
              style={heroStyles.card}
            >
              <View style={heroStyles.iconRow}>
                <View style={heroStyles.iconCircle}>
                  <Sparkles size={28} color={Colors.dark.accent} strokeWidth={1.5} />
                </View>
              </View>
              <Text style={heroStyles.title}>Create a New Montage</Text>
              <Text style={heroStyles.subtitle}>{"Select your photos and videos and we'll turn them into a beat-synced montage"}</Text>
              <View style={heroStyles.ctaRow}>
                <Text style={heroStyles.ctaText}>Get started</Text>
                <ChevronRight size={18} color={Colors.dark.accent} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {(permissionStatus === 'denied' || permissionStatus === 'undetermined') && Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={handleRequestPermission}
              activeOpacity={0.8}
              style={styles.permissionBanner}
            >
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.12)', 'rgba(139, 92, 246, 0.04)']}
                style={styles.permissionGradient}
              >
                <View style={styles.permissionIconCircle}>
                  <ImageIcon size={22} color={Colors.dark.accent} strokeWidth={1.5} />
                </View>
                <View style={styles.permissionTextContainer}>
                  <Text style={styles.permissionTitle}>
                    {permissionStatus === 'denied' ? 'Photo Access Required' : 'Access Your Photos'}
                  </Text>
                  <Text style={styles.permissionBody}>
                    {permissionStatus === 'denied'
                      ? 'Open Settings to allow Montage to access your photo library.'
                      : 'Tap to allow Montage to access your photos and create montages.'}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.dark.textTertiary} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Smart Collections</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.collectionsRow}
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + 10}
          >
            {smartCollections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onPress={() => handleCollectionPress(collection)}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={handleBrowseAll}
            activeOpacity={0.8}
            style={styles.browseButton}
          >
            <Grid3x3 size={20} color={Colors.dark.accent} strokeWidth={1.5} />
            <Text style={styles.browseText}>Browse All Media</Text>
            <ChevronRight size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>

          <View style={styles.tipCard}>
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.08)', 'rgba(245, 158, 11, 0.02)']}
              style={styles.tipGradient}
            >
              <Text style={styles.tipEmoji}>💡</Text>
              <View style={styles.tipTextContainer}>
                <Text style={styles.tipTitle}>Pro tip</Text>
                <Text style={styles.tipBody}>{"4-10 items usually creates the best montage. Mix standout photos and short clips, and we'll sync the edit to your music's rhythm."}</Text>
              </View>
            </LinearGradient>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: Colors.dark.text,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  collectionsRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    gap: 12,
  },
  browseText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  tipCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
  },
  tipGradient: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  tipEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  tipTextContainer: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.secondary,
    marginBottom: 4,
  },
  tipBody: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  permissionBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  permissionGradient: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  permissionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  permissionBody: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
});

const heroStyles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  glowWrapper: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  glowCircle: {
    width: width,
    height: width,
    borderRadius: width / 2,
    overflow: 'hidden',
  },
  card: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  iconRow: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.accent,
  },
});

const collectionStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  grid: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 0.7,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  thumbnail: {
    width: '50%',
    height: '50%',
  },
  topLeft: {
    borderTopLeftRadius: 0,
  },
  topRight: {
    borderTopRightRadius: 0,
  },
  bottomLeft: {
    borderBottomLeftRadius: 0,
  },
  bottomRight: {
    borderBottomRightRadius: 0,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  name: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  count: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontWeight: '500' as const,
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  videoBadgeText: {
    fontSize: 10,
    color: '#60A5FA',
    fontWeight: '700' as const,
  },
});
