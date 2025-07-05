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
  onAutoStartRecording?: () => void;
  onAutoStopRecording?: () => void;
  autoStartRecording?: boolean;
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
  onAutoStartRecording,
  onAutoStopRecording,
  autoStartRecording = true,
  savedAnswer
}: AudioQuestionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isPlayingQuestion, setIsPlayingQuestion] = useState(false);
  
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
  const autoRecordingStarted = useRef(false);
  
  useEffect(() => {
    initAudio();
    initClient();
    
    return () => {
      // Auto-stop recording when component unmounts (navigation)
      if (isRecording && onAutoStopRecording) {
        stopRecording();
        onAutoStopRecording();
      }
      
      if (sessionRef.current) {
        sessionRef.current.close();
      }
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Auto-play question when component mounts or question changes
  useEffect(() => {
    if (questionText && !hasSpokenQuestion.current) {
      hasSpokenQuestion.current = true;
      // Wait a bit for audio context to be ready
      setTimeout(() => {
        speakQuestionWithGoogleTTS(questionText);
      }, 1000);
    }
  }, [questionText, questionId]);

  // Reset when question changes
  useEffect(() => {
    hasSpokenQuestion.current = false;
    autoRecordingStarted.current = false;
    transcriptRef.current = '';
    setIsRecording(false);
    setStatus('');
    setError('');
  }, [questionId]);

  const speakQuestionWithGoogleTTS = async (text: string) => {
    setIsPlayingQuestion(true);
    updateStatus('🔊 Playing question with natural Arabic voice...');
    
    console.log('Using Google TTS for question playback');
    
    try {
      // Use Google TTS exclusively
      await playGoogleTTS(text, DEFAULT_VOICE_CONFIG);
      console.log('Google TTS completed successfully');
      updateStatus('🎤 Question completed. Recording will start automatically...');
      
      // Auto-start recording after question playback with delay
      if (autoStartRecording && !autoRecordingStarted.current) {
        setTimeout(() => {
          startRecordingAuto();
        }, 1500); // 1.5 second delay after question ends
      } else {
        updateStatus('🎤 Ready to record your answer');
      }
      
    } catch (error) {
      console.error('Google TTS failed:', error);
      updateError('Failed to play question. Please use the replay button.');
    } finally {
      setIsPlayingQuestion(false);
    }
  };

  const initAudio = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    inputAudioContext.current = new AudioContextClass();
    outputAudioContext.current = new AudioContextClass();

    const inputGain = inputAudioContext.current.createGain();
    const outputGain = outputAudioContext.current.createGain();
    
    setInputNode(inputGain);
    setOutputNode(outputGain);
  };

  const initClient = async () => {
    try {
      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
      if (!API_KEY) {
        console.warn('No Gemini API key found');
        return;
      }

      // Import @google/generative-ai dynamically
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      
      // Create mock GoogleGenAI interface for now
      clientRef.current = {
        live: {
          connect: async (config) => {
            // For now, return a mock session
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
            
            return mockSession;
          }
        }
      };
      
      await initSession();
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
    }
  };

  const initSession = async () => {
    if (!clientRef.current) return;

    try {
      sessionRef.current = await clientRef.current.live.connect({
        model: 'models/gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            updateStatus('Connected to Gemini');
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              const parts = message.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.text) {
                  transcriptRef.current += part.text;
                  console.log('Transcription:', part.text);
                }
              }
            }

            if (message.serverContent?.interrupted) {
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
            updateStatus('Session closed: ' + e.reason);
          },
        },
        config: {
          responseModalities: ['AUDIO' as Modality],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aouf' } }, // Arabic voice
          },
        },
      });
    } catch (e) {
      console.error('Failed to initialize session:', e);
    }
  };

  const updateStatus = (msg: string) => {
    setStatus(msg);
    setError('');
  };

  const updateError = (msg: string) => {
    setError(msg);
    setStatus('');
  };

  const startRecordingAuto = async () => {
    if (isRecording || autoRecordingStarted.current) {
      return;
    }

    autoRecordingStarted.current = true;
    await startRecording();
    
    if (onAutoStartRecording) {
      onAutoStartRecording();
    }
  };

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    inputAudioContext.current.resume();
    updateStatus('🎤 Starting recording...');

    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      updateStatus('🔴 Recording your answer...');
      setIsRecording(true);

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

      // Initialize browser speech recognition for transcription
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ar-SA'; // Arabic language
        recognition.maxAlternatives = 3;
        
        recognition.onstart = () => {
          console.log('Speech recognition started');
          updateStatus('🔴 Recording and transcribing...');
        };
        
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript + ' ';
            } else {
              interimTranscript += result[0].transcript;
            }
          }
          
          if (finalTranscript) {
            transcriptRef.current += finalTranscript;
            console.log('Final transcript:', finalTranscript);
          }
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          updateStatus('🔴 Recording (transcription unavailable)...');
        };
        
        recognition.onend = () => {
          console.log('Speech recognition ended');
        };
        
        try {
          recognition.start();
        } catch (error) {
          console.error('Failed to start speech recognition:', error);
          updateStatus('🔴 Recording (transcription unavailable)...');
        }
      } else {
        console.warn('Speech recognition not supported');
        updateStatus('🔴 Recording (transcription unavailable)...');
      }

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

      scriptProcessorNode.current.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        if (sessionRef.current) {
          const geminiBlob = createBlob(inputData);
          if (geminiBlob.data && geminiBlob.mimeType) {
            sessionRef.current.sendRealtimeInput({ 
              media: {
                data: geminiBlob.data,
                mimeType: geminiBlob.mimeType
              }
            });
          }
        }
      };

      sourceNode.current.connect(scriptProcessorNode.current);
      scriptProcessorNode.current.connect(inputAudioContext.current.destination);

    } catch (error) {
      console.error("Recording error:", error);
      updateError("Failed to start recording. Please check microphone permissions.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;

    updateStatus('⏹️ Stopping recording...');
    setIsRecording(false);

    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    if (sourceNode.current) {
      sourceNode.current.disconnect();
    }
    if (scriptProcessorNode.current) {
      scriptProcessorNode.current.disconnect();
    }
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
    }

    updateStatus('✅ Recording completed and saving...');
  };

  const reset = () => {
    stopRecording();
    transcriptRef.current = '';
    autoRecordingStarted.current = false;
    hasSpokenQuestion.current = false;
    updateStatus('🔄 Session reset');
    
    // Replay question after reset
    setTimeout(() => {
      speakQuestionWithGoogleTTS(questionText);
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
        updateStatus("✅ Answer saved successfully!");
      } else {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      updateError("Failed to save your audio answer. Please try again.");
    }
  };

  // Manual replay question button
  const replayQuestion = () => {
    speakQuestionWithGoogleTTS(questionText);
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
      {/* 3D Audio Visualizer Background */}
      <div className="absolute inset-0 z-0">
        <GdmLiveAudioVisuals3D inputNode={inputNode} outputNode={outputNode} />
      </div>
      
      {/* Main Content Overlay */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 p-6 bg-gradient-to-r from-black/40 to-transparent backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Audio Question {questionNumber}</h2>
                <p className="text-blue-200 text-sm">Auto-recording after question playback</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isPlayingQuestion ? 'bg-yellow-500 animate-pulse' :
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'
              }`}></div>
              <span className="text-white text-sm font-medium">
                {isPlayingQuestion ? 'Playing Question...' :
                 isRecording ? 'Recording...' : 'Ready'}
              </span>
            </div>
          </div>
        </div>

        {/* Question Display */}
        <div className="flex-1 flex flex-col justify-center items-center p-8">
          <div className="max-w-4xl w-full">
            {/* Question Text Card */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/20 shadow-2xl">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-white mb-4 leading-relaxed">
                    {questionText}
                  </h3>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={replayQuestion}
                      disabled={isRecording || isPlayingQuestion}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      <span>Replay Question</span>
                    </button>
                    <div className="text-blue-200 text-sm">
                      🎧 Recording starts automatically after playback
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center items-center space-x-8">
              {/* Manual Start Recording Button */}
              <button
                onClick={startRecording}
                disabled={isRecording || isPlayingQuestion}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
                  isRecording || isPlayingQuestion
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-red-500/30'
                }`}
                title="Start recording manually"
              >
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v6a1 1 0 11-2 0V7z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Stop Recording Button */}
              <button
                onClick={stopRecording}
                disabled={!isRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
                  !isRecording 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 shadow-lg hover:shadow-gray-500/30'
                }`}
                title="Stop recording"
              >
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Reset Button */}
              <button
                onClick={reset}
                disabled={isRecording || isPlayingQuestion}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 flex items-center justify-center transition-all duration-300 transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-500/30"
                title="Reset and replay question"
              >
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-8 text-center">
              <div className="bg-blue-500/20 backdrop-blur-sm rounded-lg p-4 border border-blue-400/30">
                <p className="text-blue-200 text-sm">
                  🤖 <strong>Auto-Recording:</strong> Recording will start automatically 1.5 seconds after the question finishes playing. You can also start/stop manually using the buttons above.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex-shrink-0 p-4 bg-gradient-to-r from-black/40 to-transparent backdrop-blur-sm">
          <div className="flex items-center justify-center">
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              error 
                ? 'bg-red-500/20 text-red-300 border border-red-400/30' 
                : 'bg-green-500/20 text-green-300 border border-green-400/30'
            }`}>
              {error || status || 'Ready to play question and auto-record your answer'}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Answer Indicator */}
      {savedAnswer?.transcript && (
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-green-500/20 backdrop-blur-sm rounded-lg p-3 border border-green-400/30">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span className="text-green-300 text-sm font-medium">Answer Saved</span>
            </div>
            <p className="text-green-200 text-xs mt-1 max-w-xs truncate">
              "{savedAnswer.transcript}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 