import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Project, AppSettings, MontageStyle, ExportQuality } from '@/types';
import { sampleProjects } from '@/mocks/projects';

const SETTINGS_KEY = 'montage_settings';
const PROJECTS_KEY = 'montage_projects';
const ONBOARDING_KEY = 'montage_onboarding_complete';

const defaultSettings: AppSettings = {
  exportQuality: '1080p',
  defaultStyle: 'dynamic',
  aiEnhancementDefault: true,
  hasCompletedOnboarding: false,
};

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [projects, setProjects] = useState<Project[]>([]);

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      return stored ? JSON.parse(stored) as AppSettings : defaultSettings;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PROJECTS_KEY);
      if (stored) {
        return JSON.parse(stored) as Project[];
      }
      await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(sampleProjects));
      return sampleProjects;
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
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const saveProjectsMutation = useMutation({
    mutationFn: async (newProjects: Project[]) => {
      await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(newProjects));
      return newProjects;
    },
    onSuccess: (data) => {
      setProjects(data);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const completeOnboarding = useCallback(() => {
    const updated = { ...settings, hasCompletedOnboarding: true };
    saveSettingsMutation.mutate(updated);
    AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    saveSettingsMutation.mutate(updated);
  }, [settings]);

  const addProject = useCallback((project: Project) => {
    const updated = [project, ...projects];
    saveProjectsMutation.mutate(updated);
  }, [projects]);

  const deleteProject = useCallback((projectId: string) => {
    const updated = projects.filter(p => p.id !== projectId);
    saveProjectsMutation.mutate(updated);
  }, [projects]);

  return {
    settings,
    projects,
    isLoading: settingsQuery.isLoading || projectsQuery.isLoading,
    completeOnboarding,
    updateSettings,
    addProject,
    deleteProject,
  };
});
