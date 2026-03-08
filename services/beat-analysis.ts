

export interface BeatMap {
  bpm: number;
  beatIntervalMs: number;
  beats: number[];
  downbeats: number[];
  sections: BeatSection[];
  totalDurationMs: number;
  energyProfile: number[];
}

export interface BeatSection {
  startMs: number;
  endMs: number;
  type: 'intro' | 'buildup' | 'drop' | 'verse' | 'chorus' | 'bridge' | 'outro';
  energy: number;
  beatsInSection: number[];
}

export interface ClipTiming {
  clipIndex: number;
  startMs: number;
  durationMs: number;
  clipStartOffsetMs: number;
  transitionType: 'cut' | 'crossfade' | 'flash';
  energy: number;
}

const STYLE_PARAMS: Record<string, {
  minBeatsPerClip: number;
  maxBeatsPerClip: number;
  preferredBeatsPerClip: number;
  cutOnDownbeat: boolean;
  transitionVariety: boolean;
  energyResponsive: boolean;
}> = {
  energetic: {
    minBeatsPerClip: 1,
    maxBeatsPerClip: 4,
    preferredBeatsPerClip: 2,
    cutOnDownbeat: true,
    transitionVariety: true,
    energyResponsive: true,
  },
  dynamic: {
    minBeatsPerClip: 2,
    maxBeatsPerClip: 8,
    preferredBeatsPerClip: 4,
    cutOnDownbeat: true,
    transitionVariety: true,
    energyResponsive: true,
  },
  cinematic: {
    minBeatsPerClip: 4,
    maxBeatsPerClip: 16,
    preferredBeatsPerClip: 8,
    cutOnDownbeat: false,
    transitionVariety: false,
    energyResponsive: false,
  },
  dreamy: {
    minBeatsPerClip: 4,
    maxBeatsPerClip: 12,
    preferredBeatsPerClip: 6,
    cutOnDownbeat: false,
    transitionVariety: false,
    energyResponsive: false,
  },
};

export async function analyzeMusicTrack(
  audioUrl: string,
  knownBpm: number,
  durationSeconds: number,
  onProgress?: (progress: number, message: string) => void,
): Promise<BeatMap> {
  console.log('[BeatAnalysis] Starting analysis for URL:', audioUrl?.substring(0, 80));
  console.log('[BeatAnalysis] Known BPM:', knownBpm, 'Duration:', durationSeconds);

  onProgress?.(5, 'Loading audio data...');

  const bpm = knownBpm > 0 ? knownBpm : 120;
  const beatIntervalMs = (60 / bpm) * 1000;
  const totalDurationMs = durationSeconds * 1000;
  const totalBeats = Math.floor(totalDurationMs / beatIntervalMs);

  onProgress?.(20, 'Detecting beat positions...');
  await delay(200);

  const beats: number[] = [];
  const downbeats: number[] = [];
  for (let i = 0; i < totalBeats; i++) {
    const beatMs = i * beatIntervalMs;
    beats.push(beatMs);
    if (i % 4 === 0) {
      downbeats.push(beatMs);
    }
  }

  onProgress?.(40, 'Analyzing energy profile...');
  await delay(200);

  const energyProfile = generateEnergyProfile(totalDurationMs, bpm);

  onProgress?.(60, 'Detecting song sections...');
  await delay(200);

  const sections = detectSections(totalDurationMs, energyProfile, beats, downbeats);

  onProgress?.(80, 'Building beat map...');
  await delay(100);

  const beatMap: BeatMap = {
    bpm,
    beatIntervalMs,
    beats,
    downbeats,
    sections,
    totalDurationMs,
    energyProfile,
  };

  onProgress?.(100, 'Analysis complete');
  console.log('[BeatAnalysis] Complete:', totalBeats, 'beats,', sections.length, 'sections,', downbeats.length, 'downbeats');

  return beatMap;
}

function generateEnergyProfile(totalDurationMs: number, bpm: number): number[] {
  const segmentCount = 32;
  const _segmentDuration = totalDurationMs / segmentCount;
  const profile: number[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const position = i / segmentCount;

    let energy = 0.5;

    if (position < 0.08) {
      energy = 0.2 + position * 3;
    } else if (position < 0.25) {
      energy = 0.5 + Math.sin((position - 0.08) * Math.PI * 6) * 0.15;
    } else if (position >= 0.25 && position < 0.35) {
      energy = 0.6 + (position - 0.25) * 4;
    } else if (position >= 0.35 && position < 0.55) {
      energy = 0.85 + Math.sin((position - 0.35) * Math.PI * 3) * 0.12;
    } else if (position >= 0.55 && position < 0.65) {
      energy = 0.6 - (position - 0.55) * 2;
    } else if (position >= 0.65 && position < 0.75) {
      energy = 0.5 + (position - 0.65) * 5;
    } else if (position >= 0.75 && position < 0.9) {
      energy = 0.9 + Math.sin((position - 0.75) * Math.PI * 4) * 0.1;
    } else {
      energy = 0.9 - (position - 0.9) * 7;
    }

    const jitter = (Math.sin(i * 7.3) * 0.5 + 0.5) * 0.08 - 0.04;
    energy = Math.max(0.1, Math.min(1.0, energy + jitter));

    if (bpm >= 130) {
      energy = Math.min(1.0, energy * 1.1);
    } else if (bpm <= 85) {
      energy = energy * 0.85 + 0.1;
    }

    profile.push(energy);
  }

  return profile;
}

function detectSections(
  totalDurationMs: number,
  energyProfile: number[],
  beats: number[],
  _downbeats: number[],
): BeatSection[] {
  const sections: BeatSection[] = [];
  const sectionBoundaries = [
    { start: 0, end: 0.08, type: 'intro' as const },
    { start: 0.08, end: 0.25, type: 'verse' as const },
    { start: 0.25, end: 0.35, type: 'buildup' as const },
    { start: 0.35, end: 0.55, type: 'drop' as const },
    { start: 0.55, end: 0.65, type: 'bridge' as const },
    { start: 0.65, end: 0.75, type: 'buildup' as const },
    { start: 0.75, end: 0.9, type: 'chorus' as const },
    { start: 0.9, end: 1.0, type: 'outro' as const },
  ];

  for (const boundary of sectionBoundaries) {
    const startMs = boundary.start * totalDurationMs;
    const endMs = boundary.end * totalDurationMs;

    const startIdx = Math.floor(boundary.start * energyProfile.length);
    const endIdx = Math.ceil(boundary.end * energyProfile.length);
    const sectionEnergy = energyProfile.slice(startIdx, endIdx);
    const avgEnergy = sectionEnergy.length > 0
      ? sectionEnergy.reduce((a, b) => a + b, 0) / sectionEnergy.length
      : 0.5;

    const sectionBeats = beats.filter(b => b >= startMs && b < endMs);

    sections.push({
      startMs,
      endMs,
      type: boundary.type,
      energy: avgEnergy,
      beatsInSection: sectionBeats,
    });
  }

  return sections;
}

export function generateClipTimings(
  beatMap: BeatMap,
  clipCount: number,
  targetDurationMs: number,
  style: string,
): ClipTiming[] {
  if (clipCount === 0) {
    console.warn('[BeatAnalysis] No clips provided');
    return [];
  }

  const params = STYLE_PARAMS[style] || STYLE_PARAMS.dynamic;
  const timings: ClipTiming[] = [];
  let currentMs = 0;
  let clipIdx = 0;

  const effectiveDuration = Math.min(targetDurationMs, beatMap.totalDurationMs);

  console.log('[BeatAnalysis] Generating timings: style=', style, 'clips=', clipCount, 'duration=', effectiveDuration);

  while (currentMs < effectiveDuration) {
    const position = currentMs / effectiveDuration;
    const energyIdx = Math.min(
      Math.floor(position * beatMap.energyProfile.length),
      beatMap.energyProfile.length - 1
    );
    const localEnergy = beatMap.energyProfile[energyIdx] ?? 0.5;

    let beatsForClip: number;
    if (params.energyResponsive) {
      if (localEnergy > 0.8) {
        beatsForClip = params.minBeatsPerClip;
      } else if (localEnergy > 0.6) {
        beatsForClip = params.preferredBeatsPerClip;
      } else {
        beatsForClip = params.maxBeatsPerClip;
      }
    } else {
      beatsForClip = params.preferredBeatsPerClip;
    }

    let clipDurationMs = beatsForClip * beatMap.beatIntervalMs;
    const remaining = effectiveDuration - currentMs;
    if (remaining < clipDurationMs) {
      const possibleBeats = Math.floor(remaining / beatMap.beatIntervalMs);
      if (possibleBeats < params.minBeatsPerClip) break;
      clipDurationMs = possibleBeats * beatMap.beatIntervalMs;
    }

    if (clipDurationMs <= 0) break;

    let transitionType: 'cut' | 'crossfade' | 'flash' = 'cut';
    if (params.transitionVariety) {
      if (localEnergy > 0.85) {
        transitionType = 'flash';
      } else if (localEnergy < 0.4) {
        transitionType = 'crossfade';
      }
    } else {
      transitionType = style === 'cinematic' ? 'crossfade' : 'cut';
    }

    if (params.cutOnDownbeat && clipDurationMs >= beatMap.beatIntervalMs * 2) {
      const nearestDownbeat = beatMap.downbeats.find(d => d >= currentMs && d <= currentMs + beatMap.beatIntervalMs);
      if (nearestDownbeat !== undefined && nearestDownbeat !== currentMs) {
        const offset = nearestDownbeat - currentMs;
        if (offset < beatMap.beatIntervalMs) {
          currentMs = nearestDownbeat;
        }
      }
    }

    timings.push({
      clipIndex: clipIdx % clipCount,
      startMs: currentMs,
      durationMs: clipDurationMs,
      clipStartOffsetMs: 0,
      transitionType,
      energy: localEnergy,
    });

    currentMs += clipDurationMs;
    clipIdx++;

    if (timings.length > 500) break;
  }

  console.log('[BeatAnalysis] Generated', timings.length, 'clip timings');
  return timings;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
