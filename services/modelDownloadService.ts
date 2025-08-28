import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import FileSystem only for native platforms
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try {
    FileSystem = require('expo-file-system');
  } catch (error) {
    console.warn('FileSystem not available:', error);
  }
}

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';
const MODEL_FILENAME = 'ggml-tiny.en.bin';
const MODEL_STORAGE_KEY = 'whisper_model_downloaded';
const MODEL_VERSION_KEY = 'whisper_model_version';
const CURRENT_MODEL_VERSION = '1.0.0';

export interface ModelDownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number;
}

export interface ModelDownloadState {
  isDownloading: boolean;
  isDownloaded: boolean;
  progress: number;
  error: string | null;
}

class ModelDownloadService {
  private modelPath: string;
  private downloadCallbacks: ((progress: ModelDownloadProgress) => void)[] = [];

  constructor() {
    this.modelPath = Platform.OS !== 'web' && FileSystem 
      ? `${FileSystem.documentDirectory}${MODEL_FILENAME}`
      : '';
  }

  /**
   * Get the local path where the model is stored
   */
  getModelPath(): string {
    return this.modelPath;
  }

  /**
   * Check if the model exists locally and is up to date
   */
  async isModelAvailable(): Promise<boolean> {
    if (Platform.OS === 'web' || !FileSystem) {
      return false;
    }
    
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(this.modelPath);
      if (!fileInfo.exists) {
        return false;
      }

      // Check if model version is current
      const storedVersion = await AsyncStorage.getItem(MODEL_VERSION_KEY);
      if (storedVersion !== CURRENT_MODEL_VERSION) {
        // Delete old model if version mismatch
        await FileSystem.deleteAsync(this.modelPath, { idempotent: true });
        await AsyncStorage.removeItem(MODEL_STORAGE_KEY);
        await AsyncStorage.removeItem(MODEL_VERSION_KEY);
        return false;
      }

      // Check AsyncStorage flag
      const isDownloaded = await AsyncStorage.getItem(MODEL_STORAGE_KEY);
      return isDownloaded === 'true';
    } catch (error) {
      console.error('Error checking model availability:', error);
      return false;
    }
  }

  /**
   * Download the model with progress tracking
   */
  async downloadModel(
    onProgress?: (progress: ModelDownloadProgress) => void
  ): Promise<string> {
    if (Platform.OS === 'web' || !FileSystem) {
      throw new Error('Model download not supported on web platform');
    }
    
    try {
      // Check if already downloaded
      if (await this.isModelAvailable()) {
        return this.modelPath;
      }

      console.log('Starting model download...');
      
      // Create download resumable
      const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_URL,
        this.modelPath,
        {},
        (downloadProgress: any) => {
          const progress: ModelDownloadProgress = {
            totalBytesWritten: downloadProgress.totalBytesWritten,
            totalBytesExpectedToWrite: downloadProgress.totalBytesExpectedToWrite,
            progress: downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
          };
          
          // Call progress callback
          if (onProgress) {
            onProgress(progress);
          }
          
          // Call all registered callbacks
          this.downloadCallbacks.forEach(callback => callback(progress));
        }
      );

      // Start download
      const result = await downloadResumable.downloadAsync();
      
      if (!result) {
        throw new Error('Download failed - no result returned');
      }

      // Verify file was downloaded
      const fileInfo = await FileSystem.getInfoAsync(this.modelPath);
      if (!fileInfo.exists) {
        throw new Error('Download completed but file not found');
      }

      // Mark as downloaded in AsyncStorage
      await AsyncStorage.setItem(MODEL_STORAGE_KEY, 'true');
      await AsyncStorage.setItem(MODEL_VERSION_KEY, CURRENT_MODEL_VERSION);
      
      console.log('Model download completed successfully');
      return this.modelPath;
      
    } catch (error) {
      console.error('Model download failed:', error);
      
      // Clean up partial download
      try {
        await FileSystem.deleteAsync(this.modelPath, { idempotent: true });
        await AsyncStorage.removeItem(MODEL_STORAGE_KEY);
      } catch (cleanupError) {
        console.error('Error cleaning up failed download:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * Register a progress callback
   */
  onProgress(callback: (progress: ModelDownloadProgress) => void): () => void {
    this.downloadCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.downloadCallbacks.indexOf(callback);
      if (index > -1) {
        this.downloadCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get model file size for progress calculation
   */
  async getModelSize(): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.modelPath);
      return fileInfo.exists ? (fileInfo.size || 0) : 0;
    } catch (error) {
      console.error('Error getting model size:', error);
      return 0;
    }
  }

  /**
   * Delete the downloaded model
   */
  async deleteModel(): Promise<void> {
    if (Platform.OS === 'web' || !FileSystem) {
      throw new Error('Model deletion not supported on web platform');
    }
    
    try {
      await FileSystem.deleteAsync(this.modelPath, { idempotent: true });
      await AsyncStorage.removeItem(MODEL_STORAGE_KEY);
      await AsyncStorage.removeItem(MODEL_VERSION_KEY);
      console.log('Model deleted successfully');
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const modelDownloadService = new ModelDownloadService();
export default modelDownloadService;