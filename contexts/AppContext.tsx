import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Project, AppSettings, MontageStyle, ExportQuality, MusicMode } from '@/types';
import { sampleProjects } from '@/mocks/projects';

const SETTINGS_KEY = 'montage_settings';
const PROJECTS_KEY = 'montage_projects';
const ONBOARDING_KEY = 'montage_onboarding_complete';
const DEFAULT_PROJECT_THUMBNAIL = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=600&fit=crop';

const defaultSettings: AppSettings = {
  exportQuality: '1080p',
  defaultStyle: 'dynamic',
  aiEnhancementDefault: true,
  hasCompletedOnboarding: false,
};

const validStyles: MontageStyle[] = ['dynamic', 'cinematic', 'energetic', 'dreamy'];
const validExportQualities: ExportQuality[] = ['720p', '1080p', '4k'];
const validMusicModes: MusicMode[] = ['preset', 'ai-generated', 'none'];

type StoredProject = Partial<Project> & {
  localVideoUris?: string[];
  videoClipUris?: string[];
  enhancedImageUris?: string[];
  originalImageUris?: string[];
};

function isValidStyle(value: unknown): value is MontageStyle {
  return typeof value === 'string' && validStyles.includes(value as MontageStyle);
}

function isValidExportQuality(value: unknown): value is ExportQuality {
  return typeof value === 'string' && validExportQualities.includes(value as ExportQuality);
}

function isValidMusicMode(value: unknown): value is MusicMode {
  return typeof value === 'string' && validMusicModes.includes(value as MusicMode);
}

function isValidDuration(value: unknown): value is Project['duration'] {
  return value === 15 || value === 30 || value === 60;
}

function getFirstNonEmptyString(values: Array<unknown>): string | undefined {
  const match = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof match === 'string' ? match : undefined;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return defaultSettings;
  }

  const partial = value as Partial<AppSettings>;

  return {
    exportQuality: isValidExportQuality(partial.exportQuality)
      ? partial.exportQuality
      : defaultSettings.exportQuality,
    defaultStyle: isValidStyle(partial.defaultStyle)
      ? partial.defaultStyle
      : defaultSettings.defaultStyle,
    aiEnhancementDefault:
      typeof partial.aiEnhancementDefault === 'boolean'
        ? partial.aiEnhancementDefault
        : defaultSettings.aiEnhancementDefault,
    hasCompletedOnboarding:
      typeof partial.hasCompletedOnboarding === 'boolean'
        ? partial.hasCompletedOnboarding
        : defaultSettings.hasCompletedOnboarding,
  };
}

function normalizeProject(value: unknown): Project {
  const project = value && typeof value === 'object' ? (value as StoredProject) : {};
  const fallbackLocalVideoPath = Array.isArray(project.localVideoUris)
    ? project.localVideoUris.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined;
  const legacyMediaCount = Array.isArray(project.originalImageUris)
    ? project.originalImageUris.length
    : Array.isArray(project.enhancedImageUris)
      ? project.enhancedImageUris.length
      : Array.isArray(project.videoClipUris)
        ? project.videoClipUris.length
        : Array.isArray(project.localVideoUris)
          ? project.localVideoUris.length
          : 0;
  const createdAt = typeof project.createdAt === 'string' && project.createdAt.trim().length > 0
    ? project.createdAt
    : new Date().toISOString();

  return {
    id: typeof project.id === 'string' && project.id.trim().length > 0
      ? project.id
      : `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    musicTrackId: typeof project.musicTrackId === 'string' && project.musicTrackId.trim().length > 0
      ? project.musicTrackId
      : null,
    musicTrackName: typeof project.musicTrackName === 'string' && project.musicTrackName.trim().length > 0
      ? project.musicTrackName
      : null,
    style: isValidStyle(project.style) ? project.style : defaultSettings.defaultStyle,
    duration: isValidDuration(project.duration) ? project.duration : 30,
    aiEnhanced: typeof project.aiEnhanced === 'boolean' ? project.aiEnhanced : false,
    status: project.status === 'failed' ? 'failed' : 'complete',
    thumbnailUri:
      typeof project.thumbnailUri === 'string' && project.thumbnailUri.trim().length > 0
        ? project.thumbnailUri
        : DEFAULT_PROJECT_THUMBNAIL,
    mediaCount:
      typeof project.mediaCount === 'number' && Number.isFinite(project.mediaCount) && project.mediaCount >= 0
        ? project.mediaCount
        : legacyMediaCount,
    localVideoPath: getFirstNonEmptyString([project.localVideoPath, fallbackLocalVideoPath]),
    backendJobId: getFirstNonEmptyString([project.backendJobId]),
    generatedMusicUrl: getFirstNonEmptyString([project.generatedMusicUrl]),
    musicMode: isValidMusicMode(project.musicMode) ? project.musicMode : undefined,
  };
}

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [projects, setProjects] = useState<Project[]>([]);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);

      if (!stored) {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
        return defaultSettings;
      }

      try {
        const parsed = JSON.parse(stored) as unknown;
        const normalized = normalizeSettings(parsed);
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
        return normalized;
      } catch (error) {
        console.error('[AppContext] Failed to parse settings, restoring defaults:', error);
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
        return defaultSettings;
      }
    },
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PROJECTS_KEY);

      if (!stored) {
        await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(sampleProjects));
        return sampleProjects;
      }

      try {
        const parsed = JSON.parse(stored) as unknown;
        const normalizedProjects = Array.isArray(parsed) ? parsed.map(normalizeProject) : sampleProjects;
        await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(normalizedProjects));
        return normalizedProjects;
      } catch (error) {
        console.error('[AppContext] Failed to parse projects, restoring samples:', error);
        await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(sampleProjects));
        return sampleProjects;
      }
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (projectsQuery.data) {
      setProjects(projectsQuery.data);
    }
  }, [projectsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      return newSettings;
    },
    onSuccess: (data) => {
      setSettings(data);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const saveProjectsMutation = useMutation({
    mutationFn: async (newProjects: Project[]) => {
      await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(newProjects));
      return newProjects;
    },
    onSuccess: (data) => {
      setProjects(data);
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const completeOnboarding = useCallback(() => {
    const updated = { ...settings, hasCompletedOnboarding: true };
    setSettings(updated);
    saveSettingsMutation.mutate(updated);
    void AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  }, [saveSettingsMutation, settings]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    saveSettingsMutation.mutate(updated);
  }, [saveSettingsMutation, settings]);

  const addProject = useCallback((project: Project) => {
    const normalizedProject = normalizeProject(project);
    const updated = [normalizedProject, ...projects.filter((item) => item.id !== normalizedProject.id)];
    setProjects(updated);
    saveProjectsMutation.mutate(updated);
  }, [projects, saveProjectsMutation]);

  const deleteProject = useCallback((projectId: string) => {
    const updated = projects.filter((project) => project.id !== projectId);
    setProjects(updated);
    saveProjectsMutation.mutate(updated);
  }, [projects, saveProjectsMutation]);

  return useMemo(() => ({
    settings,
    projects,
    isLoading: settingsQuery.isLoading || projectsQuery.isLoading,
    completeOnboarding,
    updateSettings,
    addProject,
    deleteProject,
  }), [
    addProject,
    completeOnboarding,
    deleteProject,
    projects,
    projectsQuery.isLoading,
    settings,
    settingsQuery.isLoading,
    updateSettings,
  ]);
});
