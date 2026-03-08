import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Sparkles, AudioLines, Share2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { usePhotoLibrary } from '@/contexts/PhotoLibraryContext';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradientColors: [string, string, string];
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Your photos,\nbrought to life',
    subtitle: 'Transform still moments into cinematic motion',
    icon: <Sparkles size={48} color="#F59E0B" strokeWidth={1.5} />,
    gradientColors: ['#1a0a2e', '#0f0525', '#0A0A0A'],
  },
  {
    id: '2',
    title: 'Beat-synced,\nautomatically',
    subtitle: 'Every cut lands perfectly on the rhythm',
    icon: <AudioLines size={48} color="#8B5CF6" strokeWidth={1.5} />,
    gradientColors: ['#0a1628', '#070e1a', '#0A0A0A'],
  },
  {
    id: '3',
    title: 'Ready for\nTikTok & Reels',
    subtitle: 'Export and share in one tap',
    icon: <Share2 size={48} color="#34D399" strokeWidth={1.5} />,
    gradientColors: ['#0a1e1a', '#06120f', '#0A0A0A'],
  },
];

function ShimmerAnimation() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  return (
    <View style={shimmerStyles.container}>
      <View style={shimmerStyles.photoFrame}>
        <LinearGradient
          colors={['#1C1C1E', '#2A2A2A', '#1C1C1E']}
          style={shimmerStyles.photoInner}
        >
          <Animated.View
            style={[
              shimmerStyles.shimmerBar,
              { transform: [{ translateX }] },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(139, 92, 246, 0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </LinearGradient>
      </View>
    </View>
  );
}

function WaveformAnimation() {
  const bars = useRef(
    Array.from({ length: 24 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: Math.random() * 0.7 + 0.3,
            duration: 300 + Math.random() * 400,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.2,
            duration: 300 + Math.random() * 400,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={waveStyles.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            waveStyles.bar,
            {
              backgroundColor: i % 3 === 0 ? '#8B5CF6' : i % 3 === 1 ? '#A78BFA' : '#F59E0B',
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function PhoneMockup() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[phoneStyles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={phoneStyles.phone}>
        <View style={phoneStyles.notch} />
        <LinearGradient
          colors={['#1a0a2e', '#0f0525']}
          style={phoneStyles.screen}
        >
          <View style={phoneStyles.playButton}>
            <View style={phoneStyles.playTriangle} />
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useApp();
  const { requestPermission, loadInitialPhotos } = usePhotoLibrary();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleNext = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  }, [currentIndex]);

  const handleGetStarted = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      console.log('[Onboarding] Requesting photo library permission...');
      const result = await requestPermission();
      console.log('[Onboarding] Permission result:', result);
      if (result === 'granted' || result === 'limited') {
        await loadInitialPhotos();
      }
      completeOnboarding();
      router.replace('/(tabs)/(create)' as any);
    });
  }, [requestPermission, loadInitialPhotos, completeOnboarding]);

  const handleSkip = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    completeOnboarding();
    router.replace('/(tabs)/(create)' as any);
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderVisual = (index: number) => {
    switch (index) {
      case 0:
        return <ShimmerAnimation />;
      case 1:
        return <WaveformAnimation />;
      case 2:
        return <PhoneMockup />;
      default:
        return null;
    }
  };

  const renderItem = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={[styles.slide, { width }]}>
      <LinearGradient
        colors={item.gradientColors}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.visualContainer}>
        {renderVisual(index)}
      </View>
      <View style={styles.iconCircle}>
        {item.icon}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        {!isLastSlide && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        scrollEventThrottle={16}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: Colors.dark.accent,
                  },
                ]}
              />
            );
          })}
        </View>

        {isLastSlide ? (
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.dark.accent, Colors.dark.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.getStartedButton}
              >
                <Text style={styles.getStartedText}>Get Started</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextButton}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  visualContainer: {
    height: 200,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 28,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  getStartedButton: {
    width: width - 48,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  nextButton: {
    width: width - 48,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  nextText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '600' as const,
  },
});

const shimmerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFrame: {
    width: 180,
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  photoInner: {
    flex: 1,
    overflow: 'hidden',
  },
  shimmerBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    left: '50%',
    marginLeft: -40,
  },
});

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    gap: 3,
  },
  bar: {
    width: 4,
    height: 80,
    borderRadius: 2,
  },
});

const phoneStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 140,
    height: 200,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3A3A3C',
    backgroundColor: '#000',
    overflow: 'hidden',
    alignItems: 'center',
  },
  notch: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3A3A3C',
    marginTop: 8,
  },
  screen: {
    flex: 1,
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftColor: '#8B5CF6',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
});
