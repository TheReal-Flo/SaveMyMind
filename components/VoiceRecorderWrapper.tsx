import React from 'react';
import VoiceRecorder from './VoiceRecorder';

interface VoiceRecorderWrapperProps {
  onTranscriptionComplete: (text: string) => void;
  disabled?: boolean;
}

const VoiceRecorderWrapper: React.FC<VoiceRecorderWrapperProps> = (props) => {
  return <VoiceRecorder {...props} />;
};

export default VoiceRecorderWrapper;