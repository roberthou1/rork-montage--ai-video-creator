import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Plus, Clock, Music, FolderOpen } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { Project } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 2;

function ProjectCard({ project, onPress, onDelete }: {
  project: Project;
  onPress: () => void;
  onDelete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  };

  const handleLongPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert(
      'Delete Project',
      'This montage will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const formattedDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        activeOpacity={1}
        style={cardStyles.container}
      >
        <View style={cardStyles.imageContainer}>
          <Image source={{ uri: project.thumbnailUri }} style={cardStyles.image} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={cardStyles.gradient}
          />
          <View style={cardStyles.durationBadge}>
            <Clock size={10} color="#fff" />
            <Text style={cardStyles.durationText}>{project.duration}s</Text>
          </View>
          <View style={cardStyles.styleBadge}>
            <Text style={cardStyles.styleText}>
              {project.style.charAt(0).toUpperCase() + project.style.slice(1)}
            </Text>
          </View>
        </View>
        <View style={cardStyles.info}>
          <Text style={cardStyles.date}>{formattedDate}</Text>
          {project.musicTrackName && (
            <View style={cardStyles.musicRow}>
              <Music size={10} color={Colors.dark.textTertiary} />
              <Text style={cardStyles.musicName} numberOfLines={1}>{project.musicTrackName}</Text>
            </View>
          )}
          <Text style={cardStyles.mediaCount}>{project.mediaCount} items</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[emptyStyles.container, { opacity: fadeAnim }]}>
      <View style={emptyStyles.iconCircle}>
        <FolderOpen size={40} color={Colors.dark.textTertiary} strokeWidth={1} />
      </View>
      <Text style={emptyStyles.title}>Your montages will appear here</Text>
      <Text style={emptyStyles.subtitle}>Create your first montage to get started</Text>
      <TouchableOpacity onPress={onCreatePress} activeOpacity={0.85}>
        <LinearGradient
          colors={[Colors.dark.accent, Colors.dark.accentDark]}
          style={emptyStyles.createButton}
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
          <Text style={emptyStyles.createText}>Create Your First</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { projects, deleteProject } = useApp();

  const handleProjectPress = useCallback((project: Project) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: '/preview', params: { projectId: project.id } });
  }, []);

  const handleDelete = useCallback((projectId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    deleteProject(projectId);
  }, [deleteProject]);

  const handleCreatePress = useCallback(() => {
    router.push('/(tabs)/(create)' as any);
  }, []);

  const renderItem = useCallback(({ item }: { item: Project }) => (
    <ProjectCard
      project={item}
      onPress={() => handleProjectPress(item)}
      onDelete={() => handleDelete(item.id)}
    />
  ), [handleProjectPress, handleDelete]);

  return (
    <View style={[projStyles.container, { paddingTop: insets.top }]}>
      <View style={projStyles.header}>
        <Text style={projStyles.headerTitle}>Projects</Text>
        <Text style={projStyles.headerCount}>{projects.length} montages</Text>
      </View>

      {projects.length === 0 ? (
        <EmptyState onCreatePress={handleCreatePress} />
      ) : (
        <FlatList
          data={projects}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={projStyles.row}
          contentContainerStyle={projStyles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const projStyles = StyleSheet.create({
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
  headerCount: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 16,
  },
  row: {
    gap: 12,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.2,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  durationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  durationText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600' as const,
  },
  styleBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.8)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  styleText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700' as const,
  },
  info: {
    padding: 12,
  },
  date: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  musicName: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    flex: 1,
  },
  mediaCount: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  createText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
