import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotes } from '../hooks/useNotes';
import { formatDate } from '../utils/noteUtils';
import { Note, DateCategory } from '../types';
import SearchBar from '../components/SearchBar';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { modelDownloadService, ModelDownloadProgress } from '../services/modelDownloadService';
import { BiometricAuthService } from '../services/biometricAuth';

const CATEGORY_ORDER: DateCategory[] = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];

const { width } = Dimensions.get('window');

export default function NotesListScreen() {
  const {
    loading,
    error,
    searchTerm,
    categorizedNotes,
    setSearchTerm,
    clearError,
    refreshNotes,
  } = useNotes();

  // Model download state
  const [isModelDownloading, setIsModelDownloading] = useState(false);
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0);
  const [modelDownloadError, setModelDownloadError] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);

  // Biometric authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [authenticationError, setAuthenticationError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const validateAndEnsureModel = useCallback(async () => {
    try {
      console.log('Validating Whisper model installation...');
      
      // Check if running on web platform - skip model validation
      if (Platform.OS === 'web') {
        console.log('Web platform detected - skipping model validation');
        setIsModelReady(true);
        return;
      }
      
      // Strict model validation - check if model is actually available
      const isAvailable = await modelDownloadService.isModelAvailable();
      
      if (isAvailable) {
        console.log('Whisper model is available and ready');
        setIsModelReady(true);
        return;
      }

      console.log('Whisper model not found, starting download...');
      // Model not available, start download with strict error handling
      setIsModelDownloading(true);
      setModelDownloadError(null);
      setModelDownloadProgress(0);
      
      await modelDownloadService.downloadModel((progress: ModelDownloadProgress) => {
        setModelDownloadProgress(progress.progress);
      });
      
      // Double-check that model is now available after download
      const isNowAvailable = await modelDownloadService.isModelAvailable();
      if (!isNowAvailable) {
        throw new Error('Model download completed but validation failed');
      }
      
      console.log('Whisper model download and validation completed successfully');
      setIsModelDownloading(false);
      setIsModelReady(true);
    } catch (modelError) {
      console.error('Model validation/download failed:', modelError);
      setIsModelDownloading(false);
      setModelDownloadError(
        modelError instanceof Error 
          ? modelError.message 
          : 'Failed to install required voice recognition model'
      );
      // Do not set isModelReady to true - app cannot proceed without model
    }
  }, []);

  const checkAuthenticationAndModel = useCallback(async () => {
    try {
      setIsCheckingAuth(true);
      
      // Check if biometric authentication is enabled
      const isBiometricEnabled = await BiometricAuthService.isBiometricEnabled();
      
      if (isBiometricEnabled) {
        setAuthenticationRequired(true);
        setIsCheckingAuth(false);
        // Don't proceed with model validation until authentication is complete
        return;
      }
      
      // If biometric auth is not enabled, proceed directly to model validation
      setIsAuthenticated(true);
      setAuthenticationRequired(false);
      setIsCheckingAuth(false);
      await validateAndEnsureModel();
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsCheckingAuth(false);
      // Proceed without authentication if there's an error, but still validate model
      setIsAuthenticated(true);
      await validateAndEnsureModel();
    }
  }, [validateAndEnsureModel]);

  // Check authentication and model on app start
  useEffect(() => {
    checkAuthenticationAndModel();
  }, [checkAuthenticationAndModel]);



  const handleBiometricAuthentication = async () => {
    try {
      setAuthenticationError(null);
      const result = await BiometricAuthService.authenticate(
        'Authenticate to access your notes'
      );
      
      if (result.success) {
        setIsAuthenticated(true);
        setAuthenticationRequired(false);
        await validateAndEnsureModel();
      } else if (result.error) {
        const errorMessage = BiometricAuthService.getErrorMessage(result.error);
        setAuthenticationError(errorMessage);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthenticationError('An unexpected error occurred during authentication.');
    }
  };

  const retryModelDownload = useCallback(() => {
    setModelDownloadError(null);
    validateAndEnsureModel();
  }, []);

  // Refresh notes when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (isModelReady && isAuthenticated) {
        refreshNotes();
      }
    }, [refreshNotes, isModelReady, isAuthenticated])
  );

  const handleNotePress = (noteId: string) => {
    router.push(`/editor?noteId=${noteId}`);
  };

  const handleCreateNote = () => {
    router.push('/editor');
  };

  const handleSettingsPress = () => {
    router.push('/settings');
  };

  const renderNoteItem = (note: Note) => (
    <TouchableOpacity
      key={note.id}
      style={styles.noteItem}
      onPress={() => handleNotePress(note.id)}
      activeOpacity={0.7}
    >
      <View style={styles.noteContent}>
        <Text style={styles.noteTitle} numberOfLines={1}>
          {note.title}
        </Text>
        <Text style={styles.notePreview} numberOfLines={2}>
          {note.content || 'No content'}
        </Text>
        <Text style={styles.noteDate}>
          {formatDate(note.updatedAt)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  const renderCategory = (category: DateCategory) => {
    const notes = categorizedNotes[category];
    if (!notes || notes.length === 0) return null;

    return (
      <View key={category} style={styles.categorySection}>
        <Text style={styles.categoryTitle}>{category}</Text>
        {notes.map(renderNoteItem)}
      </View>
    );
  };

  // Show authentication screen if required
  if (isCheckingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authenticationRequired && !isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <Modal visible={true} transparent={false} animationType="fade">
          <View style={styles.authOverlay}>
            <View style={styles.authContent}>
              <Ionicons name="shield-checkmark-outline" size={64} color="#007AFF" />
              <Text style={styles.authTitle}>Authentication Required</Text>
              <Text style={styles.authSubtitle}>
                Please authenticate to access your notes
              </Text>
              
              {authenticationError && (
                <Text style={styles.errorText}>{authenticationError}</Text>
              )}
              
              <TouchableOpacity 
                style={styles.authButton} 
                onPress={handleBiometricAuthentication}
              >
                <Ionicons name="finger-print" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.authButtonText}>Authenticate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Show model download overlay if model is not ready
  if (!isModelReady) {
    return (
      <SafeAreaView style={styles.container}>
        <Modal visible={true} transparent={false} animationType="fade">
          <View style={styles.modelDownloadOverlay}>
            <View style={styles.modelDownloadContent}>
              <Ionicons name="cloud-download-outline" size={64} color="#007AFF" />
              <Text style={styles.modelDownloadTitle}>Installing Voice Recognition</Text>
              
              {isModelDownloading && (
                <>
                  <Text style={styles.modelDownloadSubtitle}>
                    Installing required AI model for voice transcription...
                    {"\n"}This is required for the app to function properly.
                  </Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${modelDownloadProgress * 100}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round(modelDownloadProgress * 100)}%
                    </Text>
                  </View>
                </>
              )}
              
              {modelDownloadError && (
                <>
                  <Text style={styles.modelDownloadSubtitle}>
                    Voice recognition model is required to use SaveMyMind.
                    {"\n"}Please ensure you have a stable internet connection.
                  </Text>
                  <Text style={styles.errorText}>{modelDownloadError}</Text>
                  <TouchableOpacity 
                    style={styles.retryButton} 
                    onPress={retryModelDownload}
                  >
                    <Text style={styles.retryButtonText}>Retry Installation</Text>
                  </TouchableOpacity>
                </>
              )}
              
              {!isModelDownloading && !modelDownloadError && (
                <>
                  <Text style={styles.modelDownloadSubtitle}>
                    Validating voice recognition model...
                  </Text>
                  <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading notes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    Alert.alert('Error', error, [
      { text: 'OK', onPress: clearError }
    ]);
  }

  const hasNotes = Object.values(categorizedNotes).some(notes => notes.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SaveMyMind</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSettingsPress}
        >
          <Ionicons name="settings-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <SearchBar
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder="Search notes..."
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {hasNotes ? (
          CATEGORY_ORDER.map(renderCategory)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No thoughts yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to create your first thought
            </Text>
          </View>
        )}
      </ScrollView>

      <FloatingActionButton onPress={handleCreateNote} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  settingsButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  notePreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  // Model download overlay styles
  modelDownloadOverlay: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelDownloadContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    maxWidth: width * 0.8,
  },
  modelDownloadTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 20,
    textAlign: 'center',
  },
  modelDownloadSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressContainer: {
    width: '100%',
    marginTop: 30,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e1e5e9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Authentication overlay styles
  authOverlay: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    maxWidth: width * 0.8,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 20,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  authButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});