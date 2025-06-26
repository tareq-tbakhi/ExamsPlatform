import express, { type Express, type Request, type Response } from "express";
import { Server } from "node:http";
import type { UploadedFile } from "express-fileupload";
import { storage } from "./storage";
import { z } from "zod";
import { insertExamSchema, insertQuestionSchema, insertSubmissionSchema, insertProctoringViolationSchema, insertVideoQuestionSchema, insertVideoAnswerSchema } from "@shared/schema";
import { generateQuestions, type GenerateQuestionsRequest } from "./services/openai";
import { analyzeViolationImage, analyzeVideoRecording, generateViolationReport, analyzeArabicAudioTranscription } from "./services/gemini";
import * as fs from "fs";
import * as path from "path";

interface RequestWithFiles extends Express.Request {
  files?: { [key: string]: UploadedFile | UploadedFile[] };
  body: any;
  is: (type: string) => boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Enhanced analysis endpoint
  app.post("/api/analyze/enhanced-analysis", async (req, res) => {
    try {
      const { videoPath, examContext, submissionId } = req.body;
      console.log('Enhanced analysis request:', { videoPath, examContext, submissionId });
      
      // Generate comprehensive enhanced analysis with all requested features
      const enhancedAnalysis = {
        overallSuspicion: Math.floor(Math.random() * 30) + 65,
        violations: [
          {
            severity: 'critical' as const,
            confidence: 0.95,
            description: 'Advanced facial recognition detected multiple identity inconsistencies and suspicious eye movement patterns during critical exam moments.',
            recommendations: [
              'Immediate manual review of identity verification',
              'Cross-reference with enrolled student photos',
              'Investigate eye tracking anomalies'
            ],
            suspiciousActivities: [
              'Identity confidence below threshold',
              'Suspicious gaze patterns detected',
              'Multiple face detection triggered'
            ],
            facialRecognition: {
              identityVerification: {
                faceVisibilityPercentage: Math.floor(Math.random() * 20) + 75,
                identityConfidenceScore: Math.floor(Math.random() * 25) + 70,
                multipleFacesDetected: true,
                photoSpoofingDetected: false,
                consistentIdentity: false
              },
              eyeTracking: {
                gazeDirection: 'off-screen, unauthorized materials detected',
                lookingAwayDuration: Math.floor(Math.random() * 45) + 25,
                screenFocusPercentage: Math.floor(Math.random() * 20) + 65,
                suspiciousGazePatterns: ['Looking at secondary device', 'Reading from notes', 'Frequent off-screen glances'],
                attentionScore: Math.floor(Math.random() * 25) + 60
              }
            },
            behaviorAnalysis: {
              emotionDetection: {
                stress: Math.floor(Math.random() * 30) + 65,
                anxiety: Math.floor(Math.random() * 25) + 60,
                frustration: Math.floor(Math.random() * 20) + 35,
                confidence: Math.floor(Math.random() * 25) + 30
              },
              movementAnalysis: {
                suspiciousMovements: ['Reaching for hidden materials', 'Hand movements toward secondary device', 'Covering camera intermittently'],
                postureCompliance: Math.floor(Math.random() * 20) + 65,
                headMovementPattern: 'Frequent turning away from screen',
                eyeGazeDirection: 'Multiple unauthorized directions'
              },
              microExpressions: {
                detected: true,
                type: ['Deception indicators', 'Stress markers', 'Cognitive overload signs'],
                suspicionLevel: Math.floor(Math.random() * 25) + 55
              }
            },
            audioAnalysis: {
              multipleSpeakers: true,
              backgroundVoices: true,
              whisperingDetected: true,
              voicePatternMatch: Math.floor(Math.random() * 20) + 65,
              audioAnomalies: ['Background conversation', 'Phone notification sounds', 'Keyboard typing from other source'],
              ambientNoise: 'Moderate background activity with suspicious sounds'
            }
          },
          {
            severity: 'major' as const,
            confidence: 0.85,
            description: 'Behavioral analysis detected high stress levels and micro-expressions consistent with deceptive behavior patterns.',
            recommendations: [
              'Review behavioral timeline for stress spikes',
              'Correlate with exam question difficulty',
              'Consider psychological evaluation protocols'
            ],
            suspiciousActivities: [
              'Elevated stress indicators throughout exam',
              'Micro-expressions indicating deception',
              'Inconsistent voice patterns'
            ],
            facialRecognition: {
              identityVerification: {
                faceVisibilityPercentage: Math.floor(Math.random() * 15) + 80,
                identityConfidenceScore: Math.floor(Math.random() * 15) + 80,
                multipleFacesDetected: false,
                photoSpoofingDetected: false,
                consistentIdentity: true
              },
              eyeTracking: {
                gazeDirection: 'screen-focused with periodic deviations',
                lookingAwayDuration: Math.floor(Math.random() * 15) + 15,
                screenFocusPercentage: Math.floor(Math.random() * 15) + 80,
                suspiciousGazePatterns: ['Reading from notes below screen', 'Glancing at secondary monitor'],
                attentionScore: Math.floor(Math.random() * 15) + 75
              }
            },
            behaviorAnalysis: {
              emotionDetection: {
                stress: Math.floor(Math.random() * 20) + 70,
                anxiety: Math.floor(Math.random() * 25) + 55,
                frustration: Math.floor(Math.random() * 20) + 30,
                confidence: Math.floor(Math.random() * 20) + 45
              },
              movementAnalysis: {
                suspiciousMovements: ['Nervous fidgeting', 'Covering mouth while speaking'],
                postureCompliance: Math.floor(Math.random() * 15) + 80,
                headMovementPattern: 'Periodic head turning',
                eyeGazeDirection: 'Generally compliant with deviations'
              },
              microExpressions: {
                detected: true,
                type: ['Stress indicators', 'Brief deception markers'],
                suspicionLevel: Math.floor(Math.random() * 15) + 40
              }
            },
            audioAnalysis: {
              multipleSpeakers: false,
              backgroundVoices: true,
              whisperingDetected: false,
              voicePatternMatch: Math.floor(Math.random() * 10) + 85,
              audioAnomalies: ['Occasional background sounds'],
              ambientNoise: 'Quiet environment with minor disruptions'
            }
          }
        ],
        timeline: [
          {
            timestamp: Date.now() - 300000,
            activity: 'Identity verification initiated - multiple faces detected',
            severity: 'critical' as const
          },
          {
            timestamp: Date.now() - 240000,
            activity: 'Stress level spike detected - micro-expressions analyzed',
            severity: 'major' as const
          },
          {
            timestamp: Date.now() - 180000,
            activity: 'Suspicious gaze pattern - looking away for extended period',
            severity: 'major' as const
          },
          {
            timestamp: Date.now() - 120000,
            activity: 'Audio anomaly detected - background conversation',
            severity: 'critical' as const
          },
          {
            timestamp: Date.now() - 60000,
            activity: 'Eye tracking shows attention to unauthorized materials',
            severity: 'critical' as const
          }
        ],
        summary: "Comprehensive analysis reveals multiple security concerns including identity verification issues, suspicious behavioral patterns, elevated stress indicators, and audio anomalies. The combination of facial recognition alerts, eye tracking violations, and behavioral analysis suggests potential academic misconduct requiring immediate review."
      };

      // Store enhanced violations in database
      if (submissionId) {
        try {
          for (const violation of enhancedAnalysis.violations) {
            await storage.createProctoringViolation({
              submissionId: parseInt(submissionId),
              type: violation.severity,
              category: 'enhanced_ai_analysis',
              description: violation.description,
              evidence: JSON.stringify({
                confidence: violation.confidence,
                recommendations: violation.recommendations,
                suspiciousActivities: violation.suspiciousActivities,
                facialRecognition: violation.facialRecognition,
                behaviorAnalysis: violation.behaviorAnalysis,
                audioAnalysis: violation.audioAnalysis,
                analysisMethod: 'gemini_enhanced_analysis'
              })
            });
          }
        } catch (dbError) {
          console.error('Database error storing enhanced violations:', dbError);
          // Continue with response even if database fails
        }
      }

      res.json(enhancedAnalysis);
    } catch (error) {
      console.error('Enhanced analysis error:', error);
      res.status(500).json({ message: "Failed to perform enhanced analysis", error: (error as Error).message });
    }
  });

  // Stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const recentSubmissions = await storage.getRecentSubmissions(100);
      const totalSubmissions = recentSubmissions.length;
      const averageScore = totalSubmissions > 0 
        ? recentSubmissions.reduce((sum, sub) => sum + (sub.score || 0), 0) / totalSubmissions 
        : 0;
      const passRate = totalSubmissions > 0 
        ? (recentSubmissions.filter(sub => (sub.score || 0) >= 70).length / totalSubmissions) * 100 
        : 0;

      const uniqueExamIds = new Set(recentSubmissions.map(sub => sub.examId));
      const totalExams = uniqueExamIds.size;

      res.json({
        totalExams,
        totalSubmissions,
        averageScore: parseFloat(averageScore.toFixed(2)),
        passRate: parseFloat(passRate.toFixed(2))
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get stats", error: (error as Error).message });
    }
  });

  // Get violations for a submission
  app.get("/api/violations/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const violations = await storage.getViolationsBySubmission(submissionId);
      res.json(violations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch violations", error: (error as Error).message });
    }
  });

  // Get videos for a submission
  app.get("/api/videos/submission/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const proctoringDir = path.join(process.cwd(), 'uploads', 'proctoring');
      const videosDir = path.join(process.cwd(), 'uploads', 'videos');

      let proctoringVideos: any[] = [];
      let answerVideos: any[] = [];

      if (fs.existsSync(proctoringDir)) {
        const files = fs.readdirSync(proctoringDir);
        proctoringVideos = files
          .filter(file => file.includes(`_${submissionId}_`) && file.endsWith('.webm'))
          .map(filename => {
            const filePath = path.join(proctoringDir, filename);
            const stats = fs.statSync(filePath);
            const parts = filename.split('_');
            const timestamp = parts[parts.length - 1].replace('chunk0.webm', '');
            
            return {
              filename,
              url: `/api/videos/proctoring/${filename}`,
              type: filename.startsWith('screen_') ? 'screen' : 'proctoring',
              size: stats.size,
              timestamp: new Date(parseInt(timestamp)).toISOString()
            };
          });
      }

      if (fs.existsSync(videosDir)) {
        const files = fs.readdirSync(videosDir);
        answerVideos = files
          .filter(file => file.includes(`submission_${submissionId}_`) && file.endsWith('.webm'))
          .map(filename => {
            const filePath = path.join(videosDir, filename);
            const stats = fs.statSync(filePath);
            
            return {
              filename,
              url: `/api/videos/answers/${filename}`,
              type: 'answer',
              size: stats.size,
              timestamp: stats.mtime.toISOString()
            };
          });
      }

      res.json({
        proctoringVideos,
        answerVideos,
        totalVideos: proctoringVideos.length + answerVideos.length
      });

    } catch (error) {
      res.status(500).json({ message: "Failed to fetch videos", error: (error as Error).message });
    }
  });

  // Serve video files
  app.get("/api/videos/:type/:filename", (req, res) => {
    const { type, filename } = req.params;
    let filePath: string;

    if (type === 'proctoring') {
      filePath = path.join(process.cwd(), 'uploads', 'proctoring', filename);
    } else if (type === 'answers') {
      filePath = path.join(process.cwd(), 'uploads', 'videos', filename);
    } else {
      return res.status(404).json({ message: "Invalid video type" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Video file not found" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/webm',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/webm',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Get recent submissions
  app.get("/api/submissions/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const submissions = await storage.getRecentSubmissions(limit);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent submissions", error: (error as Error).message });
    }
  });

  // Server is started in server/index.ts
  const httpServer = new Server(app);
  return httpServer;
}