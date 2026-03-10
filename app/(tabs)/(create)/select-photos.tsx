import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Play } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePhotoLibrary } from '@/contexts/PhotoLibraryContext';
import { PhotoItem } from '@/types';

const { width } = Dimensions.get('window');
const GAP = 2;
const COLUMNS = 3;
const ITEM_SIZE = (width - GAP * (COLUMNS - 1)) / COLUMNS;

function PhotoCell({
  item,
  selectedIndex,
  onSelect,
}: {
  item: PhotoItem;
  selectedIndex: number;
  onSelect: (item: PhotoItem) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isSelected = selectedIndex > 0;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (!isSelected) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
    }
    onSelect(item);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={[gridStyles.cell, { transform: [{ scale: scaleAnim }] }]}>
        <Image source={{ uri: item.uri }} style={gridStyles.image} contentFit="cover" />

        {item.duration != null && item.duration > 0 && (
          <View style={gridStyles.durationBadge}>
            <Play size={10} color="#fff" fill="#fff" />
            <Text style={gridStyles.durationText}>
              {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
            </Text>
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)']}
          style={gridStyles.dateOverlay}
        >
          <Text style={gridStyles.dateText}>{item.date.slice(5)}</Text>
        </LinearGradient>

        {isSelected && (
          <View style={gridStyles.selectedOverlay}>
            <View style={gridStyles.checkBadge}>
              <Text style={gridStyles.checkNumber}>{selectedIndex}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function SelectPhotosScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const selectionLockRef = useRef<Record<string, boolean>>({});
  const { photos: libraryPhotos, loadMore, loadInitialPhotos } = usePhotoLibrary();

  React.useEffect(() => {
    if (libraryPhotos.length === 0) {
      void loadInitialPhotos();
    }
  }, [libraryPhotos.length, loadInitialPhotos]);

  const handleSelect = useCallback((item: PhotoItem) => {
    if (selectionLockRef.current[item.id]) {
      console.log('[SelectPhotos] Ignoring duplicate tap for item:', item.id);
      return;
    }

    selectionLockRef.current[item.id] = true;
    setTimeout(() => { selectionLockRef.current[item.id] = false; }, 300);

    setSelected((prev) => {
      const idx = prev.indexOf(item.id);
      let next: string[];
      if (idx > -1) {
        next = prev.filter((id) => id !== item.id);
      } else {
        if (prev.length >= 30) {
          return prev;
        }
        next = [...prev, item.id];
      }

      return next;
    });
  }, []);

  const navigatingRef = useRef(false);

  const handleContinue = useCallback(() => {
    console.log('[SelectPhotos] Continue pressed, selected count:', selected.length);
    if (selected.length < 1) {
      console.log('[SelectPhotos] No items selected, ignoring');
      return;
    }
    if (navigatingRef.current) {
      console.log('[SelectPhotos] Navigation already in progress, ignoring');
      return;
    }
    navigatingRef.current = true;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const ids = selected.join(',');
    console.log('[SelectPhotos] Navigating to editor-setup with ids:', ids);
    try {
      router.dismiss();
      setTimeout(() => {
        router.push({
          pathname: '/editor-setup',
          params: { selectedIds: ids },
        });
        console.log('[SelectPhotos] router.push called successfully');
      }, 100);
    } catch (error) {
      console.error('[SelectPhotos] Navigation error:', error);
    }
    setTimeout(() => { navigatingRef.current = false; }, 2000);
  }, [selected, router]);

  const renderItem = useCallback(({ item }: { item: PhotoItem }) => {
    const selectedIndex = selected.indexOf(item.id) + 1;
    return (
      <PhotoCell
        item={item}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
      />
    );
  }, [selected, handleSelect]);



  const showWarning = selected.length >= 20;

  const selectedPhotos = useMemo(() => {
    const photoMap = new Map(libraryPhotos.map((photo) => [photo.id, photo]));
    return selected
      .map((id) => photoMap.get(id))
      .filter((item): item is PhotoItem => Boolean(item));
  }, [libraryPhotos, selected]);

  return (
    <View style={styles.container}>
      <FlatList
        data={libraryPhotos}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: selected.length > 0 ? 120 : 20 }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />

      {showWarning && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>💡 Pro tip: 4-10 items usually makes the best montage</Text>
        </View>
      )}

      {selected.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInner}>
            <ScrollableSelected selectedPhotos={selectedPhotos} />
            <View style={styles.bottomBarActions}>
              <Text style={styles.countText}>{selected.length} selected</Text>
              <TouchableOpacity
                onPress={handleContinue}
                activeOpacity={0.8}
                disabled={selected.length < 1}
                style={styles.continueHitArea}
              >
                <LinearGradient
                  colors={selected.length >= 1 ? [Colors.dark.accent, Colors.dark.accentDark] : ['#333', '#333']}
                  style={styles.continueButton}
                >
                  <Text style={[styles.continueText, selected.length < 1 && { opacity: 0.5 }]}>
                    Continue
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function ScrollableSelected({ selectedPhotos }: { selectedPhotos: PhotoItem[] }) {
  if (selectedPhotos.length === 0) return null;

  return (
    <FlatList
      data={selectedPhotos}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={item => item.id}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}
      renderItem={({ item }) => (
        <Image source={{ uri: item.uri }} style={styles.selectedThumb} contentFit="cover" />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  warningBanner: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  warningText: {
    fontSize: 13,
    color: Colors.dark.secondary,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 10,
    pointerEvents: 'auto' as const,
  },
  bottomBarInner: {
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 34,
  },
  bottomBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  continueButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  continueHitArea: {
    zIndex: 10,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  selectedThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
});

const gridStyles = StyleSheet.create({
  cell: {
    width: ITEM_SIZE,
    height: ITEM_SIZE * 1.2,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 24,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  durationText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600' as const,
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    justifyContent: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  dateText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500' as const,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 2,
    borderColor: Colors.dark.accent,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 6,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkNumber: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
