import { useState, useEffect, useRef } from 'react';
import { createBlob, decode, decodeAudioData } from '@/lib/audio-utils';
import GdmLiveAudioVisuals3D from './visual-3d';
import type { GoogleGenAI, LiveServerMessage, Modality, Session, Blob as GeminiBlob } from '@/lib/gemini-types';
import { playGoogleTTS, DEFAULT_VOICE_CONFIG } from '@/lib/google-tts';

interface AudioQuestionProps {
  questionId: number;
  questionText: string;
  questionNumber: number;
  duration?: number;
  sessionId: string;
  audioUrl?: string; // Pre-recorded audio URL
  onAnswerSave: (transcript: string, audioUrl?: string) => void;
  savedAnswer?: {
    transcript?: string;
    audioUrl?: string;
  };
}

export default function AudioQuestionEnhanced({
  questionId,
  questionText,
  questionNumber,
  sessionId,
  audioUrl,
  onAnswerSave,
  savedAnswer
}: AudioQuestionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Audio elements
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Gemini AI
  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);
  
  // ... (rest of the Gemini setup code remains the same)
  
  useEffect(() => {
    // Auto-play question on mount
    if (audioUrl || questionText) {
      playQuestionAudio();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [questionId, audioUrl]);
  
  const playQuestionAudio = async () => {
    try {
      setIsPlaying(true);
      updateStatus('🔊 Playing question...');
      
      if (audioUrl) {
        // Play pre-recorded audio
        if (!audioRef.current) {
          audioRef.current = new Audio(audioUrl);
        }
        audioRef.current.volume = 0.95;
        audioRef.current.onended = () => {
          setIsPlaying(false);
          updateStatus('🎤 Ready to record your answer');
        };
        await audioRef.current.play();
      } else {
        // Try Google TTS first for natural voice
        try {
          await playGoogleTTS(questionText, DEFAULT_VOICE_CONFIG);
          setIsPlaying(false);
          updateStatus('🎤 Ready to record your answer');
        } catch (ttsError) {
          console.log('Google TTS not available, falling back to browser TTS');
          // Fallback to browser TTS
          playBrowserTTS(questionText);
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      updateError('Failed to play question audio');
    }
  };
  
  const playBrowserTTS = (text: string) => {
    // Your existing browser TTS code here
    // (moved from the original speakQuestion function)
  };
  
  // ... (rest of the component remains similar)
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', backgroundColor: 'black', overflow: 'hidden' }}>
      <GdmLiveAudioVisuals3D inputNode={inputNode} outputNode={outputNode} />
      
      <div className="controls">
        {/* Control buttons */}
        <button
          onClick={playQuestionAudio}
          disabled={isPlaying || isRecording}
          title="Replay question"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="40px"
            viewBox="0 -960 960 960"
            width="40px"
            fill="#ffffff"
          >
            <path d="M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z"/>
          </svg>
        </button>
        
        {/* Recording controls */}
      </div>
      
      <div id="status">{error || status}</div>
      
      {/* Styles */}
    </div>
  );
} 