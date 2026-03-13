import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { JobStatus, MontageStyle, MusicMode, PhotoItem, TargetDuration } from '@/types';
import { resolvePhUri } from '@/services/video-cache';
import { isSupabaseConfigured, supabase } from '@/services/supabase';

const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL?.trim() ?? '').replace(/\/+$/, '');
const MEDIA_UPLOAD_BUCKET = 'media-uploads';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory || ''}montage/`;
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_SIZE_LABEL = '50MB';
const FRIENDLY_BACKEND_ERROR = 'Could not reach the montage server. Please check your connection and try again.';
const MISSING_API_ERROR = 'The montage API was not found at the configured server. Please verify the backend URL and try again.';

export const isBackendConfigured = Boolean(BACKEND_URL);

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
  if (!isBackendConfigured) {
    console.warn('[BackendAPI] Missing EXPO_PUBLIC_BACKEND_URL. DATABASE_URL is server-only and is not used by the Expo client.');
    throw new Error(FRIENDLY_BACKEND_ERROR);
  }
}

function buildBackendUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${normalizedPath}`;
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
  const normalized = trimmed?.toLowerCase() ?? '';

  if (!trimmed || normalized === 'network request failed' || normalized === 'failed to fetch') {
    return FRIENDLY_BACKEND_ERROR;
  }

  if (normalized.startsWith('<!doctype') || normalized.startsWith('<html') || normalized.includes('<html')) {
    return FRIENDLY_BACKEND_ERROR;
  }

  if (normalized.includes('not found') || normalized.includes('404')) {
    return MISSING_API_ERROR;
  }

  return trimmed;
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        detail?: string;
      };
      return sanitizeBackendMessage(payload.error ?? payload.message ?? payload.detail ?? null);
    }

    const text = await response.text();
    return sanitizeBackendMessage(text);
  } catch (error) {
    console.error('[BackendAPI] Failed to parse error response:', error);
    return FRIENDLY_BACKEND_ERROR;
  }
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

export class FileTooLargeError extends Error {
  constructor(sizeBytes: number) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
    super(`This file is ${sizeMB}MB which exceeds the ${MAX_UPLOAD_SIZE_LABEL} upload limit. Try a shorter or lower-resolution clip.`);
    this.name = 'FileTooLargeError';
  }
}

export async function uploadMediaToSupabase(uri: string, assetId: string): Promise<string> {
  assertSupabaseConfigured();

  console.log('[BackendAPI] Uploading media to Supabase:', { assetId, uri });

  const prepared = await prepareUploadAsset(uri, assetId);
  const fileBytes = await readUriAsUint8Array(prepared.uploadUri);
  const storagePath = `uploads/${Date.now()}_${randomId()}.${prepared.extension}`;

  console.log('[BackendAPI] Upload path:', storagePath, 'bytes:', fileBytes.byteLength);

  if (fileBytes.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    console.warn('[BackendAPI] File too large:', fileBytes.byteLength, 'bytes, limit:', MAX_UPLOAD_SIZE_BYTES);
    throw new FileTooLargeError(fileBytes.byteLength);
  }

  return uploadToSupabase(storagePath, fileBytes, prepared.contentType);
}

export async function createMontageJob(params: CreateMontageJobParams): Promise<CreateMontageJobResult> {
  assertBackendConfigured();

  console.log('[BackendAPI] Creating montage job:', {
    backendUrl: BACKEND_URL,
    params,
  });

  try {
    const response = await fetch(buildBackendUrl('/api/montages'), {
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
      const errorMessage = await readErrorMessage(response);
      console.error('[BackendAPI] Create job failed:', response.status, errorMessage);
      throw new Error(errorMessage);
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

  console.log('[BackendAPI] Polling montage job status:', {
    backendUrl: BACKEND_URL,
    jobId,
  });

  try {
    const response = await fetch(buildBackendUrl(`/api/montages/${jobId}/status`), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      console.error('[BackendAPI] Poll job failed:', response.status, errorMessage);
      throw new Error(errorMessage);
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

  try {
    await ensureDownloadDirectory();
    const destination = `${DOWNLOAD_DIR}${Date.now()}_${randomId()}.mp4`;
    const result = await FileSystem.downloadAsync(url, destination);

    if (result.status !== 200) {
      console.error('[BackendAPI] Download failed with status:', result.status);
      throw new Error('Failed to download the final montage');
    }

    console.log('[BackendAPI] Downloaded final montage to:', result.uri);
    return result.uri;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download the final montage';
    throw new Error(sanitizeBackendMessage(message));
  }
}

export { FRIENDLY_BACKEND_ERROR };
