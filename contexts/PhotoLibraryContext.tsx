import { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import createContextHook from '@nkzw/create-context-hook';
import { PhotoItem, SmartCollection } from '@/types';
import { allPhotos as mockPhotos, smartCollections as mockCollections } from '@/mocks/photos';

const PAGE_SIZE = 100;

type MLAsset = MediaLibrary.Asset;

interface AssetWithLocation extends MLAsset {
  locationData?: { latitude: number; longitude: number } | null;
}

function assetToPhotoItem(asset: AssetWithLocation): PhotoItem {
  const date = new Date(asset.creationTime);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  let locationName: string | undefined;
  if (asset.locationData) {
    const lat = asset.locationData.latitude;
    const lon = asset.locationData.longitude;
    if (lat !== undefined && lon !== undefined && (lat !== 0 || lon !== 0)) {
      locationName = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    }
  }

  return {
    id: asset.id,
    uri: asset.uri,
    type: asset.mediaType === 'video' ? 'video' : 'photo',
    date: dateStr,
    duration: asset.duration > 0 ? Math.round(asset.duration) : undefined,
    isFavorite: false,
    location: locationName,
  };
}

function groupByDate(photos: PhotoItem[]): Map<string, PhotoItem[]> {
  const groups = new Map<string, PhotoItem[]>();
  for (const photo of photos) {
    const existing = groups.get(photo.date) || [];
    existing.push(photo);
    groups.set(photo.date, existing);
  }
  return groups;
}

function mergeUniquePhotoItems(existing: PhotoItem[], incoming: PhotoItem[]): PhotoItem[] {
  const merged = new Map<string, PhotoItem>();

  existing.forEach((item) => {
    merged.set(item.id, item);
  });

  incoming.forEach((item) => {
    merged.set(item.id, item);
  });

  return Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function groupByLocation(photos: PhotoItem[]): Map<string, PhotoItem[]> {
  const groups = new Map<string, PhotoItem[]>();
  for (const photo of photos) {
    if (photo.location) {
      const existing = groups.get(photo.location) || [];
      existing.push(photo);
      groups.set(photo.location, existing);
    }
  }
  return groups;
}

export const [PhotoLibraryProvider, usePhotoLibrary] = createContextHook(() => {
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'limited' | 'denied'>('undetermined');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [totalCount, setTotalCount] = useState<number>(0);

  const isWeb = Platform.OS === 'web';

  const checkPermission = useCallback(async () => {
    if (isWeb) {
      setPermissionStatus('granted');
      setPhotos(mockPhotos);
      setTotalCount(mockPhotos.length);
      setHasMore(false);
      return 'granted';
    }

    try {
      const { status, accessPrivileges } = await MediaLibrary.getPermissionsAsync();
      console.log('[PhotoLibrary] Permission check:', status, accessPrivileges);

      if (status === 'granted') {
        const mapped = accessPrivileges === 'limited' ? 'limited' : 'granted';
        setPermissionStatus(mapped);
        return mapped;
      } else if (status === 'denied') {
        setPermissionStatus('denied');
        return 'denied';
      }
      setPermissionStatus('undetermined');
      return 'undetermined';
    } catch (error) {
      console.error('[PhotoLibrary] Error checking permission:', error);
      setPermissionStatus('undetermined');
      return 'undetermined';
    }
  }, [isWeb]);

  const requestPermission = useCallback(async () => {
    if (isWeb) {
      setPermissionStatus('granted');
      setPhotos(mockPhotos);
      setTotalCount(mockPhotos.length);
      setHasMore(false);
      return 'granted';
    }

    try {
      console.log('[PhotoLibrary] Requesting permission...');
      const { status, accessPrivileges } = await MediaLibrary.requestPermissionsAsync();
      console.log('[PhotoLibrary] Permission result:', status, accessPrivileges);

      if (status === 'granted') {
        const mapped = accessPrivileges === 'limited' ? 'limited' : 'granted';
        setPermissionStatus(mapped);
        return mapped;
      }
      setPermissionStatus('denied');
      return 'denied';
    } catch (error) {
      console.error('[PhotoLibrary] Error requesting permission:', error);
      setPermissionStatus('denied');
      return 'denied';
    }
  }, [isWeb]);

  const fetchLocationData = useCallback(async (assets: MLAsset[]) => {
    try {
      const BATCH_SIZE = 5;
      const updatedItems: PhotoItem[] = [];

      for (let i = 0; i < assets.length; i += BATCH_SIZE) {
        const batch = assets.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (asset) => {
            try {
              const info = await MediaLibrary.getAssetInfoAsync(asset);
              return assetToPhotoItem({ ...asset, locationData: info.location ?? null } as AssetWithLocation);
            } catch {
              return assetToPhotoItem({ ...asset, locationData: null } as AssetWithLocation);
            }
          })
        );
        updatedItems.push(...results);
      }

      if (updatedItems.length > 0) {
        setPhotos(prev => {
          const updatedMap = new Map(updatedItems.map(item => [item.id, item]));
          return prev.map(p => updatedMap.get(p.id) ?? p);
        });
        console.log('[PhotoLibrary] Location data updated for', updatedItems.length, 'assets');
      }
    } catch (error) {
      console.warn('[PhotoLibrary] Error fetching location data (non-fatal):', error);
    }
  }, []);

  const fetchPhotos = useCallback(async (reset = false) => {
    if (isWeb) {
      setPhotos(mockPhotos);
      return;
    }

    if (isLoading) return;
    if (!reset && !hasMore) return;

    setIsLoading(true);
    console.log('[PhotoLibrary] Fetching photos, reset:', reset);

    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after: reset ? undefined : endCursor,
        mediaType: [MediaLibrary.MediaType.video],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      console.log('[PhotoLibrary] Fetched', result.assets.length, 'video assets, total:', result.totalCount);

      const items = result.assets.map((asset) => assetToPhotoItem({ ...asset, locationData: null } as AssetWithLocation));

      if (reset) {
        setPhotos(mergeUniquePhotoItems([], items));
      } else {
        setPhotos((prev) => mergeUniquePhotoItems(prev, items));
      }

      setEndCursor(result.endCursor);
      setHasMore(result.hasNextPage);
      setTotalCount(result.totalCount);

      void fetchLocationData(result.assets);
    } catch (error) {
      console.error('[PhotoLibrary] Error fetching photos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isWeb, isLoading, hasMore, endCursor, fetchLocationData]);

  const loadInitialPhotos = useCallback(async () => {
    if (isWeb) {
      setPhotos(mockPhotos);
      setTotalCount(mockPhotos.length);
      setHasMore(false);
      return;
    }

    const perm = await checkPermission();
    if (perm === 'granted' || perm === 'limited') {
      await fetchPhotos(true);
    }
  }, [isWeb, checkPermission, fetchPhotos]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && !isWeb) {
      void fetchPhotos(false);
    }
  }, [isLoading, hasMore, isWeb, fetchPhotos]);

  const getSmartCollections = useCallback((): SmartCollection[] => {
    if (isWeb || photos.length === 0) {
      return mockCollections;
    }

    const collections: SmartCollection[] = [];

    const videos = photos.filter(p => p.type === 'video');
    if (videos.length >= 2) {
      collections.push({
        id: 'videos',
        name: 'Videos',
        icon: 'Video',
        photos: videos.slice(0, 6),
      });
    }

    const locationGroups = groupByLocation(photos);
    const sortedLocations = Array.from(locationGroups.entries())
      .sort(([, a], [, b]) => b.length - a.length);

    for (const [loc, locPhotos] of sortedLocations.slice(0, 3)) {
      if (locPhotos.length >= 2) {
        const sorted = [...locPhotos].sort((a, b) => {
          if (a.type === 'video' && b.type !== 'video') return -1;
          if (a.type !== 'video' && b.type === 'video') return 1;
          return b.date.localeCompare(a.date);
        });
        collections.push({
          id: `loc-${loc}`,
          name: loc,
          icon: 'MapPin',
          photos: sorted.slice(0, 6),
        });
      }
    }

    const dateGroups = groupByDate(photos);
    const sortedDates = Array.from(dateGroups.entries())
      .sort(([a], [b]) => b.localeCompare(a));

    for (const [date, datePhotos] of sortedDates.slice(0, 2)) {
      if (datePhotos.length >= 3) {
        const sorted = [...datePhotos].sort((a, b) => {
          if (a.type === 'video' && b.type !== 'video') return -1;
          if (a.type !== 'video' && b.type === 'video') return 1;
          return 0;
        });
        const d = new Date(date);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        collections.push({
          id: `date-${date}`,
          name: label,
          icon: 'Calendar',
          photos: sorted.slice(0, 6),
        });
      }
    }

    const recent = [...photos].sort((a, b) => {
      if (a.type === 'video' && b.type !== 'video') return -1;
      if (a.type !== 'video' && b.type === 'video') return 1;
      return b.date.localeCompare(a.date);
    }).slice(0, 6);

    if (recent.length > 0) {
      collections.push({
        id: 'recent',
        name: 'Recent',
        icon: 'Clock',
        photos: recent,
      });
    }

    return collections.length > 0 ? collections : mockCollections;
  }, [photos, isWeb]);

  return useMemo(() => ({
    permissionStatus,
    photos,
    isLoading,
    hasMore,
    totalCount,
    checkPermission,
    requestPermission,
    loadInitialPhotos,
    loadMore,
    getSmartCollections,
  }), [
    permissionStatus,
    photos,
    isLoading,
    hasMore,
    totalCount,
    checkPermission,
    requestPermission,
    loadInitialPhotos,
    loadMore,
    getSmartCollections,
  ]);
});
