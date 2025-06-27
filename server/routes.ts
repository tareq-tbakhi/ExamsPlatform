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
      const { submissionId, examContext } = req.body;
      console.log('Enhanced analysis request:', { submissionId, examContext });
      
      // Fetch all videos for this submission
      const videosResponse = await fetch(`http://localhost:5000/api/videos/submission/${submissionId}`);
      const videos = await videosResponse.json();
      
      if (!videos.proctoringVideos?.length) {
        return res.status(400).json({ message: "No videos found for analysis" });
      }

      console.log(`Found ${videos.proctoringVideos.length} videos for analysis`);
      
      // Analyze both camera and screen videos
      const allViolations = [];
      const allTimeline = [];
      let combinedSuspicion = 0;
      let videoCount = 0;
      
      for (const video of videos.proctoringVideos) {
        try {
          console.log(`Analyzing video: ${video.filename}`);
          const analysis = await analyzeVideoRecording(video.url, `${examContext} - ${video.type} video`);
          
          // Combine results
          allViolations.push(...analysis.violations);
          allTimeline.push(...analysis.timeline);
          combinedSuspicion += analysis.overallSuspicion;
          videoCount++;
          
          console.log(`Analysis completed for ${video.filename}: ${analysis.violations.length} violations`);
        } catch (videoError) {
          console.error(`Error analyzing video ${video.filename}:`, videoError);
          // Continue with other videos
        }
      }
      
      // Create combined analysis result
      const enhancedAnalysis = {
        overallSuspicion: videoCount > 0 ? Math.round(combinedSuspicion / videoCount) : 0,
        violations: allViolations,
        timeline: allTimeline.sort((a, b) => a.timestamp - b.timestamp),
        summary: `Combined analysis of ${videoCount} videos found ${allViolations.length} violations with ${Math.round(combinedSuspicion / videoCount)}% overall suspicion level.`
      };
      
      console.log('Combined AI analysis completed:', enhancedAnalysis);

      // Store AI analysis results in new database tables
      if (submissionId) {
        try {
          // Create main analysis result entry
          const analysisResult = await storage.createAiAnalysisResult({
            submissionId: parseInt(submissionId),
            videoPath: `Combined analysis of ${videoCount} videos`,
            overallSuspicion: Math.round(enhancedAnalysis.overallSuspicion * 100),
            summary: enhancedAnalysis.summary
          });

          // Store violations
          if (enhancedAnalysis.violations.length > 0) {
            const violationsToInsert = enhancedAnalysis.violations.map(violation => ({
              analysisId: analysisResult.id,
              severity: violation.severity,
              confidence: Math.round(violation.confidence * 100),
              description: violation.description,
              recommendations: violation.recommendations,
              suspiciousActivities: violation.suspiciousActivities
            }));
            await storage.createAnalysisViolations(violationsToInsert);
          }

          // Store timeline
          if (enhancedAnalysis.timeline.length > 0) {
            const timelineToInsert = enhancedAnalysis.timeline.map(item => ({
              analysisId: analysisResult.id,
              timestamp: item.timestamp,
              activity: item.activity,
              severity: item.severity
            }));
            await storage.createAnalysisTimeline(timelineToInsert);
          }

          console.log(`AI analysis results stored for submission ${submissionId} with ${enhancedAnalysis.violations.length} violations`);
        } catch (dbError) {
          console.error('Database error storing AI analysis results:', dbError);
          // Continue with response even if database fails
        }
      }

      res.json(enhancedAnalysis);
    } catch (error) {
      console.error('Enhanced analysis error:', error);
      res.status(500).json({ message: "Failed to perform enhanced analysis", error: (error as Error).message });
    }
  });

  // Get stored AI analysis results for a submission
  app.get("/api/analyze/results/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const analysisResults = await storage.getAnalysisResultsBySubmission(submissionId);
      res.json(analysisResults);
    } catch (error) {
      console.error('Failed to fetch AI analysis results:', error);
      res.status(500).json({ message: "Failed to fetch analysis results", error: (error as Error).message });
    }
  });

  // Generate AI violation report
  app.post("/api/analyze/generate-report", async (req, res) => {
    try {
      const { submissionId } = req.body;
      
      if (!submissionId) {
        return res.status(400).json({ message: "Submission ID is required" });
      }

      console.log(`Generating AI report for submission ${submissionId}`);

      // Get submission data
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Get exam data
      const exam = await storage.getExam(submission.examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      // Get violations for this submission
      const violations = await storage.getViolationsBySubmission(submissionId);
      
      // Get stored AI analysis results
      const analysisResults = await storage.getAnalysisResultsBySubmission(submissionId);
      
      console.log(`Found ${violations.length} violations and ${analysisResults.length} analysis results for submission ${submissionId}`);

      // Check if a report already exists for this submission
      const existingReports = await storage.getAiReportsBySubmission(submissionId);
      if (existingReports.length > 0) {
        console.log(`Returning existing AI report for submission ${submissionId}`);
        return res.json({
          success: true,
          report: existingReports[0].content,
          submissionId,
          violationCount: existingReports[0].violationCount,
          cached: true,
          generatedAt: existingReports[0].generatedAt
        });
      }

      // Prepare exam info for report generation
      const examInfo = {
        title: exam.title,
        duration: exam.duration,
        studentName: submission.studentName,
        submissionId: submissionId,
        submittedAt: submission.submittedAt
      };

      // Combine violations and analysis data
      const allViolationData = [
        ...violations,
        ...analysisResults.map(result => ({
          type: result.overallSuspicion > 80 ? 'critical' : result.overallSuspicion > 50 ? 'major' : 'minor',
          category: 'ai_analysis',
          description: result.summary,
          evidence: { suspicionLevel: result.overallSuspicion }
        }))
      ];

      // Calculate overall suspicion level
      const overallSuspicion = analysisResults.length > 0 
        ? Math.round(analysisResults.reduce((sum, result) => sum + result.overallSuspicion, 0) / analysisResults.length)
        : (violations.length > 0 ? Math.min(violations.length * 20, 100) : 0);

      // Generate the report using Gemini AI
      const { generateViolationReport } = await import("./services/gemini");
      const report = await generateViolationReport(allViolationData, examInfo);
      
      console.log(`Generated AI report for submission ${submissionId} (length: ${report.length} characters)`);

      // Store the generated report in the database
      try {
        const storedReport = await storage.createAiReport({
          submissionId: submissionId,
          reportType: 'violation_report',
          content: report,
          violationCount: allViolationData.length,
          suspicionLevel: overallSuspicion
        });
        
        console.log(`Stored AI report in database with ID: ${storedReport.id}`);
      } catch (dbError) {
        console.error('Failed to store AI report in database:', dbError);
        // Continue with response even if storage fails
      }

      res.json({ 
        success: true, 
        report,
        submissionId,
        violationCount: allViolationData.length,
        suspicionLevel: overallSuspicion,
        cached: false
      });
    } catch (error) {
      console.error('Failed to generate AI report:', error);
      res.status(500).json({ 
        message: "Failed to generate AI report", 
        error: (error as Error).message 
      });
    }
  });

  // Get stored AI reports for a submission
  app.get("/api/reports/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const reports = await storage.getAiReportsBySubmission(submissionId);
      
      console.log(`Retrieved ${reports.length} stored AI reports for submission ${submissionId}`);
      res.json(reports);
    } catch (error) {
      console.error('Failed to fetch AI reports:', error);
      res.status(500).json({ message: "Failed to fetch AI reports", error: (error as Error).message });
    }
  });

  // Get stored timeline data for a submission
  app.get("/api/timeline/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      
      // Get all analysis results for this submission
      const analysisResults = await storage.getAnalysisResultsBySubmission(submissionId);
      
      // Collect timeline data from all analysis results
      const allTimeline = [];
      for (const analysis of analysisResults) {
        const timeline = await storage.getTimelineByAnalysisId(analysis.id);
        allTimeline.push(...timeline);
      }
      
      // Sort by timestamp
      allTimeline.sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`Retrieved ${allTimeline.length} timeline events for submission ${submissionId}`);
      res.json(allTimeline);
    } catch (error) {
      console.error('Failed to fetch timeline data:', error);
      res.status(500).json({ message: "Failed to fetch timeline data", error: (error as Error).message });
    }
  });

  // Auto-grade a submission
  app.post("/api/submissions/:submissionId/grade", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const { gradingService } = await import("./services/grading");
      
      // Get submission and related data
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const questions = await storage.getQuestionsByExam(submission.examId);
      const testCases = await Promise.all(
        questions.map(q => storage.getCodingTestCasesByQuestion(q.id))
      ).then(results => results.flat());

      // Grade the submission
      const gradingResult = await gradingService.gradeSubmission(questions, submission.answers, testCases);

      // Store individual question grades
      for (const questionGrade of gradingResult.questionGrades) {
        await storage.createQuestionGrade({
          submissionId,
          questionId: questionGrade.questionId,
          answer: submission.answers[questionGrade.questionId.toString()],
          score: questionGrade.score,
          maxScore: questionGrade.maxScore,
          isCorrect: questionGrade.isCorrect,
          gradingType: questionGrade.gradingType,
          feedback: questionGrade.feedback,
          gradedBy: "system"
        });
      }

      // Update submission with grading results
      const autoGradedScore = gradingResult.questionGrades
        .filter(g => g.gradingType === "auto" || g.gradingType === "ai")
        .reduce((sum, g) => sum + g.score, 0);

      const manualGradingRequired = gradingResult.questionGrades.some(g => g.gradingType === "manual");

      await storage.updateSubmissionGrading(submissionId, {
        score: gradingResult.totalScore,
        weightedScore: gradingResult.weightedScore,
        passingStatus: gradingResult.passingStatus,
        gradingStatus: gradingResult.gradingStatus,
        autoGradedScore,
        manualGradedScore: manualGradingRequired ? 0 : undefined,
        scoreBreakdown: gradingResult.scoreBreakdown
      });

      console.log(`Graded submission ${submissionId}: ${gradingResult.totalScore}/${gradingResult.totalPossible} points`);
      res.json(gradingResult);
    } catch (error) {
      console.error('Failed to grade submission:', error);
      res.status(500).json({ message: "Failed to grade submission", error: (error as Error).message });
    }
  });

  // Get detailed grading results for a submission
  app.get("/api/submissions/:submissionId/grades", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const grades = await storage.getQuestionGradesBySubmission(submissionId);
      res.json(grades);
    } catch (error) {
      console.error('Failed to fetch grades:', error);
      res.status(500).json({ message: "Failed to fetch grades", error: (error as Error).message });
    }
  });

  // Get score analytics for an exam
  app.get("/api/exams/:examId/analytics", async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const submissions = await storage.getSubmissionsByExam(examId);
      
      const analytics = {
        totalSubmissions: submissions.length,
        gradedSubmissions: submissions.filter(s => s.gradingStatus === "completed").length,
        averageScore: submissions.length > 0 
          ? submissions.reduce((sum, s) => sum + (s.score || 0), 0) / submissions.length
          : 0,
        passRate: submissions.length > 0
          ? (submissions.filter(s => s.passingStatus === "passed").length / submissions.length) * 100
          : 0,
        scoreDistribution: {
          "90-100": 0,
          "80-89": 0,
          "70-79": 0,
          "60-69": 0,
          "50-59": 0,
          "0-49": 0
        },
        questionTypeBreakdown: {} as Record<string, { averageScore: number; totalQuestions: number }>
      };

      // Calculate score distribution
      submissions.forEach(submission => {
        if (submission.score !== null && submission.totalPoints > 0) {
          const percentage = (submission.score / submission.totalPoints) * 100;
          if (percentage >= 90) analytics.scoreDistribution["90-100"]++;
          else if (percentage >= 80) analytics.scoreDistribution["80-89"]++;
          else if (percentage >= 70) analytics.scoreDistribution["70-79"]++;
          else if (percentage >= 60) analytics.scoreDistribution["60-69"]++;
          else if (percentage >= 50) analytics.scoreDistribution["50-59"]++;
          else analytics.scoreDistribution["0-49"]++;
        }
      });

      res.json(analytics);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      res.status(500).json({ message: "Failed to fetch analytics", error: (error as Error).message });
    }
  });

  // Transcribe audio file
  app.post("/api/transcribe/audio", async (req: RequestWithFiles, res) => {
    try {
      const { transcriptionService } = await import("./services/transcription");
      
      if (!req.files?.audio) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const audioFile = Array.isArray(req.files.audio) ? req.files.audio[0] : req.files.audio;
      const language = req.body.language || "ar";
      
      // Save uploaded file temporarily
      const uploadPath = `uploads/temp/${Date.now()}_${audioFile.name}`;
      await audioFile.mv(uploadPath);

      // Transcribe the audio
      const result = await transcriptionService.transcribeAudio(uploadPath, language);

      // Clean up temporary file
      try {
        const fs = await import("fs");
        fs.unlinkSync(uploadPath);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }

      console.log(`Audio transcription completed: ${result.wordCount} words, ${result.confidence}% confidence`);
      res.json(result);
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      res.status(500).json({ message: "Failed to transcribe audio", error: (error as Error).message });
    }
  });

  // Transcribe video audio
  app.post("/api/transcribe/video", async (req: RequestWithFiles, res) => {
    try {
      const { transcriptionService } = await import("./services/transcription");
      
      if (!req.files?.video) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const videoFile = Array.isArray(req.files.video) ? req.files.video[0] : req.files.video;
      const language = req.body.language || "ar";
      
      // Save uploaded file temporarily
      const uploadPath = `uploads/temp/${Date.now()}_${videoFile.name}`;
      await videoFile.mv(uploadPath);

      // Transcribe the video audio
      const result = await transcriptionService.transcribeVideoAudio(uploadPath, language);

      // Clean up temporary file
      try {
        const fs = await import("fs");
        fs.unlinkSync(uploadPath);
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file:", cleanupError);
      }

      console.log(`Video transcription completed: ${result.wordCount} words, ${result.confidence}% confidence`);
      res.json(result);
    } catch (error) {
      console.error('Failed to transcribe video:', error);
      res.status(500).json({ message: "Failed to transcribe video", error: (error as Error).message });
    }
  });

  // Get supported transcription formats
  app.get("/api/transcribe/formats", async (req, res) => {
    try {
      const { transcriptionService } = await import("./services/transcription");
      const formats = transcriptionService.getSupportedFormats();
      res.json(formats);
    } catch (error) {
      console.error('Failed to get supported formats:', error);
      res.status(500).json({ message: "Failed to get supported formats", error: (error as Error).message });
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
        
        // Try multiple patterns to match videos to submissions
        // Pattern 1: Direct submission ID match (_submissionId_)
        // Pattern 2: Session ID match (videos recorded during exam session)
        // Pattern 3: Exam ID match for submissions from same exam (fallback)
        let filteredFiles = files.filter(file => file.includes(`_${submissionId}_`) && file.endsWith('.webm'));
        
        if (filteredFiles.length === 0 && submission.sessionId) {
          // Try session ID match - videos recorded with session ID during exam
          filteredFiles = files.filter(file => 
            file.includes(`_${submission.sessionId}_`) && file.endsWith('.webm')
          );
          console.log(`Session ID match for ${submission.sessionId}: found ${filteredFiles.length} files:`, filteredFiles);
        }
        
        if (filteredFiles.length === 0) {
          // Enhanced fallback: Try exam ID match plus timestamp-based sorting for most recent videos
          const examFiles = files.filter(file => 
            file.includes(`_${submission.examId}_`) && file.endsWith('.webm')
          );
          
          // Sort by modification time to get most recent videos for this exam
          if (examFiles.length > 0) {
            const fileStats = examFiles.map(filename => {
              try {
                const filePath = path.join(proctoringDir, filename);
                const stats = fs.statSync(filePath);
                return { filename, mtime: stats.mtime.getTime() };
              } catch (error) {
                return { filename, mtime: 0 };
              }
            });
            
            // Sort by modification time (newest first) and take files from around submission time
            fileStats.sort((a, b) => b.mtime - a.mtime);
            const submissionTime = submission.submittedAt ? new Date(submission.submittedAt).getTime() : Date.now();
            
            // Filter videos that were created within 2 hours of submission time
            const timeWindow = 2 * 60 * 60 * 1000; // 2 hours
            filteredFiles = fileStats
              .filter(file => Math.abs(file.mtime - submissionTime) < timeWindow)
              .map(file => file.filename);
              
            console.log(`Exam ID ${submission.examId} + time window match for submission ${submissionId}: ${filteredFiles.length} files out of ${examFiles.length} total exam files`);
          }
        }
        
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

  // Upload proctoring video chunks
  app.post("/api/upload-proctoring-video", async (req: RequestWithFiles, res) => {
    try {
      if (!req.files || !req.files.video) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const videoFile = req.files.video as UploadedFile;
      const { examId, submissionId, sessionId, type } = req.body;
      
      console.log(`Uploading proctoring video: ${videoFile.name}, Type: ${type}, Exam: ${examId}, Submission: ${submissionId}, Session: ${sessionId}`);

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads', 'proctoring');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const filename = videoFile.name || `${type}_${examId}_${submissionId || sessionId}_${Date.now()}.webm`;
      const filePath = path.join(uploadDir, filename);

      // Save the file
      await videoFile.mv(filePath);
      
      console.log(`Proctoring video saved: ${filePath} (${(videoFile.size / 1024 / 1024).toFixed(2)}MB)`);

      res.json({ 
        success: true, 
        filename,
        url: `/api/videos/proctoring/${filename}`,
        size: videoFile.size 
      });
    } catch (error) {
      console.error("Failed to upload proctoring video:", error);
      res.status(500).json({ message: "Failed to upload video", error: (error as Error).message });
    }
  });

  // Upload video answer
  app.post("/api/upload-video-answer", async (req: RequestWithFiles, res) => {
    try {
      if (!req.files || !req.files.video) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const videoFile = req.files.video as UploadedFile;
      const { questionId, transcript, confidence, duration } = req.body;

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const filename = videoFile.name || `answer_${questionId}_${Date.now()}.webm`;
      const filePath = path.join(uploadDir, filename);

      // Save the file
      await videoFile.mv(filePath);

      res.json({ 
        success: true, 
        videoUrl: `/api/videos/answers/${filename}`,
        filename 
      });
    } catch (error) {
      console.error("Failed to upload video answer:", error);
      res.status(500).json({ message: "Failed to upload video answer", error: (error as Error).message });
    }
  });

  // Create submission
  app.post("/api/submissions", async (req, res) => {
    try {
      console.log("Submissions endpoint hit with data:", req.body);
      console.log("Session ID in submission:", req.body.sessionId);
      
      const submissionData = insertSubmissionSchema.parse(req.body);
      const submission = await storage.createSubmission(submissionData);
      
      console.log("Submission created successfully:", submission);
      console.log("Created submission has session ID:", submission.sessionId);
      
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

  // Create exam
  app.post("/api/exams", async (req, res) => {
    try {
      console.log("Creating exam with data:", JSON.stringify(req.body, null, 2));
      const examData = insertExamSchema.parse(req.body);
      console.log("Parsed exam data:", JSON.stringify(examData, null, 2));
      const exam = await storage.createExam(examData);
      console.log("Exam created successfully:", exam);
      res.json(exam);
    } catch (error) {
      console.error("Failed to create exam. Error details:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create exam", error: (error as Error).message });
    }
  });

  // Update exam
  app.put("/api/exams/:id", async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      console.log(`Updating exam ${examId} with data:`, JSON.stringify(req.body, null, 2));
      const examData = insertExamSchema.partial().parse(req.body);
      const updatedExam = await storage.updateExam(examId, examData);
      
      if (!updatedExam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      console.log("Exam updated successfully:", updatedExam);
      res.json(updatedExam);
    } catch (error) {
      console.error("Failed to update exam:", error);
      res.status(500).json({ message: "Failed to update exam", error: (error as Error).message });
    }
  });

  // Patch exam (for status updates like publishing)
  app.patch("/api/exams/:id", async (req, res) => {
    try {
      const examId = parseInt(req.params.id);
      console.log(`Patching exam ${examId} with data:`, JSON.stringify(req.body, null, 2));
      const examData = insertExamSchema.partial().parse(req.body);
      const updatedExam = await storage.updateExam(examId, examData);
      
      if (!updatedExam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      
      console.log("Exam patched successfully:", updatedExam);
      res.json(updatedExam);
    } catch (error) {
      console.error("Failed to patch exam:", error);
      res.status(500).json({ message: "Failed to patch exam", error: (error as Error).message });
    }
  });

  // Create question
  app.post("/api/questions", async (req, res) => {
    try {
      console.log("Creating question with data:", req.body);
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      console.log("Question created successfully:", question);
      res.json(question);
    } catch (error) {
      console.error("Failed to create question:", error);
      res.status(500).json({ message: "Failed to create question", error: (error as Error).message });
    }
  });

  // Generate questions using AI
  app.post("/api/generate-questions", async (req, res) => {
    try {
      console.log("AI Question Generation Request received:", req.body);
      const requestData: GenerateQuestionsRequest = req.body;
      
      // Validate request data
      const schema = z.object({
        topic: z.string().min(1),
        count: z.number().min(1).max(50),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'essay', 'coding', 'video_response', 'audio_response']),
        language: z.string().optional().default('en'),
        examId: z.number()
      });

      const validatedData = schema.parse(requestData);
      
      const questions = await generateQuestions(
        validatedData.topic,
        validatedData.count,
        validatedData.difficulty,
        validatedData.type,
        validatedData.language
      );

      // Save questions to database
      const savedQuestions = [];
      for (const question of questions) {
        const savedQuestion = await storage.createQuestion({
          examId: validatedData.examId,
          type: question.type,
          question: question.question,
          options: question.options || [],
          correctAnswer: question.correctAnswer,
          points: question.points,
          order: savedQuestions.length + 1,
          weight: 1,
          autoGraded: true,
          metadata: question.metadata || {}
        });
        savedQuestions.push(savedQuestion);
      }

      console.log(`Generated and saved ${savedQuestions.length} questions`);
      res.json({ questions: savedQuestions });
    } catch (error) {
      console.error("Failed to generate questions:", error);
      res.status(500).json({ message: "Failed to generate questions", error: (error as Error).message });
    }
  });

  // Validate video/audio answer using OpenAI
  app.post("/api/validate-answer", async (req, res) => {
    try {
      const { questionId, submissionId, transcription, questionType, audioQuality, confidence } = req.body;
      
      // Get the question details
      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ success: false, error: "Question not found" });
      }

      // Use OpenAI to validate the answer
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert exam evaluator. Evaluate the student's ${questionType} response based on the question requirements. 

              Criteria for evaluation:
              - Content accuracy and relevance (40%)
              - Completeness of answer (30%)
              - Clarity and coherence (20%)
              - Language proficiency (10%)

              Provide a score from 0-100 and detailed feedback.
              If the transcription confidence is low (< 0.7), consider partial credit.
              
              Return JSON in this format:
              {
                "score": number,
                "isValid": boolean,
                "feedback": "detailed feedback",
                "contentAnalysis": {
                  "accuracy": number,
                  "completeness": number,
                  "clarity": number,
                  "language": number
                }
              }`
            },
            {
              role: "user",
              content: `Question: ${question.question}
              Expected Answer: ${question.correctAnswer}
              Student's Response: ${transcription}
              Transcription Confidence: ${confidence}
              Question Type: ${questionType}
              Audio Quality: ${JSON.stringify(audioQuality)}`
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      const openaiResult = await openaiResponse.json();
      
      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResult.error?.message || "Unknown error"}`);
      }

      const evaluation = JSON.parse(openaiResult.choices[0].message.content);
      
      // Save the video/audio answer to database
      const videoAnswer = await storage.createVideoAnswer({
        submissionId,
        videoQuestionId: questionId, // Map questionId to videoQuestionId
        transcript: transcription,
        confidence,
        videoUrl: null // We'll update this after file upload
      });

      console.log("Answer validated and saved:", videoAnswer);

      res.json({
        success: true,
        score: evaluation.score,
        isValid: evaluation.isValid,
        feedback: evaluation.feedback,
        contentAnalysis: evaluation.contentAnalysis,
        videoAnswerId: videoAnswer.id
      });
    } catch (error) {
      console.error("Failed to validate answer:", error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Generate questions using AI (continued)
  app.post("/api/generate-questions", async (req, res) => {
    try {
      console.log("AI Question Generation Request received:", req.body);
      
      // Validate request data
      const schema = z.object({
        topic: z.string().min(1),
        questionType: z.enum(["multiple_choice", "true_false", "short_answer", "essay", "coding", "video_response", "audio_response"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        count: z.number().min(1).max(20),
        subject: z.string().optional()
      });
      
      const validatedData = schema.parse(requestData);
      console.log("Validated request data:", validatedData);
      
      // Generate questions using OpenAI
      console.log("Calling OpenAI service...");
      const questions = await generateQuestions(validatedData);
      console.log("Generated questions:", questions);
      
      res.json({ questions });
    } catch (error) {
      console.error("Failed to generate questions:", error);
      res.status(500).json({ 
        message: "Failed to generate questions", 
        error: (error as Error).message 
      });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      // Get all exams
      const allExams = await storage.getExamsByCreator(1); // Mock user ID
      
      // Get all submissions across all exams
      const allSubmissions = await storage.getRecentSubmissions(1000);
      
      // Calculate statistics
      const totalExams = allExams.length;
      const totalSubmissions = allSubmissions.length;
      
      // Calculate average score
      const scoresWithValues = allSubmissions.filter(sub => sub.score !== null);
      const averageScore = scoresWithValues.length > 0 
        ? scoresWithValues.reduce((sum, sub) => sum + (sub.score || 0), 0) / scoresWithValues.length
        : 0;
      
      // Calculate pass rate (assuming passing is 60% or higher)
      const passingGrade = 60;
      const passingCount = scoresWithValues.filter(sub => (sub.score || 0) >= passingGrade).length;
      const passRate = scoresWithValues.length > 0 ? (passingCount / scoresWithValues.length) * 100 : 0;
      
      res.json({
        totalExams,
        totalSubmissions,
        averageScore,
        passRate
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ message: "Failed to fetch stats", error: (error as Error).message });
    }
  });

  // Server is started in server/index.ts
  const httpServer = new Server(app);
  return httpServer;
}