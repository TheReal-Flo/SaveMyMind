import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { initWhisper, AudioSessionIos } from 'whisper.rn';
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
          useGpu: true,
          useVad: true, // Enable Voice Activity Detection
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

      // Configure audio mode for optimal speech recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Configure iOS audio session for speech recording
      if (Platform.OS === 'ios') {
        try {
          await AudioSessionIos.setCategory(
            AudioSessionIos.Category.PlayAndRecord,
            [AudioSessionIos.CategoryOption.DefaultToSpeaker]
          );
          await AudioSessionIos.setMode(AudioSessionIos.Mode.SpokenAudio);
          await AudioSessionIos.setActive(true);
        } catch (error) {
          console.warn('Failed to configure iOS audio session:', error);
        }
      }

      // Start recording with WAV format optimized for speech recognition
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 16000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 16000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 16000,
        },
      };
      
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      
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
      
      // Transcribe the audio with enhanced options and VAD
        const transcribeOptions = {
          language: 'auto', // Auto-detect language
          task: 'transcribe',
          temperature: 0.0, // More deterministic output
          best_of: 1,
          beam_size: 1,
          word_thold: 0.01,
          entropy_thold: 2.4,
          logprob_thold: -1.0,
          no_speech_thold: 0.6, // Lower threshold for better speech detection
          compression_ratio_thold: 2.4,
          condition_on_previous_text: false,
          initial_prompt: '', // Can add context if needed
          // VAD options for better speech detection
          vad_thold: 0.6,
          vad_freq_thold: 100,
          vad_grace_sec: 2.0,
        };
      
      console.log('Starting transcription with options:', transcribeOptions);
      
      try {
        const { promise } = whisperContextRef.current.transcribe(uri, transcribeOptions);
        const { result } = await promise;
        
        console.log('Transcription result:', result);
        console.log('Transcription result type:', typeof result);
        console.log('Transcription result length:', result?.length || 0);
        
        // Check for common non-speech results
        const nonSpeechPatterns = [
          /^\s*$/,  // Empty or whitespace only
          /^\s*\[.*\]\s*$/,  // Only sound effects like [Music]
          /^\s*music\s*$/i,  // Just "music"
          /^\s*\(.*\)\s*$/,  // Only parenthetical content
        ];
        
        const isNonSpeech = nonSpeechPatterns.some(pattern => pattern.test(result || ''));
        
        if (result && result.trim() && !isNonSpeech) {
          console.log('Valid speech detected:', result.trim());
          onTranscriptionComplete(result.trim());
        } else {
          console.warn('No valid speech detected. Result:', result);
          console.warn('Audio file URI:', uri);
          Alert.alert('No Speech Detected', 'No speech was detected in the recording. Try speaking closer to the microphone.');
        }
      } catch (transcriptionError) {
        console.error('Transcription failed:', transcriptionError);
        Alert.alert('Error', `Transcription failed: ${transcriptionError.message}`);
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