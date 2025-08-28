import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, Alert, StyleSheet, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { initWhisper } from 'whisper.rn';
import { modelDownloadService } from '../services/modelDownloadService';

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  disabled?: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isTranscribing: boolean;
  duration: number;
  isInitialized: boolean;
  initError: string | null;
}

export default function VoiceRecorder({ onTranscriptionComplete, disabled = false }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isTranscribing: false,
    duration: 0,
    isInitialized: false,
    initError: null
  });
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const whisperContextRef = useRef<any>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Whisper on component mount
  useEffect(() => {
    initializeWhisper();
  }, []);

  const initializeWhisper = async () => {
    try {
      console.log('Starting Whisper initialization...');
      
      // Check if running on web platform
      if (Platform.OS === 'web') {
        console.log('Web platform detected - voice recognition not supported');
        setState(prev => ({ 
          ...prev, 
          isInitialized: false,
          initError: 'Voice recognition is not available on web platform'
        }));
        return null;
      }

      // Check if initWhisper is available
      if (!initWhisper) {
        console.error('initWhisper function not available');
        setState(prev => ({ 
          ...prev, 
          isInitialized: false,
          initError: 'Voice recognition library not available'
        }));
        return null;
      }

      // Verify model is available before initialization
      console.log('Checking model availability...');
      const isModelAvailable = await modelDownloadService.isModelAvailable();
      if (!isModelAvailable) {
        console.error('Whisper model is not available');
        setState(prev => ({ 
          ...prev, 
          isInitialized: false,
          initError: 'Voice recognition model not found. Please restart the app.'
        }));
        return null;
      }

      // Get model path
      const modelPath = modelDownloadService.getModelPath();
      console.log('Model path:', modelPath);
      
      if (!modelPath) {
        console.error('Model path is empty');
        setState(prev => ({ 
          ...prev, 
          isInitialized: false,
          initError: 'Invalid model path'
        }));
        return null;
      }
      
      // Initialize Whisper context with the model file
      if (!whisperContextRef.current) {
        console.log('Initializing Whisper context with model:', modelPath);
        whisperContextRef.current = await initWhisper({
          filePath: modelPath,
        });
        console.log('Whisper context created successfully');
      }
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true,
        initError: null
      }));
      
      console.log('Whisper initialized successfully');
      return whisperContextRef.current;
    } catch (error) {
      console.error('Failed to initialize Whisper:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: false,
        initError: error instanceof Error ? error.message : 'Failed to initialize voice recognition'
      }));
      return null;
    }
  };

  const startRecording = async () => {
    try {
      // Check if Whisper is initialized
      if (!state.isInitialized) {
        if (state.initError) {
          Alert.alert('Error', 'Voice recognition is not available. Please restart the app.');
        } else {
          Alert.alert('Please wait', 'Voice recognition is initializing...');
        }
        return;
      }

      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is required for voice recording.');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setState(prev => ({ ...prev, isRecording: true, duration: 0 }));
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;
      
      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      setState(prev => ({ ...prev, isRecording: false, isTranscribing: true }));
      
      // Stop recording and get URI
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (!uri) {
        throw new Error('No recording URI available');
      }
      
      // Use existing Whisper context for transcription
      if (!whisperContextRef.current) {
        console.error('Whisper context not available');
        setState(prev => ({ ...prev, isTranscribing: false }));
        Alert.alert('Error', 'Voice recognition not ready. Please try again.');
        return;
      }
      
      // Transcribe the audio
      const { promise } = whisperContextRef.current.transcribe(uri, { language: 'en' });
      const { result } = await promise;
      
      if (result && result.trim()) {
        onTranscriptionComplete(result.trim());
      } else {
        Alert.alert('No Speech Detected', 'No speech was detected in the recording.');
      }
      
    } catch (error) {
      console.error('Failed to process recording:', error);
      Alert.alert('Error', 'Failed to process recording');
    } finally {
      setState(prev => ({ ...prev, isTranscribing: false, duration: 0 }));
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonColor = () => {
    if (disabled) return '#ccc';
    if (!state.isInitialized || state.initError) return '#ccc';
    if (state.isRecording) return '#ff4444';
    if (state.isTranscribing) return '#ffa500';
    return '#007AFF';
  };

  const getButtonIcon = () => {
    if (state.initError) return 'alert-circle-outline';
    if (state.isTranscribing) return 'hourglass-outline';
    if (state.isRecording) return 'stop';
    if (!state.isInitialized) return 'time-outline';
    return 'mic';
  };

  const getStatusText = () => {
    if (state.initError) return 'Voice recognition unavailable';
    if (!state.isInitialized) return 'Initializing voice recognition...';
    if (state.isTranscribing) return 'Transcribing...';
    if (state.isRecording) return `Recording ${formatDuration(state.duration)}`;
    return 'Tap to record';
  };

  const handlePress = () => {
    if (disabled || state.isTranscribing || !state.isInitialized || state.initError) return;
    
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.recordButton, { backgroundColor: getButtonColor() }]}
        onPress={handlePress}
        disabled={Boolean(disabled || state.isTranscribing || !state.isInitialized || state.initError)}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={getButtonIcon() as any} 
          size={24} 
          color="white" 
        />
      </TouchableOpacity>
      
      <Text style={styles.statusText}>
        {getStatusText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  recordButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statusText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});