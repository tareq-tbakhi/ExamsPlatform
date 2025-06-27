import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration?: number;
  wordCount: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
}

export interface AudioAnalysisResult extends TranscriptionResult {
  sentiment: {
    score: number; // -1 to 1 (negative to positive)
    confidence: number;
  };
  keywords: string[];
  summary: string;
  quality: {
    clarity: number; // 0-100
    volume: number; // 0-100
    backgroundNoise: number; // 0-100
  };
}

export class TranscriptionService {
  
  /**
   * Transcribe audio file using Gemini AI
   */
  async transcribeAudio(audioPath: string, language: string = "ar"): Promise<AudioAnalysisResult> {
    try {
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      const audioBytes = fs.readFileSync(audioPath);
      const fileSize = (audioBytes.length / (1024 * 1024)).toFixed(2); // MB
      
      console.log(`Transcribing audio file: ${path.basename(audioPath)} (${fileSize}MB)`);

      // Use Gemini for audio transcription and analysis
      const contents = [
        {
          inlineData: {
            data: audioBytes.toString("base64"),
            mimeType: this.getMimeType(audioPath),
          },
        },
        `Transcribe this audio file and provide detailed analysis. The audio is primarily in ${language === "ar" ? "Arabic" : "English"}.

Please provide:
1. Full transcription of the spoken content
2. Confidence score for the transcription (0-100)
3. Word count and estimated duration
4. Sentiment analysis of the content
5. Key topics and keywords mentioned
6. Audio quality assessment
7. Brief summary of the content

Respond with JSON in this format:
{
  "text": "full transcription",
  "confidence": number,
  "language": "detected language code",
  "duration": estimated_seconds,
  "wordCount": number,
  "sentiment": {
    "score": number,
    "confidence": number
  },
  "keywords": ["keyword1", "keyword2"],
  "summary": "brief content summary",
  "quality": {
    "clarity": number,
    "volume": number,
    "backgroundNoise": number
  }
}`,
      ];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
              confidence: { type: "number" },
              language: { type: "string" },
              duration: { type: "number" },
              wordCount: { type: "number" },
              sentiment: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  confidence: { type: "number" }
                }
              },
              keywords: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
              quality: {
                type: "object",
                properties: {
                  clarity: { type: "number" },
                  volume: { type: "number" },
                  backgroundNoise: { type: "number" }
                }
              }
            },
            required: ["text", "confidence", "language", "wordCount"]
          }
        },
        contents: contents,
      });

      const result = JSON.parse(response.text || "{}");
      
      console.log(`Transcription completed: ${result.wordCount} words, ${result.confidence}% confidence`);
      
      return {
        text: result.text || "",
        confidence: result.confidence || 0,
        language: result.language || language,
        duration: result.duration || 0,
        wordCount: result.wordCount || 0,
        sentiment: result.sentiment || { score: 0, confidence: 0 },
        keywords: result.keywords || [],
        summary: result.summary || "",
        quality: result.quality || { clarity: 0, volume: 0, backgroundNoise: 0 }
      };
    } catch (error) {
      console.error("Failed to transcribe audio:", error);
      return {
        text: "Transcription failed. Please check the audio file format and try again.",
        confidence: 0,
        language: language,
        duration: 0,
        wordCount: 0,
        sentiment: { score: 0, confidence: 0 },
        keywords: [],
        summary: "Failed to process audio",
        quality: { clarity: 0, volume: 0, backgroundNoise: 0 }
      };
    }
  }

  /**
   * Extract and transcribe audio from video file
   */
  async transcribeVideoAudio(videoPath: string, language: string = "ar"): Promise<AudioAnalysisResult> {
    try {
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      const videoBytes = fs.readFileSync(videoPath);
      const fileSize = (videoBytes.length / (1024 * 1024)).toFixed(2); // MB
      
      console.log(`Transcribing video audio: ${path.basename(videoPath)} (${fileSize}MB)`);

      // Use Gemini for video audio transcription
      const contents = [
        {
          inlineData: {
            data: videoBytes.toString("base64"),
            mimeType: this.getMimeType(videoPath),
          },
        },
        `Extract and transcribe the audio content from this video. The speech is primarily in ${language === "ar" ? "Arabic" : "English"}.

Please provide:
1. Full transcription of all spoken content
2. Confidence score for the transcription (0-100)
3. Word count and estimated duration
4. Sentiment analysis of the speech
5. Key topics and keywords mentioned
6. Audio quality assessment
7. Brief summary of what was discussed

Respond with JSON in this format:
{
  "text": "full transcription",
  "confidence": number,
  "language": "detected language code",
  "duration": estimated_seconds,
  "wordCount": number,
  "sentiment": {
    "score": number,
    "confidence": number
  },
  "keywords": ["keyword1", "keyword2"],
  "summary": "brief content summary",
  "quality": {
    "clarity": number,
    "volume": number,
    "backgroundNoise": number
  }
}`,
      ];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              text: { type: "string" },
              confidence: { type: "number" },
              language: { type: "string" },
              duration: { type: "number" },
              wordCount: { type: "number" },
              sentiment: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  confidence: { type: "number" }
                }
              },
              keywords: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
              quality: {
                type: "object",
                properties: {
                  clarity: { type: "number" },
                  volume: { type: "number" },
                  backgroundNoise: { type: "number" }
                }
              }
            },
            required: ["text", "confidence", "language", "wordCount"]
          }
        },
        contents: contents,
      });

      const result = JSON.parse(response.text || "{}");
      
      console.log(`Video transcription completed: ${result.wordCount} words, ${result.confidence}% confidence`);
      
      return {
        text: result.text || "",
        confidence: result.confidence || 0,
        language: result.language || language,
        duration: result.duration || 0,
        wordCount: result.wordCount || 0,
        sentiment: result.sentiment || { score: 0, confidence: 0 },
        keywords: result.keywords || [],
        summary: result.summary || "",
        quality: result.quality || { clarity: 0, volume: 0, backgroundNoise: 0 }
      };
    } catch (error) {
      console.error("Failed to transcribe video audio:", error);
      return {
        text: "Video transcription failed. Please check the video file format and try again.",
        confidence: 0,
        language: language,
        duration: 0,
        wordCount: 0,
        sentiment: { score: 0, confidence: 0 },
        keywords: [],
        summary: "Failed to process video audio",
        quality: { clarity: 0, volume: 0, backgroundNoise: 0 }
      };
    }
  }

  /**
   * Analyze transcribed text for educational assessment
   */
  async analyzeTranscriptionForGrading(
    transcription: string, 
    question: string, 
    expectedKeywords: string[] = [],
    maxScore: number = 10
  ): Promise<{
    score: number;
    feedback: string;
    keywordsCovered: string[];
    completeness: number;
    relevance: number;
    clarity: number;
  }> {
    try {
      const prompt = `Analyze this student's audio/video response for grading:

Question: ${question}
Student Response: ${transcription}
Expected Keywords: ${expectedKeywords.join(", ")}
Maximum Score: ${maxScore}

Please evaluate:
1. Content relevance to the question
2. Coverage of expected topics/keywords
3. Clarity of communication
4. Completeness of the answer
5. Overall score (0-${maxScore})

Respond with JSON:
{
  "score": number,
  "feedback": "detailed feedback explaining the grade",
  "keywordsCovered": ["covered keywords"],
  "completeness": percentage,
  "relevance": percentage,
  "clarity": percentage
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              score: { type: "number" },
              feedback: { type: "string" },
              keywordsCovered: { type: "array", items: { type: "string" } },
              completeness: { type: "number" },
              relevance: { type: "number" },
              clarity: { type: "number" }
            },
            required: ["score", "feedback"]
          }
        },
        contents: prompt
      });

      const result = JSON.parse(response.text || "{}");
      
      return {
        score: Math.min(Math.max(0, result.score || 0), maxScore),
        feedback: result.feedback || "Unable to analyze response",
        keywordsCovered: result.keywordsCovered || [],
        completeness: result.completeness || 0,
        relevance: result.relevance || 0,
        clarity: result.clarity || 0
      };
    } catch (error) {
      console.error("Failed to analyze transcription for grading:", error);
      return {
        score: 0,
        feedback: "Unable to analyze response automatically. Manual review required.",
        keywordsCovered: [],
        completeness: 0,
        relevance: 0,
        clarity: 0
      };
    }
  }

  /**
   * Get MIME type for file
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.webm': 'video/webm',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime'
    };
    
    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Get supported audio/video formats
   */
  getSupportedFormats(): { audio: string[]; video: string[] } {
    return {
      audio: ['.mp3', '.wav', '.m4a', '.webm'],
      video: ['.mp4', '.webm', '.avi', '.mov']
    };
  }
}

export const transcriptionService = new TranscriptionService();