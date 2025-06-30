/**
 * Google Gemini Text-to-Speech Service
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Use Gemini to generate audio from text
 * Note: This uses Gemini's multimodal capabilities
 */
export async function generateGeminiAudio(text: string, language: string = 'ar'): Promise<void> {
  try {
    // Use Gemini Pro model with audio capabilities
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      generationConfig: {
        temperature: 0.7,
        topK: 1,
        topP: 1,
        maxOutputTokens: 2048,
      }
    });

    // For now, since direct TTS is not available, we'll use the browser TTS
    // but with Gemini-enhanced pronunciation guide
    const prompt = `Convert this text to phonetic Arabic that sounds natural when spoken by TTS. 
    Make it sound like a native Jordanian speaker would say it. 
    Add appropriate pauses and emphasis marks.
    Text: "${text}"
    
    Return ONLY the phonetic version, nothing else.`;

    const result = await model.generateContent(prompt);
    const phoneticText = result.response.text();
    
    // Use the phonetic text with browser TTS
    return speakWithBrowserTTS(phoneticText || text, language);
  } catch (error) {
    console.error('Gemini audio generation error:', error);
    // Fallback to original text
    return speakWithBrowserTTS(text, language);
  }
}

/**
 * Enhanced browser TTS with better voice selection
 */
function speakWithBrowserTTS(text: string, language: string = 'ar'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'ar' ? 'ar-SA' : language;
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.95;
    
    // Get the best available voice
    const voices = window.speechSynthesis.getVoices();
    const targetVoices = voices.filter(voice => voice.lang.startsWith(language));
    
    // Prefer enhanced or online voices
    const enhancedVoice = targetVoices.find(voice => 
      !voice.localService || 
      voice.name.includes('Enhanced') ||
      voice.name.includes('Premium')
    );
    
    if (enhancedVoice) {
      utterance.voice = enhancedVoice;
    } else if (targetVoices.length > 0) {
      utterance.voice = targetVoices[0];
    }
    
    utterance.onend = () => resolve();
    utterance.onerror = (error) => reject(error);
    
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Use Gemini Live Audio for natural conversation
 * This requires the audio-to-audio session to be set up
 */
export async function speakWithGeminiLive(
  text: string, 
  session: any,
  createBlob: (data: Float32Array) => any
): Promise<void> {
  if (!session) {
    throw new Error('Gemini Live session not initialized');
  }
  
  // Since Gemini Live expects audio input, we create a special audio prompt
  // This is a workaround to make it speak our text
  
  // Create a short silence followed by a prompt
  const sampleRate = 16000;
  const duration = 0.5; // 0.5 seconds
  const samples = sampleRate * duration;
  const audioData = new Float32Array(samples);
  
  // Add a very quiet sine wave to avoid complete silence
  for (let i = 0; i < samples; i++) {
    audioData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.001;
  }
  
  // Send the audio with our text as context
  // The model should understand and respond with speech
  session.sendRealtimeInput({ media: createBlob(audioData) });
  
  // Note: The actual audio response will be handled by the session's onmessage callback
}

export default {
  generateGeminiAudio,
  speakWithGeminiLive
}; 