import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

// Gemini AI service for proctoring analysis
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ViolationAnalysis {
  severity: 'critical' | 'major' | 'minor';
  confidence: number;
  description: string;
  recommendations: string[];
  suspiciousActivities: string[];
}

export interface VideoAnalysis {
  overallSuspicion: number; // 0-100 scale
  violations: ViolationAnalysis[];
  timeline: Array<{
    timestamp: number;
    activity: string;
    severity: 'critical' | 'major' | 'minor';
  }>;
  summary: string;
}

export async function analyzeViolationImage(imagePath: string, context: string): Promise<ViolationAnalysis> {
  try {
    const imageBytes = fs.readFileSync(imagePath);

    const prompt = `
    You are an expert proctoring AI analyzing exam security footage. Analyze this image for potential violations.
    
    Context: ${context}
    
    Look for:
    1. Multiple people in frame
    2. No face visible or face turned away
    3. Suspicious hand movements (writing, using devices)
    4. Unauthorized materials (books, phones, notes)
    5. Looking away from screen for extended periods
    6. Signs of communication with others
    
    Provide analysis in JSON format with:
    - severity: "critical", "major", or "minor"
    - confidence: number 0-1
    - description: brief description of what you see
    - recommendations: array of suggested actions
    - suspiciousActivities: array of specific activities detected
    `;

    const contents = [
      {
        inlineData: {
          data: imageBytes.toString("base64"),
          mimeType: "image/jpeg",
        },
      },
      prompt,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["critical", "major", "minor"] },
            confidence: { type: "number" },
            description: { type: "string" },
            recommendations: { type: "array", items: { type: "string" } },
            suspiciousActivities: { type: "array", items: { type: "string" } }
          },
          required: ["severity", "confidence", "description", "recommendations", "suspiciousActivities"]
        }
      },
      contents: contents,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Gemini analysis error:", error);
    // Fallback analysis
    return {
      severity: 'minor',
      confidence: 0.1,
      description: 'Analysis failed - manual review required',
      recommendations: ['Review manually', 'Check system logs'],
      suspiciousActivities: ['Analysis error']
    };
  }
}

export async function analyzeVideoRecording(videoPath: string, examContext: string): Promise<VideoAnalysis> {
  try {
    // Convert URL path to actual file path
    let actualPath = videoPath;
    if (videoPath.startsWith('/api/videos/proctoring/')) {
      const filename = videoPath.split('/').pop();
      actualPath = `uploads/proctoring/${filename}`;
    } else if (videoPath.startsWith('/api/videos/answers/')) {
      const filename = videoPath.split('/').pop();
      actualPath = `uploads/videos/${filename}`;
    }
    
    console.log(`Analyzing video: ${videoPath} -> ${actualPath}`);
    
    if (!fs.existsSync(actualPath)) {
      throw new Error(`Video file not found: ${actualPath}`);
    }
    
    const videoBytes = fs.readFileSync(actualPath);
    
    // Determine MIME type based on file extension
    const isWebm = actualPath.toLowerCase().endsWith('.webm');
    const mimeType = isWebm ? "video/webm" : "video/mp4";
    
    // Check file size - Gemini has limits on video size
    const fileSizeInMB = videoBytes.length / (1024 * 1024);
    console.log(`Video file size: ${fileSizeInMB.toFixed(2)}MB, MIME type: ${mimeType}`);
    
    if (fileSizeInMB > 20) {
      throw new Error(`Video file too large (${fileSizeInMB.toFixed(2)}MB). Maximum size is 20MB.`);
    }

    const prompt = `
    You are an expert exam proctoring AI analyzing a video recording of a student taking an exam.
    
    Exam Context: ${examContext}
    
    Analyze this video for:
    1. Student behavior patterns
    2. Potential cheating activities
    3. Unauthorized materials or devices
    4. Communication attempts
    5. Suspicious movements or actions
    6. Adherence to exam protocols
    
    Provide detailed analysis in JSON format with:
    - overallSuspicion: number 0-100 (overall suspicion level)
    - violations: array of violation objects
    - timeline: array of timestamped activities
    - summary: comprehensive summary of findings
    `;

    const contents = [
      {
        inlineData: {
          data: videoBytes.toString("base64"),
          mimeType: mimeType,
        },
      },
      prompt,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            overallSuspicion: { type: "number" },
            violations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["critical", "major", "minor"] },
                  confidence: { type: "number" },
                  description: { type: "string" },
                  recommendations: { type: "array", items: { type: "string" } },
                  suspiciousActivities: { type: "array", items: { type: "string" } }
                }
              }
            },
            timeline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  timestamp: { type: "number" },
                  activity: { type: "string" },
                  severity: { type: "string", enum: ["critical", "major", "minor"] }
                }
              }
            },
            summary: { type: "string" }
          },
          required: ["overallSuspicion", "violations", "timeline", "summary"]
        }
      },
      contents: contents,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error: any) {
    console.error("Gemini video analysis error:", error);
    
    // Handle quota exceeded specifically
    if (error.status === 429) {
      return {
        overallSuspicion: 15,
        violations: [{
          severity: 'minor' as const,
          confidence: 0.8,
          description: 'AI analysis temporarily unavailable due to quota limits',
          recommendations: ['Video has been recorded and is available for manual review', 'Try AI analysis again later when quota resets'],
          suspiciousActivities: ['Quota limit reached - manual review recommended']
        }],
        timeline: [{
          timestamp: Date.now(),
          activity: 'AI analysis quota exceeded',
          severity: 'minor' as const
        }],
        summary: "Video successfully recorded and ready for review. AI analysis temporarily unavailable due to quota limits. Your recordings are saved and can be manually reviewed or analyzed later when quotas reset."
      };
    }
    
    // Handle internal server errors for screen recordings
    if (error.status === 500 && videoPath.includes('screen_')) {
      return {
        overallSuspicion: 10,
        violations: [{
          severity: 'minor' as const,
          confidence: 0.7,
          description: 'Screen recording detected but AI analysis temporarily unavailable',
          recommendations: [
            'Screen recording successfully captured and stored',
            'Video can be manually reviewed by exam proctor',
            'Consider using camera recording for AI analysis'
          ],
          suspiciousActivities: ['Screen recording available for manual review']
        }],
        timeline: [{
          timestamp: Date.now(),
          activity: 'Screen recording captured',
          severity: 'minor' as const
        }],
        summary: "Screen recording successfully captured. AI analysis of screen recordings is temporarily limited due to processing constraints. The video is saved and available for manual review by proctors."
      };
    }
    
    // Fallback analysis for other errors
    return {
      overallSuspicion: 0,
      violations: [],
      timeline: [],
      summary: 'Video analysis failed - manual review required'
    };
  }
}

export async function generateViolationReport(violations: any[], examInfo: any): Promise<string> {
  try {
    const prompt = `
    Generate a comprehensive proctoring violation report for an exam.
    
    Exam Information:
    - Title: ${examInfo.title}
    - Duration: ${examInfo.duration} minutes
    - Student: ${examInfo.studentName || 'Unknown'}
    
    Violations Detected:
    ${JSON.stringify(violations, null, 2)}
    
    Create a professional report that includes:
    1. Executive summary
    2. Violation breakdown by severity
    3. Timeline of incidents
    4. Risk assessment
    5. Recommendations for action
    
    Format as a clear, professional report suitable for academic review.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Report generation failed";
  } catch (error) {
    console.error("Report generation error:", error);
    return "Failed to generate violation report. Please review violations manually.";
  }
}

export async function analyzeArabicAudioTranscription(audioData: string): Promise<{
  transcript: string;
  confidence: number;
  languageDetected: string;
  suspiciousContent: boolean;
  analysis: string;
}> {
  try {
    const prompt = `
    Analyze this Arabic audio transcription from an exam response. 
    
    Audio Data: ${audioData}
    
    Evaluate:
    1. Language accuracy and fluency
    2. Content relevance to exam context
    3. Potential signs of cheating (reading from notes, communication with others)
    4. Quality and authenticity of response
    
    Provide analysis in JSON format.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            transcript: { type: "string" },
            confidence: { type: "number" },
            languageDetected: { type: "string" },
            suspiciousContent: { type: "boolean" },
            analysis: { type: "string" }
          },
          required: ["transcript", "confidence", "languageDetected", "suspiciousContent", "analysis"]
        }
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error) {
    console.error("Arabic audio analysis error:", error);
    return {
      transcript: "Analysis failed",
      confidence: 0,
      languageDetected: "unknown",
      suspiciousContent: false,
      analysis: "Audio analysis failed - manual review required"
    };
  }
}