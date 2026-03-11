const BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL?.trim() ?? '').replace(/\/+$/, '');

export const isBackendConfigured = Boolean(BACKEND_URL);

export interface SmartCollectionVideoMeta {
  id: string;
  date: string;
  duration?: number;
  location?: string;
  type: 'photo' | 'video';
}

export interface SmartCollectionResult {
  name: string;
  icon: string;
  videoIds: string[];
  reason: string;
}

export interface FetchSmartCollectionsResponse {
  collections: SmartCollectionResult[];
}

export async function fetchSmartCollections(
  videos: SmartCollectionVideoMeta[],
): Promise<FetchSmartCollectionsResponse> {
  if (!BACKEND_URL) {
    console.warn('[SmartCollectionsAPI] Missing EXPO_PUBLIC_BACKEND_URL');
    return { collections: [] };
  }

  console.log('[SmartCollectionsAPI] Fetching smart collections for', videos.length, 'items');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `${BACKEND_URL}/api/collections/smart`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videos }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[SmartCollectionsAPI] Failed:', response.status);
      return { collections: [] };
    }

    const data = (await response.json()) as FetchSmartCollectionsResponse;
    console.log('[SmartCollectionsAPI] Result:', data.collections.length, 'collections');
    return data;
  } catch (error) {
    clearTimeout(timeout);
    console.error('[SmartCollectionsAPI] Error:', error);
    return { collections: [] };
  }
}
