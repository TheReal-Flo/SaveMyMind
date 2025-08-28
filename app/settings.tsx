import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotes } from '../hooks/useNotes';
import { BiometricAuthService, BiometricCapabilities } from '../services/biometricAuth';

const Settings = () => {
  const { deleteAllNotes } = useNotes();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricCapabilities, setBiometricCapabilities] = useState<BiometricCapabilities>({
    isAvailable: false,
    supportedTypes: [],
    isEnrolled: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeBiometricSettings();
  }, []);

  const initializeBiometricSettings = async () => {
    try {
      const capabilities = await BiometricAuthService.checkCapabilities();
      const enabled = await BiometricAuthService.isBiometricEnabled();
      
      setBiometricCapabilities(capabilities);
      setBiometricEnabled(enabled && capabilities.isAvailable && capabilities.isEnrolled);
    } catch (error) {
      console.error('Error initializing biometric settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Enabling biometric auth - require authentication first
      const result = await BiometricAuthService.authenticate(
        'Authenticate to enable biometric security for SaveMyMind'
      );
      
      if (result.success) {
        try {
          await BiometricAuthService.setBiometricEnabled(true);
          setBiometricEnabled(true);
          Alert.alert('Success', 'Biometric authentication has been enabled.');
        } catch {
           Alert.alert('Error', 'Failed to enable biometric authentication');
         }
      } else if (result.error) {
        const errorMessage = BiometricAuthService.getErrorMessage(result.error);
        Alert.alert('Authentication Failed', errorMessage);
      }
    } else {
      // Disabling biometric auth
      Alert.alert(
        'Disable Biometric Authentication',
        'Are you sure you want to disable biometric authentication?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              try {
                await BiometricAuthService.setBiometricEnabled(false);
                setBiometricEnabled(false);
                Alert.alert('Success', 'Biometric authentication has been disabled.');
              } catch {
                Alert.alert('Error', 'Failed to disable biometric authentication.');
              }
            },
          },
        ]
      );
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Thoughts',
      'Are you sure you want to delete all thoughts? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllNotes();
              Alert.alert('Success', 'All thoughts have been deleted.');
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to delete thoughts. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>
                {biometricCapabilities.isAvailable && biometricCapabilities.isEnrolled
                  ? `Use ${BiometricAuthService.getAuthenticationTypeNames(biometricCapabilities.supportedTypes).join(' or ')} to secure your notes`
                  : biometricCapabilities.isAvailable
                  ? 'Set up biometric authentication in your device settings first'
                  : 'Biometric authentication is not available on this device'
                }
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              disabled={loading || !biometricCapabilities.isAvailable || !biometricCapabilities.isEnrolled}
              trackColor={{ false: '#e0e0e0', true: '#007AFF' }}
              thumbColor={biometricEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAll}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Delete All Thoughts</Text>
          </TouchableOpacity>
          
          <Text style={styles.warningText}>
            This will permanently delete all your thoughts. This action cannot be undone.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});

export default Settings;