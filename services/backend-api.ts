import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { JobStatus, MontageStyle, MusicMode, PhotoItem, TargetDuration } from '@/types';
import { resolvePhUri } from '@/services/video-cache';
import { isSupabaseConfigured, supabase } from '@/services/supabase';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
const MEDIA_UPLOAD_BUCKET = 'media-uploads';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory || ''}montage/`;
const FRIENDLY_BACKEND_ERROR = 'Could not reach the montage server. Please check your connection and try again.';

export interface UploadedMontageMedia {
  url: string;
  type: PhotoItem['type'];
  duration: number | null;
}

export interface CreateMontageJobParams {
  mediaItems: UploadedMontageMedia[];
  musicMode: MusicMode;
  musicTrackUrl: string | null;
  musicBpm: number | null;
  style: MontageStyle;
  targetDuration: TargetDuration;
  aiEnhance: boolean;
}

export interface CreateMontageJobResult {
  jobId: string;
  estimatedSeconds: number;
}

interface UploadPreparationResult {
  uploadUri: string;
  extension: string;
  contentType: string;
}

interface MontageJobCreateResponse {
  job_id: string;
  estimated_seconds: number;
}

interface AssetMetadata {
  filename?: string;
  mediaType?: MediaLibrary.MediaTypeValue;
}

function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_KEY to continue.');
  }
}

function assertBackendConfigured(): void {
  if (!BACKEND_URL) {
    throw new Error(FRIENDLY_BACKEND_ERROR);
  }
}

function getMimeTypeFromExtension(extension: string, mediaType: PhotoItem['type']): string {
  const normalized = extension.toLowerCase();

  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'png') return 'image/png';
  if (normalized === 'webp') return 'image/webp';
  if (normalized === 'heic' || normalized === 'heif') return 'image/heic';
  if (normalized === 'mp4') return 'video/mp4';
  if (normalized === 'mov') return 'video/quicktime';
  if (normalized === 'm4v') return 'video/x-m4v';

  return mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';
}

function getExtensionFromFilename(filename?: string | null): string {
  if (!filename) {
    return '';
  }

  const parts = filename.split('.');
  if (parts.length < 2) {
    return '';
  }

  return parts[parts.length - 1].toLowerCase();
}

function getExtensionFromUri(uri: string): string {
  const cleanUri = uri.split('?')[0]?.split('#')[0] ?? uri;
  const fileName = cleanUri.split('/').pop() ?? '';
  return getExtensionFromFilename(fileName);
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function sanitizeBackendMessage(message?: string | null): string {
  const trimmed = message?.trim();
  return trimmed || FRIENDLY_BACKEND_ERROR;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  const outputLength = Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
  const bytes = new Uint8Array(outputLength);

  let byteIndex = 0;

  for (let index = 0; index < cleaned.length; index += 4) {
    const encoded1 = chars.indexOf(cleaned[index] ?? 'A');
    const encoded2 = chars.indexOf(cleaned[index + 1] ?? 'A');
    const encoded3Char = cleaned[index + 2] ?? '=';
    const encoded4Char = cleaned[index + 3] ?? '=';
    const encoded3 = encoded3Char === '=' ? 64 : chars.indexOf(encoded3Char);
    const encoded4 = encoded4Char === '=' ? 64 : chars.indexOf(encoded4Char);

    const chunk = (encoded1 << 18) | (encoded2 << 12) | ((encoded3 & 63) << 6) | (encoded4 & 63);

    if (byteIndex < outputLength) {
      bytes[byteIndex] = (chunk >> 16) & 255;
      byteIndex += 1;
    }
    if (encoded3 !== 64 && byteIndex < outputLength) {
      bytes[byteIndex] = (chunk >> 8) & 255;
      byteIndex += 1;
    }
    if (encoded4 !== 64 && byteIndex < outputLength) {
      bytes[byteIndex] = chunk & 255;
      byteIndex += 1;
    }
  }

  return bytes;
}

async function ensureDownloadDirectory(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

async function fetchAssetMetadata(assetId: string): Promise<AssetMetadata> {
  if (!assetId || Platform.OS === 'web') {
    return {};
  }

  try {
    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
    return {
      filename: assetInfo.filename,
      mediaType: assetInfo.mediaType,
    };
  } catch (error) {
    console.warn('[BackendAPI] Could not read asset metadata for', assetId, error);
    return {};
  }
}

async function convertPhotoToJpeg(localUri: string): Promise<string> {
  console.log('[BackendAPI] Converting HEIC photo to JPEG:', localUri);
  const manipulated = await ImageManipulator.manipulateAsync(localUri, [], {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  console.log('[BackendAPI] Converted photo to JPEG:', manipulated.uri);
  return manipulated.uri;
}

async function prepareUploadAsset(uri: string, assetId: string): Promise<UploadPreparationResult> {
  const resolvedUri = await resolvePhUri(uri);
  const metadata = await fetchAssetMetadata(assetId);
  const detectedExtension = getExtensionFromFilename(metadata.filename) || getExtensionFromUri(resolvedUri);
  const mediaType: PhotoItem['type'] = metadata.mediaType === 'video' ? 'video' : detectedExtension === 'mp4' || detectedExtension === 'mov' || detectedExtension === 'm4v' ? 'video' : 'photo';

  let uploadUri = resolvedUri;
  let extension = detectedExtension || (mediaType === 'photo' ? 'jpg' : 'mp4');

  if (mediaType === 'photo' && (extension === 'heic' || extension === 'heif')) {
    uploadUri = await convertPhotoToJpeg(resolvedUri);
    extension = 'jpg';
  }

  const contentType = getMimeTypeFromExtension(extension, mediaType);

  console.log('[BackendAPI] Prepared upload asset:', {
    assetId,
    originalUri: uri,
    resolvedUri,
    uploadUri,
    extension,
    contentType,
    mediaType,
  });

  return {
    uploadUri,
    extension,
    contentType,
  };
}

async function readUriAsUint8Array(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote media: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const base64Data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return base64ToUint8Array(base64Data);
}

async function uploadToSupabase(path: string, data: Uint8Array, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from(MEDIA_UPLOAD_BUCKET).upload(path, data, {
    contentType,
    upsert: false,
  });

  if (error) {
    console.error('[BackendAPI] Supabase upload error:', error);
    throw new Error(error.message || 'Failed to upload media');
  }

  const publicUrlResult = supabase.storage.from(MEDIA_UPLOAD_BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlResult.data.publicUrl;

  if (!publicUrl) {
    throw new Error('Failed to get uploaded media URL');
  }

  console.log('[BackendAPI] Supabase upload complete:', publicUrl);
  return publicUrl;
}

export async function uploadMediaToSupabase(uri: string, assetId: string): Promise<string> {
  assertSupabaseConfigured();

  console.log('[BackendAPI] Uploading media to Supabase:', { assetId, uri });

  const prepared = await prepareUploadAsset(uri, assetId);
  const fileBytes = await readUriAsUint8Array(prepared.uploadUri);
  const storagePath = `uploads/${Date.now()}_${randomId()}.${prepared.extension}`;

  console.log('[BackendAPI] Upload path:', storagePath, 'bytes:', fileBytes.byteLength);
  return uploadToSupabase(storagePath, fileBytes, prepared.contentType);
}

export async function createMontageJob(params: CreateMontageJobParams): Promise<CreateMontageJobResult> {
  assertBackendConfigured();

  console.log('[BackendAPI] Creating montage job:', params);

  try {
    const response = await fetch(`${BACKEND_URL}/api/montages`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_items: params.mediaItems.map((item) => ({
          url: item.url,
          type: item.type,
          duration: item.duration,
        })),
        music_mode: params.musicMode,
        music_track_url: params.musicTrackUrl,
        music_bpm: params.musicBpm,
        style: params.style,
        target_duration: params.targetDuration,
        ai_enhance: params.aiEnhance,
        i2v_model: 'minimax',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BackendAPI] Create job failed:', response.status, errorText);
      throw new Error(sanitizeBackendMessage(errorText));
    }

    const data = (await response.json()) as MontageJobCreateResponse;
    console.log('[BackendAPI] Montage job created:', data);

    return {
      jobId: data.job_id,
      estimatedSeconds: data.estimated_seconds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : FRIENDLY_BACKEND_ERROR;
    if (message === FRIENDLY_BACKEND_ERROR) {
      throw new Error(message);
    }
    throw new Error(sanitizeBackendMessage(message));
  }
}

export async function pollJobStatus(jobId: string): Promise<JobStatus> {
  assertBackendConfigured();

  console.log('[BackendAPI] Polling montage job:', jobId);

  try {
    const response = await fetch(`${BACKEND_URL}/api/montages/${jobId}/status`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BackendAPI] Poll job failed:', response.status, errorText);
      throw new Error(sanitizeBackendMessage(errorText));
    }

    const data = (await response.json()) as JobStatus;
    console.log('[BackendAPI] Job status response:', data);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : FRIENDLY_BACKEND_ERROR;
    if (message === FRIENDLY_BACKEND_ERROR) {
      throw new Error(message);
    }
    throw new Error(sanitizeBackendMessage(message));
  }
}

export async function downloadVideo(url: string): Promise<string> {
  console.log('[BackendAPI] Downloading final montage:', url);

  if (Platform.OS === 'web') {
    return url;
  }

  await ensureDownloadDirectory();
  const destination = `${DOWNLOAD_DIR}${Date.now()}_${randomId()}.mp4`;
  const result = await FileSystem.downloadAsync(url, destination);

  if (result.status !== 200) {
    console.error('[BackendAPI] Download failed with status:', result.status);
    throw new Error('Failed to download the final montage');
  }

  console.log('[BackendAPI] Downloaded final montage to:', result.uri);
  return result.uri;
}

export { FRIENDLY_BACKEND_ERROR };
