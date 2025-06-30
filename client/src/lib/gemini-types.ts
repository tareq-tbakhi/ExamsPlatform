/**
 * Type definitions for Google Gemini Live Audio API
 * @license SPDX-License-Identifier: Apache-2.0
 */

export enum Modality {
  AUDIO = 'AUDIO',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE'
}

export interface Blob {
  data: string;
  mimeType: string;
}

export interface LiveServerMessage {
  serverContent?: {
    modelTurn?: {
      parts: Array<{
        inlineData?: {
          mimeType: string;
          data: string; // base64 encoded
        };
        text?: string;
      }>;
    };
    interrupted?: boolean;
  };
}

export interface SpeechConfig {
  voiceConfig?: {
    prebuiltVoiceConfig?: {
      voiceName: string;
    };
  };
  languageCode?: string;
}

export interface LiveConfig {
  responseModalities: Modality[];
  speechConfig?: SpeechConfig;
}

export interface ConnectConfig {
  model: string;
  callbacks: {
    onopen?: () => void;
    onmessage?: (message: LiveServerMessage) => Promise<void>;
    onerror?: (error: ErrorEvent) => void;
    onclose?: (event: CloseEvent) => void;
  };
  config?: LiveConfig;
}

export interface Session {
  sendRealtimeInput: (input: { media: Blob }) => void;
  close: () => void;
}

export interface Live {
  connect: (config: ConnectConfig) => Promise<Session>;
}

export interface GoogleGenAI {
  live: Live;
} 