import { Tabs } from 'expo-router';
import { Plus, FolderOpen, Settings } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';
import Colors from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.dark.accent,
        tabBarInactiveTintColor: Colors.dark.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.dark.tabBar,
          borderTopColor: Colors.dark.tabBarBorder,
          borderTopWidth: 0.5,
          ...(Platform.OS === 'web' ? { height: 60 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="(create)"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, size }) => <Plus color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.5} />,
        }}
      />
    </Tabs>
  );
}
