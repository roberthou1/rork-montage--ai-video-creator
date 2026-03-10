import { PhotoItem, SmartCollection } from '@/types';

const SAMPLE_VIDEO_BASE = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264';

const photoPool: PhotoItem[] = [
  { id: '1', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-27', isFavorite: true, location: 'Swiss Alps', duration: 10 },
  { id: '2', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-26', isFavorite: false, location: 'Yosemite', duration: 10 },
  { id: '3', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-25', isFavorite: true, location: 'Lake Bled', duration: 10 },
  { id: '4', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-25', isFavorite: false, duration: 10 },
  { id: '5', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-24', isFavorite: true, location: 'Maldives', duration: 10 },
  { id: '6', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-24', isFavorite: false, location: 'Mount Hood', duration: 10 },
  { id: '7', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-23', isFavorite: false, location: 'Norway', duration: 10 },
  { id: '8', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-23', isFavorite: true, duration: 10 },
  { id: '9', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-22', isFavorite: false, location: 'Foggy Forest', duration: 10 },
  { id: '10', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-22', isFavorite: true, duration: 10 },
  { id: '11', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-21', isFavorite: false, location: 'Beach Sunset', duration: 10 },
  { id: '12', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-21', isFavorite: false, location: 'Tokyo', duration: 10 },
  { id: '13', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-20', isFavorite: true, duration: 10 },
  { id: '14', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-20', isFavorite: false, duration: 10 },
  { id: '15', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-19', isFavorite: false, location: 'Patagonia', duration: 10 },
  { id: '16', uri: `${SAMPLE_VIDEO_BASE}/360/Big_Buck_Bunny_360_10s_1MB.mp4`, type: 'video', date: '2026-02-19', isFavorite: true, location: 'Northern Lights', duration: 10 },
];

export const allPhotos = photoPool;

function buildMockSmartCollections(): SmartCollection[] {
  const collections: SmartCollection[] = [];

  const videos = photoPool.filter(p => p.type === 'video');
  if (videos.length >= 2) {
    collections.push({ id: 'videos', name: 'Videos', icon: 'Video', photos: videos.slice(0, 6) });
  }

  const locMap = new Map<string, PhotoItem[]>();
  for (const p of photoPool) {
    if (p.location) {
      const arr = locMap.get(p.location) || [];
      arr.push(p);
      locMap.set(p.location, arr);
    }
  }
  const sortedLocs = Array.from(locMap.entries()).sort(([, a], [, b]) => b.length - a.length);
  for (const [loc, photos] of sortedLocs.slice(0, 3)) {
    collections.push({ id: `loc-${loc}`, name: loc, icon: 'MapPin', photos: photos.slice(0, 6) });
  }

  const sorted = [...photoPool].sort((a, b) => {
    if (a.type === 'video' && b.type !== 'video') return -1;
    if (a.type !== 'video' && b.type === 'video') return 1;
    return b.date.localeCompare(a.date);
  });
  collections.push({ id: 'recent', name: 'Recent', icon: 'Clock', photos: sorted.slice(0, 6) });

  return collections;
}

export const smartCollections: SmartCollection[] = buildMockSmartCollections();
