import { PhotoItem, SmartCollection } from '@/types';

const GTV = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample';

const photoPool: PhotoItem[] = [
  { id: '1', uri: `${GTV}/ForBiggerBlazes.mp4`, type: 'video', date: '2026-02-27', isFavorite: true, location: 'Swiss Alps', duration: 15 },
  { id: '2', uri: `${GTV}/ForBiggerEscapes.mp4`, type: 'video', date: '2026-02-26', isFavorite: false, location: 'Yosemite', duration: 15 },
  { id: '3', uri: `${GTV}/SubaruOutbackOnStreetAndDirt.mp4`, type: 'video', date: '2026-02-25', isFavorite: true, location: 'Lake Bled', duration: 60 },
  { id: '4', uri: `${GTV}/BigBuckBunny.mp4`, type: 'video', date: '2026-02-25', isFavorite: false, duration: 596 },
  { id: '5', uri: `${GTV}/ElephantsDream.mp4`, type: 'video', date: '2026-02-24', isFavorite: true, location: 'Maldives', duration: 654 },
  { id: '6', uri: `${GTV}/ForBiggerFun.mp4`, type: 'video', date: '2026-02-24', isFavorite: false, location: 'Mount Hood', duration: 60 },
  { id: '7', uri: `${GTV}/ForBiggerJoyrides.mp4`, type: 'video', date: '2026-02-23', isFavorite: false, location: 'Norway', duration: 15 },
  { id: '8', uri: `${GTV}/ForBiggerMeltdowns.mp4`, type: 'video', date: '2026-02-23', isFavorite: true, duration: 15 },
  { id: '9', uri: `${GTV}/Sintel.mp4`, type: 'video', date: '2026-02-22', isFavorite: false, location: 'Foggy Forest', duration: 888 },
  { id: '10', uri: `${GTV}/VolkswagenGTIReview.mp4`, type: 'video', date: '2026-02-22', isFavorite: true, duration: 60 },
  { id: '11', uri: `${GTV}/ForBiggerBlazes.mp4`, type: 'video', date: '2026-02-21', isFavorite: false, location: 'Beach Sunset', duration: 15 },
  { id: '12', uri: `${GTV}/ForBiggerEscapes.mp4`, type: 'video', date: '2026-02-21', isFavorite: false, location: 'Tokyo', duration: 15 },
  { id: '13', uri: `${GTV}/ForBiggerFun.mp4`, type: 'video', date: '2026-02-20', isFavorite: true, duration: 60 },
  { id: '14', uri: `${GTV}/ForBiggerJoyrides.mp4`, type: 'video', date: '2026-02-20', isFavorite: false, duration: 15 },
  { id: '15', uri: `${GTV}/ForBiggerMeltdowns.mp4`, type: 'video', date: '2026-02-19', isFavorite: false, location: 'Patagonia', duration: 15 },
  { id: '16', uri: `${GTV}/SubaruOutbackOnStreetAndDirt.mp4`, type: 'video', date: '2026-02-19', isFavorite: true, location: 'Northern Lights', duration: 60 },
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
