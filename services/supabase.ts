import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ?? '';
const supabaseKeyName = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ? 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  : process.env.EXPO_PUBLIC_SUPABASE_KEY
    ? 'EXPO_PUBLIC_SUPABASE_KEY'
    : 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key);
  },
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(`[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or ${supabaseKeyName}`);
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export { authStorage };
