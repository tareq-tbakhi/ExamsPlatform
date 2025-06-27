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
      
      // Use real Gemini AI analysis instead of mock data
      console.log('Starting Gemini AI video analysis...');
      const enhancedAnalysis = await analyzeVideoRecording(videoPath, examContext);
      console.log('Gemini AI analysis completed:', enhancedAnalysis);

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
                screenActivity: violation.screenActivity,
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
      console.log(`Getting videos for submission ${submissionId}`);
      
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        console.log(`Submission ${submissionId} not found`);
        return res.status(404).json({ message: "Submission not found" });
      }

      const proctoringDir = path.join(process.cwd(), 'uploads', 'proctoring');
      const videosDir = path.join(process.cwd(), 'uploads', 'videos');

      let proctoringVideos: any[] = [];
      let answerVideos: any[] = [];

      if (fs.existsSync(proctoringDir)) {
        const files = fs.readdirSync(proctoringDir);
        console.log(`Found files in proctoring dir:`, files);
        const filteredFiles = files.filter(file => file.includes(`_${submissionId}_`) && file.endsWith('.webm'));
        console.log(`Filtered files for submission ${submissionId}:`, filteredFiles);
        
        proctoringVideos = filteredFiles.map(filename => {
          try {
            const filePath = path.join(proctoringDir, filename);
            const stats = fs.statSync(filePath);
            
            return {
              filename,
              url: `/api/videos/proctoring/${filename}`,
              type: filename.startsWith('screen_') ? 'screen' : 'proctoring',
              size: stats.size,
              timestamp: stats.mtime.toISOString()
            };
          } catch (error) {
            console.log(`Error processing file ${filename}:`, error);
            return null;
          }
        }).filter(Boolean);
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

  // Create submission
  app.post("/api/submissions", async (req, res) => {
    try {
      console.log("Submissions endpoint hit with data:", req.body);
      const submissionData = insertSubmissionSchema.parse(req.body);
      const submission = await storage.createSubmission(submissionData);
      console.log("Submission created successfully:", submission);
      res.json(submission);
    } catch (error) {
      console.error("Failed to create submission:", error);
      res.status(500).json({ message: "Failed to create submission", error: (error as Error).message });
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

  // Get exams by creator
  app.get("/api/exams/creator/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const exams = await storage.getExamsByCreator(userId);
      res.json(exams);
    } catch (error) {
      console.error("Failed to fetch exams by creator:", error);
      res.status(500).json({ message: "Failed to fetch exams", error: (error as Error).message });
    }
  });

  // Get single exam with questions by ID
  app.get("/api/exams/:id", async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      const exam = await storage.getExamWithQuestions(examId);
      
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      res.json(exam);
    } catch (error) {
      console.error("Failed to fetch exam:", error);
      res.status(500).json({ message: "Failed to fetch exam", error: (error as Error).message });
    }
  });

  // Server is started in server/index.ts
  const httpServer = new Server(app);
  return httpServer;
}