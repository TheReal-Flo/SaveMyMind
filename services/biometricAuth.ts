import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export interface BiometricCapabilities {
  isAvailable: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  isEnrolled: boolean;
}

export class BiometricAuthService {
  /**
   * Check if biometric authentication is available on the device
   */
  static async checkCapabilities(): Promise<BiometricCapabilities> {
    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      return {
        isAvailable,
        supportedTypes,
        isEnrolled,
      };
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      return {
        isAvailable: false,
        supportedTypes: [],
        isEnrolled: false,
      };
    }
  }

  /**
   * Get user preference for biometric authentication
   */
  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error getting biometric preference:', error);
      return false;
    }
  }

  /**
   * Set user preference for biometric authentication
   */
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled.toString());
    } catch (error) {
      console.error('Error setting biometric preference:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with biometrics
   */
  static async authenticate(reason?: string): Promise<LocalAuthentication.LocalAuthenticationResult> {
    try {
      const capabilities = await this.checkCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'not_available',
        };
      }

      if (!capabilities.isEnrolled) {
        return {
          success: false,
          error: 'not_enrolled',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || 'Authenticate to access SaveMyMind',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
      });

      return result;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return {
        success: false,
        error: 'unknown',
      };
    }
  }

  /**
   * Get human-readable authentication type names
   */
  static getAuthenticationTypeNames(types: LocalAuthentication.AuthenticationType[]): string[] {
    const typeNames: string[] = [];
    
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      typeNames.push('Fingerprint');
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      typeNames.push('Face ID');
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      typeNames.push('Iris');
    }
    
    return typeNames;
  }

  /**
   * Get error message for authentication errors
   */
  static getErrorMessage(error: string): string {
    switch (error) {
      case 'not_available':
        return 'Biometric authentication is not available on this device.';
      case 'not_enrolled':
        return 'No biometric data is enrolled on this device. Please set up Face ID, Touch ID, or fingerprint in your device settings.';
      case 'user_cancel':
        return 'Authentication was cancelled by the user.';
      case 'system_cancel':
        return 'Authentication was cancelled by the system.';
      case 'lockout':
        return 'Too many failed attempts. Please try again later.';
      case 'authentication_failed':
        return 'Authentication failed. Please try again.';
      case 'passcode_not_set':
        return 'Device passcode is not set. Please set up a passcode in your device settings.';
      default:
        return 'An unknown error occurred during authentication.';
    }
  }
}