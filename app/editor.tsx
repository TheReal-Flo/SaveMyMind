import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotes } from '../hooks/useNotes';
import { NoteInput } from '../types';
import VoiceRecorderWrapper from '../components/VoiceRecorderWrapper';
import { useThemeColor } from '../hooks/useThemeColor';

const AUTO_SAVE_DELAY = 2000; // 2 seconds

export default function NoteEditorScreen() {
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();
  const { getNoteById, addNote, updateNoteById, deleteNote, loading: notesLoading } = useNotes();
  
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  
  const [title, setTitle] = useState('New thought');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [noteNotFound, setNoteNotFound] = useState(false);
  
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  const currentNoteIdRef = useRef<string | null>(null);

  // Theme colors - all hooks must be called at the top level
  const borderColor = useThemeColor({ light: '#e1e5e9', dark: '#333' }, 'background');
  const lightBorderColor = useThemeColor({ light: '#f0f0f0', dark: '#333' }, 'background');
  const placeholderColor = useThemeColor({ light: '#999', dark: '#666' }, 'icon');
  const voiceContainerBg = useThemeColor({ light: '#fafafa', dark: '#1a1a1a' }, 'background');

  // Load existing note if editing - wait for notes to finish loading
  useEffect(() => {
    if (noteId && !notesLoading) {
      const note = getNoteById(noteId);
      if (note) {
        setTitle(note.title);
        setContent(note.content);
        currentNoteIdRef.current = noteId;
        setNoteNotFound(false);
        // Set initial load as complete immediately when note is found
        initialLoadRef.current = false;
      } else {
        setNoteNotFound(true);
      }
    }
    if (!noteId) {
      initialLoadRef.current = false;
    }
  }, [noteId, getNoteById, notesLoading]);

  // Handle note not found after loading is complete
  useEffect(() => {
    if (noteNotFound && !notesLoading) {
      Alert.alert('Error', 'Thought not found', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  }, [noteNotFound, notesLoading]);

  // Set initial load as complete when notes finish loading or no noteId
  useEffect(() => {
    if (!notesLoading && (noteId ? !noteNotFound : true)) {
      initialLoadRef.current = false;
    }
  }, [notesLoading, noteId, noteNotFound]);

  // Auto-save functionality
  useEffect(() => {
    if (initialLoadRef.current) return;
    
    setHasUnsavedChanges(true);
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave();
    }, AUTO_SAVE_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]); // Removed handleAutoSave from dependencies to fix circular dependency

  const handleAutoSave = useCallback(async () => {
    // Capture current values to prevent race conditions
    const currentTitle = title;
    const currentContent = content;
    const currentHasUnsavedChanges = hasUnsavedChanges;
    const currentNoteId = currentNoteIdRef.current;
    
    if (!currentHasUnsavedChanges) return;
    
    try {
      setIsSaving(true);
      // Let noteUtils handle title generation from content if title is empty
      const noteInput: NoteInput = { 
        title: currentTitle.trim(), 
        content: currentContent 
      };
      
      if (currentNoteId) {
        // Update existing note
        const updatedNote = await updateNoteById(currentNoteId, noteInput);
        // Update local title if it was generated from content
        if (!currentTitle.trim() && updatedNote.title !== currentTitle) {
          setTitle(updatedNote.title);
        }
      } else {
        // Create new note
        const newNote = await addNote(noteInput);
        currentNoteIdRef.current = newNote.id;
        // Update local title if it was generated from content
        if (!currentTitle.trim() && newNote.title !== currentTitle) {
          setTitle(newNote.title);
        }
        // Update URL to reflect the new note ID
        router.replace(`/editor?noteId=${newNote.id}`);
      }
      
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Add error handling to prevent corruption
      Alert.alert('Save Error', 'Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [title, content, hasUnsavedChanges, updateNoteById, addNote]); // Include all dependencies for fresh data

  const handleBack = async () => {
    // Save before going back if there are unsaved changes
    if (hasUnsavedChanges) {
      await handleAutoSave();
    }
    router.back();
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleTranscriptionComplete = (transcribedText: string) => {
    // Append transcribed text to existing content
    const newContent = content ? `${content}\n\n${transcribedText}` : transcribedText;
    setContent(newContent);
  };

  const handleDeleteNote = () => {
    if (!currentNoteIdRef.current) {
      router.back();
      return;
    }

    Alert.alert(
      'Delete Thought',
      'Are you sure you want to delete this thought? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await deleteNote(currentNoteIdRef.current!);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete thought');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Show loading while notes are being loaded from storage or while processing
  if (notesLoading || isLoading || initialLoadRef.current) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintColor} />
          <Text style={[styles.loadingText, { color: textColor }]}>
            {notesLoading ? 'Loading thoughts...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={tintColor} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={iconColor} />
                <Text style={[styles.savingText, { color: iconColor }]}>Saving...</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity onPress={handleDeleteNote} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* Title Input */}
        <View style={[styles.titleContainer, { borderBottomColor: lightBorderColor }]}>
          <TextInput
            style={[styles.titleInput, { color: textColor }]}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="Thought title"
            placeholderTextColor={placeholderColor}
            multiline={false}
            returnKeyType="next"
            blurOnSubmit={false}
          />
        </View>

        {/* Content Input */}
        <View style={styles.contentContainer}>
          <TextInput
            style={[styles.contentInput, { color: textColor }]}
            value={content}
            onChangeText={handleContentChange}
            placeholder="Start writing your thought..."
            placeholderTextColor={placeholderColor}
            multiline
            textAlignVertical="top"
            scrollEnabled
          />
        </View>

        {/* Voice Recorder */}
        <View style={[styles.voiceRecorderContainer, { 
          borderTopColor: lightBorderColor,
          backgroundColor: voiceContainerBg
        }]}>
          <VoiceRecorderWrapper
            onTranscriptionComplete={handleTranscriptionComplete}
            disabled={isSaving || isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    padding: 0,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  voiceRecorderContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
});