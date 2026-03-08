import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { MontageStyle } from '@/types';

const IMAGE_EDIT_URL = 'https://toolkit.rork.com/images/edit/';

const STYLE_PROMPTS: Record<MontageStyle, string> = {
  dynamic: 'Transform this photo with dramatic cinematic motion blur, dynamic zoom effect, high contrast film look, and bold color grading. Make it feel like a still frame from an action film.',
  cinematic: 'Apply cinematic film treatment: warm golden color grading, shallow depth of field bokeh effect, subtle film grain, soft anamorphic lens flare. Make it look like a frame from a Hollywood movie.',
  energetic: 'Add vibrant high-saturation pop colors, dramatic hard lighting with strong shadows, subtle flash/strobe effect at edges. Make it feel electric and full of energy.',
  dreamy: 'Apply soft dreamy ethereal glow, pastel color toning with light pink and lavender hues, gentle light leaks, slightly hazy atmosphere. Make it feel like a romantic dream sequence.',
};

export interface EnhancementProgress {
  currentIndex: number;
  totalCount: number;
  step: 'converting' | 'enhancing' | 'saving';
  overallProgress: number;
}

export type ProgressCallback = (progress: EnhancementProgress) => void;

async function convertUriToBase64Native(uri: string, assetId: string): Promise<string> {
  try {
    console.log('[AI Enhancement] Converting native asset to base64:', assetId);

    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
    const localUri = assetInfo.localUri || assetInfo.uri;

    if (!localUri) {
      throw new Error('Could not get local URI for asset: ' + assetId);
    }

    console.log('[AI Enhancement] Local URI:', localUri);

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('[AI Enhancement] Converted to base64, length:', base64.length);
    return base64;
  } catch (error) {
    console.error('[AI Enhancement] Error converting native URI:', error);
    throw error;
  }
}

async function convertUrlToBase64Web(url: string): Promise<string> {
  try {
    console.log('[AI Enhancement] Fetching URL for base64:', url);

    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[AI Enhancement] Error converting URL to base64:', error);
    throw error;
  }
}

export async function convertPhotoToBase64(uri: string, assetId: string): Promise<string> {
  if (Platform.OS === 'web') {
    return convertUrlToBase64Web(uri);
  }
  return convertUriToBase64Native(uri, assetId);
}

async function callImageEditAPI(base64Image: string, style: MontageStyle): Promise<string> {
  const prompt = STYLE_PROMPTS[style];

  console.log('[AI Enhancement] Calling image edit API with style:', style);

  const response = await fetch(IMAGE_EDIT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      images: [{ type: 'image', image: base64Image }],
      aspectRatio: '9:16',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI Enhancement] API error:', response.status, errorText);
    throw new Error(`Image edit API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('[AI Enhancement] API returned successfully');

  return result.image.base64Data;
}

async function saveEnhancedImage(base64Data: string, index: number, projectId: string): Promise<string> {
  if (Platform.OS === 'web') {
    return `data:image/png;base64,${base64Data}`;
  }

  const directory = `${FileSystem.documentDirectory}montage/${projectId}/`;

  const dirInfo = await FileSystem.getInfoAsync(directory);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }

  const filePath = `${directory}enhanced_${index}.png`;
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log('[AI Enhancement] Saved enhanced image to:', filePath);
  return filePath;
}

export async function enhancePhotos(
  photos: Array<{ id: string; uri: string }>,
  style: MontageStyle,
  projectId: string,
  onProgress: ProgressCallback,
  abortSignal?: { aborted: boolean },
): Promise<string[]> {
  const enhancedUris: string[] = [];
  const total = photos.length;

  console.log('[AI Enhancement] Starting enhancement of', total, 'photos with style:', style);

  for (let i = 0; i < total; i++) {
    if (abortSignal?.aborted) {
      console.log('[AI Enhancement] Aborted');
      throw new Error('Enhancement cancelled');
    }

    const photo = photos[i];

    onProgress({
      currentIndex: i,
      totalCount: total,
      step: 'converting',
      overallProgress: ((i * 3) / (total * 3)) * 100,
    });

    let base64: string;
    try {
      base64 = await convertPhotoToBase64(photo.uri, photo.id);
    } catch (error) {
      console.error('[AI Enhancement] Failed to convert photo', i, ':', error);
      enhancedUris.push(photo.uri);
      continue;
    }

    if (abortSignal?.aborted) throw new Error('Enhancement cancelled');

    onProgress({
      currentIndex: i,
      totalCount: total,
      step: 'enhancing',
      overallProgress: ((i * 3 + 1) / (total * 3)) * 100,
    });

    let enhancedBase64: string;
    try {
      enhancedBase64 = await callImageEditAPI(base64, style);
    } catch (error) {
      console.error('[AI Enhancement] Failed to enhance photo', i, ':', error);
      enhancedUris.push(photo.uri);
      continue;
    }

    if (abortSignal?.aborted) throw new Error('Enhancement cancelled');

    onProgress({
      currentIndex: i,
      totalCount: total,
      step: 'saving',
      overallProgress: ((i * 3 + 2) / (total * 3)) * 100,
    });

    try {
      const savedUri = await saveEnhancedImage(enhancedBase64, i, projectId);
      enhancedUris.push(savedUri);
    } catch (error) {
      console.error('[AI Enhancement] Failed to save photo', i, ':', error);
      enhancedUris.push(photo.uri);
    }
  }

  console.log('[AI Enhancement] Completed. Enhanced', enhancedUris.length, 'photos');
  return enhancedUris;
}

export async function cleanupProjectFiles(projectId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const directory = `${FileSystem.documentDirectory}montage/${projectId}/`;
  try {
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(directory, { idempotent: true });
      console.log('[AI Enhancement] Cleaned up project files:', projectId);
    }
  } catch (error) {
    console.error('[AI Enhancement] Error cleaning up:', error);
  }
}
