import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/colors';
import { AppProvider } from '@/contexts/AppContext';
import { PhotoLibraryProvider } from '@/contexts/PhotoLibraryContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTintColor: Colors.dark.text,
        contentStyle: { backgroundColor: Colors.dark.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen
        name="editor-setup"
        options={{
          title: 'Editor Setup',
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="generation"
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="preview"
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppProvider>
          <PhotoLibraryProvider>
            <StatusBar style="light" />
            <RootLayoutNav />
          </PhotoLibraryProvider>
        </AppProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
