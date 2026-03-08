import { PhotoItem, SmartCollection } from '@/types';

const photoPool: PhotoItem[] = [
  { id: '1', uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop', type: 'video', date: '2026-02-27', isFavorite: true, location: 'Swiss Alps', duration: 14 },
  { id: '2', uri: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=600&fit=crop', type: 'video', date: '2026-02-26', isFavorite: false, location: 'Yosemite', duration: 8 },
  { id: '3', uri: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=600&fit=crop', type: 'video', date: '2026-02-25', isFavorite: true, location: 'Lake Bled', duration: 22 },
  { id: '4', uri: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=600&fit=crop', type: 'video', date: '2026-02-25', isFavorite: false, duration: 12 },
  { id: '5', uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=600&fit=crop', type: 'video', date: '2026-02-24', isFavorite: true, location: 'Maldives', duration: 18 },
  { id: '6', uri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=600&fit=crop', type: 'video', date: '2026-02-24', isFavorite: false, location: 'Mount Hood', duration: 10 },
  { id: '7', uri: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=600&fit=crop', type: 'video', date: '2026-02-23', isFavorite: false, location: 'Norway', duration: 16 },
  { id: '8', uri: 'https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=400&h=600&fit=crop', type: 'video', date: '2026-02-23', isFavorite: true, duration: 8 },
  { id: '9', uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=600&fit=crop', type: 'video', date: '2026-02-22', isFavorite: false, location: 'Foggy Forest', duration: 25 },
  { id: '10', uri: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=600&fit=crop', type: 'video', date: '2026-02-22', isFavorite: true, duration: 11 },
  { id: '11', uri: 'https://images.unsplash.com/photo-1500534314263-a834e6759bb8?w=400&h=600&fit=crop', type: 'video', date: '2026-02-21', isFavorite: false, location: 'Beach Sunset', duration: 7 },
  { id: '12', uri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=600&fit=crop', type: 'video', date: '2026-02-21', isFavorite: false, location: 'Tokyo', duration: 19 },
  { id: '13', uri: 'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=400&h=600&fit=crop', type: 'video', date: '2026-02-20', isFavorite: true, duration: 9 },
  { id: '14', uri: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=600&fit=crop', type: 'video', date: '2026-02-20', isFavorite: false, duration: 15 },
  { id: '15', uri: 'https://images.unsplash.com/photo-1465056836900-8f1e4a83d01a?w=400&h=600&fit=crop', type: 'video', date: '2026-02-19', isFavorite: false, location: 'Patagonia', duration: 13 },
  { id: '16', uri: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=400&h=600&fit=crop', type: 'video', date: '2026-02-19', isFavorite: true, location: 'Northern Lights', duration: 20 },
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
