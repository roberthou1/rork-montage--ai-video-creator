import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, Alert } from 'react-native';

const CACHE_DIR = `${FileSystem.cacheDirectory || ''}montage-clips/`;
const RESOLVED_DIR = `${FileSystem.cacheDirectory || ''}resolved-clips/`;

async function ensureCacheDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('[VideoCache] Error creating cache dir:', error);
  }
}

async function ensureResolvedDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(RESOLVED_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(RESOLVED_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('[VideoCache] Error creating resolved dir:', error);
  }
}

export async function resolvePhUri(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  if (!uri.startsWith('ph://') && !uri.startsWith('assets-library://')) return uri;

  try {
    const assetId = uri.replace('ph://', '').split('/')[0];
    console.log('[VideoCache] Resolving ph:// URI, assetId:', assetId);
    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);

    if (assetInfo?.localUri) {
      console.log('[VideoCache] Resolved to localUri:', assetInfo.localUri.substring(0, 80));
      return assetInfo.localUri;
    }

    console.warn('[VideoCache] No localUri found for asset, trying copy...');
    await ensureResolvedDir();
    const ext = assetInfo?.filename?.split('.').pop() || 'mov';
    const destPath = `${RESOLVED_DIR}resolved_${Date.now()}_${assetId}.${ext}`;
    try {
      await FileSystem.copyAsync({ from: uri, to: destPath });
      console.log('[VideoCache] Copied to:', destPath);
      return destPath;
    } catch (copyErr) {
      console.error('[VideoCache] Copy failed:', copyErr);
      return uri;
    }
  } catch (error) {
    console.error('[VideoCache] Error resolving ph:// URI:', error);
    return uri;
  }
}

export async function resolveAllUris(
  uris: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<string[]> {
  if (Platform.OS === 'web') return uris;

  console.log('[VideoCache] Resolving', uris.length, 'URIs to local files...');
  const resolved: string[] = [];
  for (let i = 0; i < uris.length; i++) {
    const localUri = await resolvePhUri(uris[i]);
    resolved.push(localUri);
    onProgress?.(i + 1, uris.length);
    console.log(`[VideoCache] Resolved ${i + 1}/${uris.length}:`, localUri.substring(0, 60));
  }
  return resolved;
}

export async function cacheVideoClip(remoteUrl: string, index: number): Promise<string> {
  if (Platform.OS === 'web') return remoteUrl;

  await ensureCacheDir();
  const filename = `clip_${Date.now()}_${index}.mp4`;
  const localPath = `${CACHE_DIR}${filename}`;

  console.log(`[VideoCache] Downloading clip ${index} from:`, remoteUrl.substring(0, 80));

  try {
    const result = await FileSystem.downloadAsync(remoteUrl, localPath);
    if (result.status === 200) {
      const info = await FileSystem.getInfoAsync(result.uri);
      console.log(`[VideoCache] Clip ${index} cached:`, result.uri, 'size:', (info as any).size || 'unknown');
      return result.uri;
    }
    console.error(`[VideoCache] Download failed with status ${result.status}`);
    return remoteUrl;
  } catch (error) {
    console.error(`[VideoCache] Error caching clip ${index}:`, error);
    return remoteUrl;
  }
}

export async function cacheAllClips(
  remoteUrls: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<string[]> {
  if (Platform.OS === 'web') return remoteUrls;

  console.log('[VideoCache] Caching', remoteUrls.length, 'clips locally...');
  const localPaths: string[] = [];
  for (let i = 0; i < remoteUrls.length; i++) {
    const localPath = await cacheVideoClip(remoteUrls[i], i);
    localPaths.push(localPath);
    onProgress?.(i + 1, remoteUrls.length);
  }
  console.log('[VideoCache] All clips cached. Local paths:', localPaths.length);
  return localPaths;
}

function getFileExtension(uri: string): string {
  const cleanUri = uri.split('?')[0].split('#')[0];
  const lastDot = cleanUri.lastIndexOf('.');
  if (lastDot >= 0) {
    const ext = cleanUri.substring(lastDot).toLowerCase();
    if (ext.length > 1 && ext.length <= 6) return ext;
  }
  return '';
}

async function ensureLocalFileWithExtension(uri: string): Promise<string> {
  await ensureCacheDir();

  if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
    console.log('[VideoCache] Resolving ph:// URI before export:', uri.substring(0, 60));
    const resolved = await resolvePhUri(uri);
    if (resolved !== uri) {
      return ensureLocalFileWithExtension(resolved);
    }
  }

  const ext = getFileExtension(uri) || '.mov';
  const destPath = `${CACHE_DIR}export_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    console.log('[VideoCache] Downloading for export:', uri.substring(0, 80));
    const result = await FileSystem.downloadAsync(uri, destPath);
    if (result.status !== 200) {
      throw new Error('Failed to download video for saving');
    }
    return result.uri;
  }

  if (uri.startsWith('file://')) {
    const existingExt = getFileExtension(uri);
    if (existingExt) {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        console.log('[VideoCache] File exists with extension, using directly:', uri.substring(0, 60));
        return uri;
      }
    }
    console.log('[VideoCache] Copying file to add extension:', uri.substring(0, 60));
    await FileSystem.copyAsync({ from: uri, to: destPath });
    return destPath;
  }

  return uri;
}

export async function saveClipToLibrary(uri: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && uri.startsWith('http')) {
        window.open(uri, '_blank');
      }
    } catch (e) {
      console.error('[VideoCache] Web save error:', e);
    }
    return true;
  }

  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant access to save videos to your photo library.');
      return false;
    }

    console.log('[VideoCache] Preparing URI for save:', uri.substring(0, 80));
    const localUri = await ensureLocalFileWithExtension(uri);
    console.log('[VideoCache] Final local URI for save:', localUri.substring(0, 80));

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      console.error('[VideoCache] File does not exist at:', localUri);
      throw new Error('Video file not found for saving');
    }
    console.log('[VideoCache] File size:', (fileInfo as any).size || 'unknown');

    const asset = await MediaLibrary.createAssetAsync(localUri);
    console.log('[VideoCache] Asset created:', asset.id, asset.uri?.substring(0, 60));
    return true;
  } catch (error) {
    console.error('[VideoCache] Error saving to library:', error);
    throw error;
  }
}

export async function saveAllClipsToLibrary(
  uris: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<boolean> {
  console.log('[VideoCache] Saving', uris.length, 'clips to library...');
  for (let i = 0; i < uris.length; i++) {
    const success = await saveClipToLibrary(uris[i]);
    if (!success) return false;
    onProgress?.(i + 1, uris.length);
  }
  console.log('[VideoCache] All clips saved to library');
  return true;
}
