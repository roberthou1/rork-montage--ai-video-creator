import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function CreateLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: { fontWeight: '700' as const },
        contentStyle: { backgroundColor: Colors.dark.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="select-photos"
        options={{
          title: 'Select Photos',
          presentation: 'modal',
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
