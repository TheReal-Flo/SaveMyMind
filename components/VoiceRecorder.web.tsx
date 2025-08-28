import React from 'react';

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  disabled?: boolean;
}

// Web version - voice recording not supported
const VoiceRecorder: React.FC<VoiceRecorderProps> = () => {
  return null;
};

export default VoiceRecorder;