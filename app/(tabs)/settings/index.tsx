import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Monitor,
  Palette,
  Sparkles,
  HardDrive,
  Info,
  ChevronRight,
  User,
  Shield,
  FileText,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { ExportQuality, MontageStyle } from '@/types';

const qualityOptions: ExportQuality[] = ['720p', '1080p', '4k'];
const styleOptions: { id: MontageStyle; label: string }[] = [
  { id: 'dynamic', label: 'Dynamic' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'dreamy', label: 'Dreamy' },
];

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={groupStyles.container}>
      <Text style={groupStyles.title}>{title}</Text>
      <View style={groupStyles.card}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  isLast,
  rightElement,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.7 : 1}
      style={[rowStyles.container, !isLast && rowStyles.border]}
    >
      <View style={rowStyles.iconContainer}>{icon}</View>
      <Text style={rowStyles.label}>{label}</Text>
      {rightElement || (
        <View style={rowStyles.right}>
          {value && <Text style={rowStyles.value}>{value}</Text>}
          {onPress && <ChevronRight size={16} color={Colors.dark.textTertiary} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useApp();

  const cycleQuality = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const currentIdx = qualityOptions.indexOf(settings.exportQuality);
    const nextIdx = (currentIdx + 1) % qualityOptions.length;
    updateSettings({ exportQuality: qualityOptions[nextIdx] });
  }, [settings.exportQuality]);

  const cycleStyle = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const currentIdx = styleOptions.findIndex(s => s.id === settings.defaultStyle);
    const nextIdx = (currentIdx + 1) % styleOptions.length;
    updateSettings({ defaultStyle: styleOptions[nextIdx].id });
  }, [settings.defaultStyle]);

  const toggleAI = useCallback((value: boolean) => {
    updateSettings({ aiEnhancementDefault: value });
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached thumbnails and temporary files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  }, []);

  const currentStyleLabel = styleOptions.find(s => s.id === settings.defaultStyle)?.label || 'Dynamic';

  return (
    <View style={[settStyles.container, { paddingTop: insets.top }]}>
      <View style={settStyles.header}>
        <Text style={settStyles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={settStyles.scrollContent}
      >
        <SettingsGroup title="ACCOUNT">
          <SettingsRow
            icon={<User size={18} color={Colors.dark.accent} />}
            label="Account"
            value="Sign in"
            onPress={() => {}}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup title="EXPORT">
          <SettingsRow
            icon={<Monitor size={18} color="#3B82F6" />}
            label="Export Quality"
            value={settings.exportQuality}
            onPress={cycleQuality}
          />
          <SettingsRow
            icon={<Palette size={18} color={Colors.dark.secondary} />}
            label="Default Style"
            value={currentStyleLabel}
            onPress={cycleStyle}
          />
          <SettingsRow
            icon={<Sparkles size={18} color={Colors.dark.accent} />}
            label="AI Enhancement"
            isLast
            rightElement={
              <Switch
                value={settings.aiEnhancementDefault}
                onValueChange={toggleAI}
                trackColor={{ false: Colors.dark.surfaceLight, true: Colors.dark.accentDark }}
                thumbColor={settings.aiEnhancementDefault ? Colors.dark.accent : Colors.dark.textTertiary}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup title="STORAGE">
          <SettingsRow
            icon={<HardDrive size={18} color="#34D399" />}
            label="Clear Cache"
            value="24.3 MB"
            onPress={handleClearCache}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup title="ABOUT">
          <SettingsRow
            icon={<Info size={18} color={Colors.dark.textSecondary} />}
            label="Version"
            value="1.0.0"
          />
          <SettingsRow
            icon={<Shield size={18} color={Colors.dark.textSecondary} />}
            label="Privacy Policy"
            onPress={() => {}}
          />
          <SettingsRow
            icon={<FileText size={18} color={Colors.dark.textSecondary} />}
            label="Terms of Service"
            onPress={() => {}}
            isLast
          />
        </SettingsGroup>

        <Text style={settStyles.footer}>Made with ❤️ by Montage Team</Text>
      </ScrollView>
    </View>
  );
}

const settStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: Colors.dark.text,
    letterSpacing: -0.8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  footer: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.dark.textTertiary,
    marginTop: 32,
    marginBottom: 16,
  },
});

const groupStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.dark.textTertiary,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    overflow: 'hidden',
  },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  border: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark.separator,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.dark.text,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 14,
    color: Colors.dark.textTertiary,
    fontWeight: '500' as const,
  },
});
