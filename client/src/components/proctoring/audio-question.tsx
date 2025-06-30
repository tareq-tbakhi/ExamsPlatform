/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  onAnswerSave: (transcript: string, audioUrl?: string) => void;
  savedAnswer?: {
    transcript?: string;
    audioUrl?: string;
  };
}

declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

export default function AudioQuestion({
  questionId,
  questionText,
  questionNumber,
  sessionId,
  onAnswerSave,
  savedAnswer
}: AudioQuestionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  
  // Gemini AI
  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);
  
  // Audio contexts
  const inputAudioContext = useRef<AudioContext>(null!);
  const outputAudioContext = useRef<AudioContext>(null!);
  const [inputNode, setInputNode] = useState<GainNode | undefined>();
  const [outputNode, setOutputNode] = useState<GainNode | undefined>();
  
  // Audio processing
  const nextStartTime = useRef(0);
  const mediaStream = useRef<MediaStream | null>(null);
  const sourceNode = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNode = useRef<ScriptProcessorNode | null>(null);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  
  // Recording
  const audioChunks = useRef<globalThis.Blob[]>([]);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const transcriptRef = useRef<string>('');
  const hasSpokenQuestion = useRef(false);
  
  useEffect(() => {
    initAudio();
    initClient();
    
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
      }
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
      // Cancel any ongoing speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Speak the question automatically when component mounts or question changes
  useEffect(() => {
    if (questionText && !hasSpokenQuestion.current && sessionRef.current) {
      hasSpokenQuestion.current = true;
      // Wait a bit for audio context to be ready
      setTimeout(() => {
        speakQuestionWithGemini(questionText);
      }, 1000);
    } else if (questionText && !hasSpokenQuestion.current) {
      // If Gemini not ready, use browser TTS
      hasSpokenQuestion.current = true;
      setTimeout(() => {
        speakQuestion(questionText);
      }, 500);
    }
  }, [questionText, questionId, sessionRef.current]);

  // Reset when question changes
  useEffect(() => {
    hasSpokenQuestion.current = false;
    transcriptRef.current = '';
    setIsRecording(false);
    setStatus('');
    setError('');
  }, [questionId]);

  const speakQuestion = (text: string) => {
    // Use browser TTS for now as speaking the question
    fallbackToBrowserTTS(text);
  };
  
  const speakQuestionWithGemini = async (text: string) => {
    // Use Google Cloud TTS for natural Arabic voice
    updateStatus('🔊 جاري تشغيل السؤال بصوت طبيعي...');
    
    console.log('Attempting to use Google TTS...');
    console.log('API Key available:', !!import.meta.env.VITE_GOOGLE_TTS_API_KEY);
    
    try {
      // Try Google TTS first
      await playGoogleTTS(text, DEFAULT_VOICE_CONFIG);
      console.log('Google TTS played successfully!');
      updateStatus('🎤 جاهز لتسجيل إجابتك');
      hasSpokenQuestion.current = true;
    } catch (error) {
      console.error('Google TTS failed, falling back to browser TTS:', error);
      
      // Fallback to browser TTS
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        // Get voices and wait if needed
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          // Wait for voices to load
          await new Promise(resolve => {
            window.speechSynthesis.onvoiceschanged = () => {
              voices = window.speechSynthesis.getVoices();
              resolve(true);
            };
            // Timeout after 1 second
            setTimeout(resolve, 1000);
          });
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        
        // Find the best Arabic voice
        const arabicVoices = voices.filter(v => v.lang.startsWith('ar'));
        const premiumVoices = arabicVoices.filter(v => 
          v.name.includes('Google') || 
          v.name.includes('Microsoft') ||
          v.name.includes('Enhanced') ||
          !v.localService
        );
        
        const selectedVoice = premiumVoices[0] || arabicVoices[0];
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('Using fallback voice:', selectedVoice.name);
        }
        
        // Natural speech settings
        utterance.rate = 0.85;
        utterance.pitch = 1.05;
        utterance.volume = 0.9;
        
        utterance.onstart = () => {
          updateStatus('🔊 يتم تشغيل السؤال...');
        };
        
        utterance.onend = () => {
          updateStatus('🎤 جاهز لتسجيل إجابتك');
          hasSpokenQuestion.current = true;
        };
        
        utterance.onerror = (event) => {
          console.error('TTS Error:', event);
          updateError('فشل تشغيل السؤال. اضغط على زر الإعادة.');
        };
        
        window.speechSynthesis.speak(utterance);
      }
    }
  };
  
  const fallbackToBrowserTTS = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.95;
      
      // Try to get any Arabic voice
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(voice => voice.lang.startsWith('ar'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }
      
      utterance.onstart = () => {
        updateStatus('🔊 Playing question...');
      };
      
      utterance.onend = () => {
        updateStatus('🎤 Ready to record your answer');
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      updateError('Text-to-speech is not supported in your browser.');
    }
  };

  const initAudio = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    inputAudioContext.current = new AudioContext({ sampleRate: 16000 });
    outputAudioContext.current = new AudioContext({ sampleRate: 24000 });
    
    const inputGain = inputAudioContext.current.createGain();
    const outputGain = outputAudioContext.current.createGain();
    
    outputGain.connect(outputAudioContext.current.destination);
    
    setInputNode(inputGain);
    setOutputNode(outputGain);
    
    nextStartTime.current = outputAudioContext.current.currentTime;
  };

  const initClient = async () => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
      if (!apiKey) {
        console.warn("Gemini API key not found");
        return;
      }

      // Import @google/genai dynamically
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      
      // Create mock GoogleGenAI interface
      clientRef.current = {
        live: {
          connect: async (config) => {
            // For now, return a mock session that uses browser TTS
            // Gemini Live Audio is for audio-to-audio conversation, not TTS
            const mockSession: Session = {
              sendRealtimeInput: (input) => {
                console.log('Audio input to Gemini');
              },
              close: () => {
                console.log('Session closed');
              }
            };
            
            // Call callbacks
            if (config.callbacks.onopen) {
              config.callbacks.onopen();
            }
            
            // Set up speech recognition as a fallback
            if ('webkitSpeechRecognition' in window) {
              const SpeechRecognition = (window as any).webkitSpeechRecognition;
              const recognition = new SpeechRecognition();
              recognition.continuous = true;
              recognition.interimResults = true;
              recognition.lang = 'ar-SA';

              recognition.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                  if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                  }
                }
                if (finalTranscript) {
                  transcriptRef.current += ' ' + finalTranscript;
                }
              };
              
              // Store recognition in session for later use
              (mockSession as any).recognition = recognition;
            }
            
            return mockSession;
          }
        }
      };
      
      await initSession();
    } catch (error) {
      console.error("Failed to initialize Gemini client:", error);
    }
  };

  const initSession = async () => {
    if (!clientRef.current) return;

    const model = 'gemini-2.5-flash-preview-native-audio-dialog';

    try {
      sessionRef.current = await clientRef.current.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            updateStatus('Connected to Gemini');
            // Speak the question once connected
            if (questionText && !hasSpokenQuestion.current) {
              hasSpokenQuestion.current = true;
              speakQuestionWithGemini(questionText);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData;

            if (audio) {
              nextStartTime.current = Math.max(
                nextStartTime.current,
                outputAudioContext.current.currentTime,
              );

              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                outputAudioContext.current,
                24000,
                1,
              );
              
              const source = outputAudioContext.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode!);
              source.addEventListener('ended', () => {
                sources.current.delete(source);
                // When Gemini finishes speaking, update status
                if (sources.current.size === 0) {
                  updateStatus('🎤 Ready to record your answer');
                }
              });

              source.start(nextStartTime.current);
              nextStartTime.current = nextStartTime.current + audioBuffer.duration;
              sources.current.add(source);
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              Array.from(sources.current).forEach(source => {
                source.stop();
                sources.current.delete(source);
              });
              nextStartTime.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            updateError(e.message);
          },
          onclose: (e: CloseEvent) => {
            updateStatus('Close:' + e.reason);
          },
        },
        config: {
          responseModalities: ['AUDIO' as Modality],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aouf' } }, // Arabic voice
            // voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Orus' } }, // English voice
          },
        },
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = (msg: string) => {
    setStatus(msg);
  };

  const updateError = (msg: string) => {
    setError(msg);
  };

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    inputAudioContext.current.resume();

    updateStatus('Requesting microphone access...');

    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      updateStatus('Microphone access granted. Starting capture...');

      // Start MediaRecorder for saving audio
      const options = { mimeType: 'audio/webm;codecs=opus' };
      mediaRecorder.current = new MediaRecorder(mediaStream.current, options);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new globalThis.Blob(audioChunks.current, { type: 'audio/webm' });
        await uploadAudio(blob);
      };

      mediaRecorder.current.start(100);

      sourceNode.current = inputAudioContext.current.createMediaStreamSource(
        mediaStream.current,
      );
      sourceNode.current.connect(inputNode!);

      const bufferSize = 256;
      scriptProcessorNode.current = inputAudioContext.current.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      scriptProcessorNode.current.onaudioprocess = (audioProcessingEvent) => {
        if (!isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        if (sessionRef.current) {
          const blob = createBlob(pcmData);
          // Ensure data is always a string
          const audioData = blob.data || '';
          sessionRef.current.sendRealtimeInput({ 
            media: { 
              data: audioData,
              mimeType: blob.mimeType || 'audio/pcm;rate=16000'
            } 
          });
        }
      };

      sourceNode.current.connect(scriptProcessorNode.current);
      scriptProcessorNode.current.connect(inputAudioContext.current.destination);

      // Start speech recognition if available
      const recognition = (sessionRef.current as any)?.recognition;
      if (recognition) {
        recognition.start();
      }

      setIsRecording(true);
      updateStatus('🔴 Recording... Capturing PCM chunks.');
    } catch (err: any) {
      console.error('Error starting recording:', err);
      updateStatus(`Error: ${err.message}`);
      stopRecording();
    }
  };

  const stopRecording = () => {
    if (!isRecording && !mediaStream.current && !inputAudioContext.current)
      return;

    updateStatus('Stopping recording...');

    setIsRecording(false);

    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    if (scriptProcessorNode.current && sourceNode.current && inputAudioContext.current) {
      scriptProcessorNode.current.disconnect();
      sourceNode.current.disconnect();
    }

    scriptProcessorNode.current = null;
    sourceNode.current = null;

    // Stop speech recognition if available
    const recognition = (sessionRef.current as any)?.recognition;
    if (recognition) {
      recognition.stop();
    }

    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
    }

    updateStatus('Recording stopped. Click Start to begin again.');
  };

  const reset = () => {
    sessionRef.current?.close();
    transcriptRef.current = '';
    hasSpokenQuestion.current = false;
    initSession();
    updateStatus('Session cleared.');
    // Speak the question again after reset
    setTimeout(() => {
      speakQuestionWithGemini(questionText);
    }, 500);
  };

  const uploadAudio = async (blob: globalThis.Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, `audio_q${questionId}_${Date.now()}.webm`);
      formData.append('questionId', questionId.toString());
      formData.append('sessionId', sessionId);
      formData.append('transcript', transcriptRef.current);

      const response = await fetch("/api/upload-audio-answer", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        onAnswerSave(transcriptRef.current, data.url);
        updateStatus("Answer saved successfully!");
      } else {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      updateError("Failed to save your audio answer. Please try again.");
    }
  };

  // Replay question button
  const replayQuestion = () => {
    // Use Google TTS if available
    speakQuestionWithGemini(questionText);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', backgroundColor: 'black', overflow: 'hidden' }}>
      <GdmLiveAudioVisuals3D inputNode={inputNode} outputNode={outputNode} />
      
      <div className="controls">
        <button
          id="resetButton"
          onClick={reset}
          disabled={isRecording}
          title="Reset session"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="40px"
            viewBox="0 -960 960 960"
            width="40px"
            fill="#ffffff"
          >
            <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
          </svg>
        </button>
        
        <button
          id="startButton"
          onClick={startRecording}
          disabled={isRecording}
          title="Start recording"
        >
          <svg
            viewBox="0 0 100 100"
            width="32px"
            height="32px"
            fill="#c80000"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="50" />
          </svg>
        </button>
        
        <button
          id="stopButton"
          onClick={stopRecording}
          disabled={!isRecording}
          title="Stop recording"
        >
          <svg
            viewBox="0 0 100 100"
            width="32px"
            height="32px"
            fill="#000000"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="0" y="0" width="100" height="100" rx="15" />
          </svg>
        </button>

        {/* Replay question button */}
        <button
          id="replayButton"
          onClick={replayQuestion}
          disabled={isRecording}
          title="Replay question"
          style={{ marginTop: '20px' }}
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
        
        {/* Debug: List available voices */}
        <button
          onClick={() => {
            const voices = window.speechSynthesis.getVoices();
            const arabicVoices = voices.filter(v => 
              v.lang.startsWith('ar') || v.name.includes('Arabic')
            );
            console.log('Available Arabic voices:');
            arabicVoices.forEach(v => {
              console.log(`- ${v.name} (${v.lang}) - Local: ${v.localService}`);
            });
            if (arabicVoices.length === 0) {
              console.log('No Arabic voices found. All voices:');
              voices.forEach(v => console.log(`- ${v.name} (${v.lang})`));
            }
          }}
          title="List voices"
          style={{ marginTop: '10px', fontSize: '12px', padding: '5px 10px' }}
        >
          List Voices
        </button>
      </div>

      <div id="status">{error || status}</div>

      <style>{`
        #status {
          position: absolute;
          bottom: 5vh;
          left: 0;
          right: 0;
          z-index: 10;
          text-align: center;
          color: ${error ? '#ff4444' : '#ffffff'};
          font-size: 14px;
        }

        .controls {
          z-index: 10;
          position: absolute;
          bottom: 10vh;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 10px;
        }

        .controls button {
          outline: none;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          width: 64px;
          height: 64px;
          cursor: pointer;
          font-size: 24px;
          padding: 0;
          margin: 0;
          transition: all 0.2s ease;
        }

        .controls button:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }

        .controls button[disabled] {
          display: none;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        #status {
          animation: fade-in 0.3s ease;
        }
      `}</style>
    </div>
  );
} 