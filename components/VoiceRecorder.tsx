import { Platform } from 'react-native';



// Platform-specific imports
let VoiceRecorder: any;

if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  VoiceRecorder = require('./VoiceRecorder.web').default;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  VoiceRecorder = require('./VoiceRecorder.native').default;
}

export default VoiceRecorder;