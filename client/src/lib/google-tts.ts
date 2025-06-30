/**
 * Google Cloud Text-to-Speech integration for natural Arabic voices
 */

const GOOGLE_TTS_API_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY || '';
const TTS_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// Default voice configuration - ar-XA-Standard-B (Male Standard voice)
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  languageCode: 'ar-XA',
  name: 'ar-XA-Standard-B',  // Perfect male standard voice
  ssmlGender: 'MALE'
};

export interface VoiceConfig {
  languageCode: string;
  name?: string;
  ssmlGender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
}

export interface AudioConfig {
  audioEncoding: 'MP3' | 'OGG_OPUS' | 'LINEAR16';
  speakingRate?: number;
  pitch?: number;
  volumeGainDb?: number;
}

export async function synthesizeSpeech(
  text: string,
  voiceConfig: VoiceConfig = DEFAULT_VOICE_CONFIG,
  audioConfig: AudioConfig = {
    audioEncoding: 'MP3',
    speakingRate: 0.95,
    pitch: 0,
    volumeGainDb: 0
  }
): Promise<string> {
  console.log('synthesizeSpeech called');
  console.log('Text to speak:', text.substring(0, 50) + '...');
  console.log('Voice config:', JSON.stringify(voiceConfig, null, 2));

  try {
    // Use backend endpoint to avoid CORS issues
    const response = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        text,
        voiceConfig,
        audioConfig
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google TTS API Error:', errorData);
      
      // Include status in error message for proper handling
      const error = new Error(errorData.error || `TTS API error: ${response.status} ${response.statusText}`);
      if (response.status === 403) {
        error.message = `403: ${errorData.error || 'API not enabled'}`;
      }
      throw error;
    }

    const data = await response.json();
    return data.audioContent; // Base64 encoded audio
  } catch (error) {
    console.error('Google TTS request failed:', error);
    throw error;
  }
}

// Available high-quality Arabic voices
export const ARABIC_VOICES = {
  // Standard Arabic voices (most natural)
  FEMALE_STANDARD: { languageCode: 'ar-XA', name: 'ar-XA-Standard-A', ssmlGender: 'FEMALE' as const },
  MALE_STANDARD: { languageCode: 'ar-XA', name: 'ar-XA-Standard-B', ssmlGender: 'MALE' as const },
  
  // WaveNet voices (highest quality)
  FEMALE_WAVENET: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-C', ssmlGender: 'FEMALE' as const },
  MALE_WAVENET: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-D', ssmlGender: 'MALE' as const },
};

export async function playGoogleTTS(text: string, voiceConfig?: VoiceConfig): Promise<void> {
  try {
    console.log('playGoogleTTS called with text:', text.substring(0, 50) + '...');
    console.log('Voice config:', voiceConfig);
    
    const audioContent = await synthesizeSpeech(text, voiceConfig || DEFAULT_VOICE_CONFIG);
    console.log('Audio content received, length:', audioContent.length);
    
    // Convert base64 to audio and play
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    audio.volume = 0.95;
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        console.log('Audio playback completed');
        resolve();
      };
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        reject(e);
      };
      audio.oncanplaythrough = () => {
        console.log('Audio ready to play');
      };
      audio.play().then(() => {
        console.log('Audio playback started');
      }).catch(err => {
        console.error('Failed to start audio playback:', err);
        reject(err);
      });
    });
  } catch (error: any) {
    console.error('Google TTS error:', error);
    
    // If it's a 403 error, provide specific instructions
    if (error.message?.includes('403') || error.message?.includes('not enabled')) {
      const helpMessage = `
Google Text-to-Speech API is not enabled for your API key.

To fix this:
1. Go to: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
2. Click "Enable" button
3. Wait 2-3 minutes for it to activate
4. Try again

Your API key: ${import.meta.env.VITE_GOOGLE_TTS_API_KEY?.substring(0, 10)}...
      `;
      console.error(helpMessage);
      alert(helpMessage);
    }
    
    throw error;
  }
}

// Enhanced browser TTS with better Arabic support
async function enhancedBrowserTTS(text: string, language: string = 'ar-SA'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    window.speechSynthesis.cancel();
    
    // Pre-process Arabic text for better pronunciation
    let processedText = text;
    if (language.startsWith('ar')) {
      // Add slight pauses for better rhythm
      processedText = text
        .replace(/؟/g, '؟ ... ')  // Add pause after question marks
        .replace(/\./g, '. ... ')  // Add pause after periods
        .replace(/،/g, '، ');      // Add slight pause after commas
    }
    
    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.lang = language;
    
    // Optimized settings for more natural sound
    utterance.rate = 0.85;    // Slower for clarity
    utterance.pitch = 1.05;   // Slightly higher pitch
    utterance.volume = 0.95;  // Comfortable volume
    
    // Get the best available voice
    const voices = window.speechSynthesis.getVoices();
    const targetVoices = voices.filter(voice => voice.lang.startsWith(language.substring(0, 2)));
    
    // Prioritize voices by quality indicators
    const voiceScores = targetVoices.map(voice => ({
      voice,
      score: (
        (voice.name.includes('Google') ? 10 : 0) +
        (voice.name.includes('Microsoft') ? 8 : 0) +
        (voice.name.includes('Premium') ? 6 : 0) +
        (voice.name.includes('Enhanced') ? 4 : 0) +
        (!voice.localService ? 2 : 0) +
        (voice.name.includes('Female') ? 1 : 0)
      )
    }));
    
    voiceScores.sort((a, b) => b.score - a.score);
    
    if (voiceScores.length > 0) {
      utterance.voice = voiceScores[0].voice;
      console.log('Using enhanced browser voice:', voiceScores[0].voice.name, 'Score:', voiceScores[0].score);
    }
    
    utterance.onend = () => {
      console.log('Enhanced browser TTS completed');
      resolve();
    };
    
    utterance.onerror = (error) => {
      console.error('Enhanced browser TTS error:', error);
      reject(error);
    };
    
    window.speechSynthesis.speak(utterance);
  });
} 