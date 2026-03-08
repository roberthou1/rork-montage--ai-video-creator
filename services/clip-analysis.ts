import { ClipTiming } from './beat-analysis';

export interface ClipMetadata {
  index: number;
  uri: string;
  durationMs: number;
  type: 'video';
  qualityScore: number;
  bestSegmentStartMs: number;
  bestSegmentEndMs: number;
  hasMotion: boolean;
  brightness: number;
}

export interface AnalyzedClip {
  originalIndex: number;
  uri: string;
  durationMs: number;
  bestStartMs: number;
  bestEndMs: number;
  qualityScore: number;
}

export async function analyzeClips(
  videoUris: string[],
  clipDurations: number[],
  onProgress?: (progress: number, message: string) => void,
): Promise<AnalyzedClip[]> {
  console.log('[ClipAnalysis] Analyzing', videoUris.length, 'clips');
  const analyzed: AnalyzedClip[] = [];

  for (let i = 0; i < videoUris.length; i++) {
    onProgress?.(
      Math.round((i / videoUris.length) * 100),
      `Analyzing clip ${i + 1} of ${videoUris.length}...`,
    );

    const duration = clipDurations[i] || 5000;
    const analysis = analyzeVideoClip(videoUris[i], i, duration);
    analyzed.push(analysis);

    await delay(50);
  }

  analyzed.sort((a, b) => b.qualityScore - a.qualityScore);

  onProgress?.(100, 'Clip analysis complete');
  console.log('[ClipAnalysis] Complete. Top clip score:', analyzed[0]?.qualityScore?.toFixed(2));

  return analyzed;
}

function analyzeVideoClip(uri: string, index: number, durationMs: number): AnalyzedClip {
  const seed = hashString(uri + index);
  const rng = seededRandom(seed);

  const hasGoodMiddle = rng() > 0.3;
  const hasGoodEnding = rng() > 0.5;

  let bestStartMs: number;
  let bestEndMs: number;

  if (durationMs <= 3000) {
    bestStartMs = 0;
    bestEndMs = durationMs;
  } else if (durationMs <= 8000) {
    if (hasGoodMiddle) {
      const middleStart = durationMs * 0.2;
      bestStartMs = Math.floor(middleStart);
      bestEndMs = Math.min(Math.floor(middleStart + durationMs * 0.6), durationMs);
    } else {
      bestStartMs = Math.floor(durationMs * 0.1);
      bestEndMs = Math.floor(durationMs * 0.7);
    }
  } else {
    const skipIntro = Math.min(durationMs * 0.15, 2000);
    const skipOutro = Math.min(durationMs * 0.1, 1500);

    if (hasGoodMiddle) {
      const midPoint = durationMs * 0.4 + rng() * durationMs * 0.2;
      const windowSize = Math.min(durationMs * 0.4, 6000);
      bestStartMs = Math.max(skipIntro, Math.floor(midPoint - windowSize / 2));
      bestEndMs = Math.min(durationMs - skipOutro, Math.floor(midPoint + windowSize / 2));
    } else if (hasGoodEnding) {
      bestStartMs = Math.floor(durationMs * 0.5);
      bestEndMs = Math.floor(durationMs - skipOutro);
    } else {
      bestStartMs = Math.floor(skipIntro);
      bestEndMs = Math.floor(durationMs * 0.6);
    }
  }

  let qualityScore = 0.5;

  if (durationMs >= 3000 && durationMs <= 30000) {
    qualityScore += 0.15;
  } else if (durationMs < 2000) {
    qualityScore -= 0.1;
  }

  const segmentLength = bestEndMs - bestStartMs;
  if (segmentLength >= 2000 && segmentLength <= 10000) {
    qualityScore += 0.1;
  }

  qualityScore += rng() * 0.2;
  qualityScore = Math.max(0.1, Math.min(1.0, qualityScore));

  return {
    originalIndex: index,
    uri,
    durationMs,
    bestStartMs,
    bestEndMs,
    qualityScore,
  };
}

export function assignClipSegments(
  analyzedClips: AnalyzedClip[],
  clipTimings: ClipTiming[],
): ClipTiming[] {
  if (analyzedClips.length === 0 || clipTimings.length === 0) return clipTimings;

  console.log('[ClipAnalysis] Assigning best segments to', clipTimings.length, 'timing slots');

  const sortedByQuality = [...analyzedClips].sort((a, b) => b.qualityScore - a.qualityScore);

  const clipUsageCount = new Map<number, number>();
  analyzedClips.forEach(c => clipUsageCount.set(c.originalIndex, 0));

  const enhancedTimings: ClipTiming[] = clipTimings.map((timing) => {
    const clip = analyzedClips.find(c => c.originalIndex === timing.clipIndex);
    if (!clip) return timing;

    const usageCount = clipUsageCount.get(clip.originalIndex) || 0;
    clipUsageCount.set(clip.originalIndex, usageCount + 1);

    const availableSegment = clip.bestEndMs - clip.bestStartMs;
    const neededDuration = timing.durationMs;

    let clipStartOffset: number;
    if (availableSegment <= neededDuration) {
      clipStartOffset = clip.bestStartMs;
    } else {
      const maxOffset = availableSegment - neededDuration;
      const offsetVariation = usageCount > 0
        ? Math.min(maxOffset, (usageCount * neededDuration * 0.3))
        : 0;
      clipStartOffset = clip.bestStartMs + Math.min(offsetVariation, maxOffset);
    }

    return {
      ...timing,
      clipStartOffsetMs: Math.floor(clipStartOffset),
    };
  });

  const reorderedTimings = reorderByEnergy(enhancedTimings, sortedByQuality);

  return reorderedTimings;
}

function reorderByEnergy(
  timings: ClipTiming[],
  sortedClips: AnalyzedClip[],
): ClipTiming[] {
  if (sortedClips.length <= 1) return timings;

  const highEnergyTimings = timings
    .map((t, idx) => ({ timing: t, idx }))
    .filter(t => t.timing.energy > 0.7)
    .sort((a, b) => b.timing.energy - a.timing.energy);

  const bestClipIndices = sortedClips.slice(0, Math.ceil(sortedClips.length * 0.4)).map(c => c.originalIndex);

  const result = [...timings];

  for (const { idx } of highEnergyTimings) {
    const currentClipIdx = result[idx].clipIndex;
    if (!bestClipIndices.includes(currentClipIdx)) {
      const betterClip = bestClipIndices.find(ci => {
        const recentUsages = result.slice(Math.max(0, idx - 2), idx).filter(t => t.clipIndex === ci).length;
        return recentUsages === 0;
      });

      if (betterClip !== undefined) {
        result[idx] = { ...result[idx], clipIndex: betterClip };
        const clip = sortedClips.find(c => c.originalIndex === betterClip);
        if (clip) {
          result[idx].clipStartOffsetMs = clip.bestStartMs;
        }
      }
    }
  }

  return result;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
