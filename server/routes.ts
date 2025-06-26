import type { Express } from "express";
import type { UploadedFile } from "express-fileupload";

interface RequestWithFiles extends Express.Request {
  files?: { [key: string]: UploadedFile | UploadedFile[] };
  body: any;
  is: (type: string) => boolean;
}
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { insertExamSchema, insertQuestionSchema, insertSubmissionSchema, insertProctoringViolationSchema } from "@shared/schema";
import { generateQuestions, type GenerateQuestionsRequest } from "./services/openai";
import { analyzeViolationImage, analyzeVideoRecording, generateViolationReport, analyzeArabicAudioTranscription } from "./services/gemini";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Exam routes
  app.post("/api/exams", async (req, res) => {
    try {
      const examData = insertExamSchema.parse(req.body);
      const exam = await storage.createExam(examData);
      res.json(exam);
    } catch (error) {
      res.status(400).json({ message: "Invalid exam data", error: (error as Error).message });
    }
  });

  app.get("/api/exams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const exam = await storage.getExamWithQuestions(id);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      res.json(exam);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exam", error: (error as Error).message });
    }
  });

  // Default route for exam creator (uses default user ID 1)
  app.get("/api/exams/creator", async (req, res) => {
    try {
      const createdBy = 1; // Default user ID for demo purposes
      console.log("Fetching exams for creator:", createdBy);
      const exams = await storage.getExamsByCreator(createdBy);
      res.json(exams);
    } catch (error) {
      console.error("Error in /api/exams/creator:", error);
      res.status(500).json({ message: "Failed to fetch exams", error: (error as Error).message });
    }
  });

  app.get("/api/exams/creator/:createdBy", async (req, res) => {
    try {
      const createdBy = parseInt(req.params.createdBy);
      const exams = await storage.getExamsByCreator(createdBy);
      res.json(exams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exams", error: (error as Error).message });
    }
  });

  app.put("/api/exams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertExamSchema.partial().parse(req.body);
      const exam = await storage.updateExam(id, updateData);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }
      res.json(exam);
    } catch (error) {
      res.status(400).json({ message: "Invalid exam data", error: (error as Error).message });
    }
  });

  app.delete("/api/exams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExam(id);
      if (!deleted) {
        return res.status(404).json({ message: "Exam not found" });
      }
      res.json({ message: "Exam deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete exam", error: (error as Error).message });
    }
  });

  // Question routes
  app.post("/api/questions", async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data", error: (error as Error).message });
    }
  });

  app.get("/api/questions/exam/:examId", async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const questions = await storage.getQuestionsByExam(examId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions", error: (error as Error).message });
    }
  });

  app.put("/api/questions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertQuestionSchema.partial().parse(req.body);
      const question = await storage.updateQuestion(id, updateData);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json(question);
    } catch (error) {
      res.status(400).json({ message: "Invalid question data", error: (error as Error).message });
    }
  });

  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteQuestion(id);
      if (!deleted) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json({ message: "Question deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete question", error: (error as Error).message });
    }
  });

  // AI generation route
  app.post("/api/generate-questions", async (req, res) => {
    try {
      const requestSchema = z.object({
        topic: z.string().min(1),
        questionType: z.enum(["multiple_choice", "short_answer", "essay", "true_false"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        count: z.number().min(1).max(20),
        subject: z.string().optional()
      });

      const requestData: GenerateQuestionsRequest = requestSchema.parse(req.body);
      const questions = await generateQuestions(requestData);
      res.json({ questions });
    } catch (error) {
      res.status(400).json({ message: "Failed to generate questions", error: (error as Error).message });
    }
  });

  // Submission routes
  app.post("/api/submissions", async (req, res) => {
    try {
      const submissionData = insertSubmissionSchema.parse(req.body);
      
      // Calculate score for multiple choice questions
      const exam = await storage.getExamWithQuestions(submissionData.examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      let score = 0;
      const answers = submissionData.answers as Record<string, any>;

      exam.questions.forEach(question => {
        const studentAnswer = answers[question.id.toString()];
        if (question.type === "multiple_choice" && studentAnswer === question.correctAnswer) {
          score += question.points;
        }
        // For short_answer and essay, manual grading would be needed
      });

      const submissionWithScore = {
        ...submissionData,
        score,
      };

      const submission = await storage.createSubmission(submissionWithScore);
      
      // Associate session-based videos with this submission
      if (submissionData.sessionId) {
        try {
          const proctoringDir = 'uploads/proctoring';
          if (fs.existsSync(proctoringDir)) {
            const sessionFiles = fs.readdirSync(proctoringDir)
              .filter(file => file.includes(`_${submissionData.sessionId}_`));
            
            // Rename session-based files to include submission ID
            for (const oldFile of sessionFiles) {
              const newFile = oldFile.replace(`_${submissionData.sessionId}_`, `_${submission.id}_`);
              const oldPath = path.join(proctoringDir, oldFile);
              const newPath = path.join(proctoringDir, newFile);
              
              if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                console.log(`Renamed ${oldFile} to ${newFile}`);
              }
            }
          }
        } catch (error) {
          console.error('Error associating session videos with submission:', error);
        }
      }
      
      res.json(submission);
    } catch (error) {
      res.status(400).json({ message: "Invalid submission data", error: (error as Error).message });
    }
  });

  app.get("/api/submissions/exam/:examId", async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const submissions = await storage.getSubmissionsByExam(examId);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submissions", error: (error as Error).message });
    }
  });

  app.get("/api/submissions/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const submissions = await storage.getRecentSubmissions(limit);
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent submissions", error: (error as Error).message });
    }
  });

  // Get detailed submission with questions and answers
  app.get("/api/submissions/:id/details", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.id);
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const exam = await storage.getExamWithQuestions(submission.examId);
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      res.json({
        submission,
        exam,
        answers: submission.answers
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch submission details", error: (error as Error).message });
    }
  });

  app.put("/api/submissions/:id/score", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { score } = req.body;
      
      if (typeof score !== "number" || score < 0) {
        return res.status(400).json({ message: "Invalid score" });
      }

      const submission = await storage.updateSubmissionScore(id, score);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      res.status(500).json({ message: "Failed to update score", error: (error as Error).message });
    }
  });

  // Stats route for dashboard
  app.get("/api/stats", async (req, res) => {
    try {
      // Mock user ID - in real app this would come from authentication
      const userId = 1;
      
      const userExams = await storage.getExamsByCreator(userId);
      const recentSubmissions = await storage.getRecentSubmissions();
      
      const totalExams = userExams.length;
      const totalSubmissions = userExams.reduce((sum, exam) => sum + exam.submissionsCount, 0);
      const averageScore = userExams.length > 0 
        ? userExams.reduce((sum, exam) => sum + (exam.averageScore || 0), 0) / userExams.filter(exam => exam.averageScore).length
        : 0;
      
      const passRate = recentSubmissions.length > 0
        ? (recentSubmissions.filter(sub => (sub.score || 0) >= (sub.totalPoints * 0.6)).length / recentSubmissions.length) * 100
        : 0;

      res.json({
        totalExams,
        totalSubmissions,
        averageScore: Math.round(averageScore * 10) / 10,
        passRate: Math.round(passRate)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats", error: (error as Error).message });
    }
  });

  // Proctoring routes
  app.post("/api/proctoring/violation", async (req, res) => {
    try {
      const violationData = {
        submissionId: parseInt(req.body.submissionId),
        type: req.body.type,
        category: req.body.category,
        description: req.body.description,
        evidence: req.body.evidence || {}
      };

      const violation = await storage.createProctoringViolation(violationData);
      res.json(violation);
    } catch (error) {
      res.status(400).json({ message: "Failed to record violation", error: (error as Error).message });
    }
  });

  app.post("/api/upload-proctoring-video", async (req: any, res) => {
    try {
      // Handle both FormData and JSON requests
      let examId, submissionId, videoBuffer, type, chunkIndex = 0;
      
      if (req.is('multipart/form-data')) {
        // Handle FormData from frontend
        examId = req.body.examId;
        submissionId = req.body.submissionId;
        type = req.body.type || 'camera';
        
        if (!req.files || !req.files.video || !examId) {
          return res.status(400).json({ message: "Video file and exam ID required" });
        }
        
        const videoFile = Array.isArray(req.files.video) ? req.files.video[0] : req.files.video;
        videoBuffer = videoFile.data;
        
      } else {
        // Handle JSON with base64 data (legacy)
        const { videoData } = req.body;
        examId = req.body.examId;
        submissionId = req.body.submissionId;
        type = 'camera';
        
        if (!videoData || !examId) {
          return res.status(400).json({ message: "Video data and exam ID required" });
        }
        
        const base64Data = videoData.includes(',') ? videoData.split(',')[1] : videoData;
        videoBuffer = Buffer.from(base64Data, 'base64');
      }

      // Ensure upload directory exists
      const uploadDir = 'uploads/proctoring';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create filename with timestamp and chunk index - use sessionId if available
      const timestamp = Date.now();
      const sessionId = req.body.sessionId;
      const identifier = submissionId || sessionId || 'unknown';
      const filename = `${type}_${examId}_${identifier}_${timestamp}_chunk${chunkIndex}.webm`;
      
      console.log(`Creating video file: ${filename} (sessionId: ${sessionId})`);
      const filePath = path.join(uploadDir, filename);
      
      // Save video buffer to file
      fs.writeFileSync(filePath, videoBuffer);
      
      const videoUrl = `/api/videos/proctoring/${filename}`;
      
      console.log(`Saved proctoring video: ${filename} (${videoBuffer.length} bytes)`);
      
      res.json({ 
        videoUrl, 
        filename,
        message: "Proctoring video uploaded successfully",
        size: videoBuffer.length 
      });
    } catch (error) {
      console.error('Video upload error:', error);
      res.status(500).json({ message: "Failed to upload video", error: (error as Error).message });
    }
  });

  app.post("/api/upload-video-answer", async (req, res) => {
    try {
      // In production, save video to cloud storage
      const videoUrl = `https://storage.example.com/video-answers/${Date.now()}.webm`;
      
      const videoAnswer = await storage.createVideoAnswer({
        submissionId: parseInt(req.body.submissionId) || 0,
        videoQuestionId: parseInt(req.body.questionId),
        videoUrl: videoUrl,
        transcript: req.body.transcript,
        confidence: parseInt(req.body.confidence) || 0,
        duration: parseInt(req.body.duration)
      });

      res.json({ videoUrl, videoAnswer });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload video answer", error: (error as Error).message });
    }
  });

  // Video questions routes
  app.post("/api/video-questions", async (req, res) => {
    try {
      const questionData = {
        examId: parseInt(req.body.examId),
        question: req.body.question,
        maxDuration: parseInt(req.body.maxDuration),
        order: parseInt(req.body.order),
        points: parseInt(req.body.points)
      };
      
      const videoQuestion = await storage.createVideoQuestion(questionData);
      res.json(videoQuestion);
    } catch (error) {
      res.status(400).json({ message: "Failed to create video question", error: (error as Error).message });
    }
  });

  app.get("/api/video-questions/exam/:examId", async (req, res) => {
    try {
      const examId = parseInt(req.params.examId);
      const videoQuestions = await storage.getVideoQuestionsByExam(examId);
      res.json(videoQuestions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch video questions", error: (error as Error).message });
    }
  });

  // Gemini AI Analysis routes
  app.post("/api/analyze/violation-image", async (req, res) => {
    try {
      const { imagePath, context } = req.body;
      if (!imagePath) {
        return res.status(400).json({ message: "Image path required" });
      }
      
      const analysis = await analyzeViolationImage(imagePath, context || "Exam proctoring footage");
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to analyze violation image", error: (error as Error).message });
    }
  });

  app.post("/api/analyze/video-recording", async (req, res) => {
    try {
      const { videoPath, examContext } = req.body;
      if (!videoPath) {
        return res.status(400).json({ message: "Video path required" });
      }
      
      const analysis = await analyzeVideoRecording(videoPath, examContext || "Exam proctoring session");
      
      // Store analysis results in database if violations found
      if (analysis.violations && analysis.violations.length > 0) {
        try {
          // Extract submission ID from video path for database storage
          const filename = videoPath.split('/').pop() || '';
          const pathParts = filename.replace('.webm', '').split('_');
          let submissionId = null;
          
          if (pathParts.length >= 3 && pathParts[2] !== 'unknown') {
            submissionId = parseInt(pathParts[2]);
          } else if (pathParts.length >= 2) {
            // Try to find recent submission for this exam
            const examId = parseInt(pathParts[1]);
            const recentSubmissions = await storage.getSubmissionsByExam(examId);
            if (recentSubmissions.length > 0) {
              // Use the most recent submission
              submissionId = recentSubmissions[recentSubmissions.length - 1].id;
            }
          }
          
          if (submissionId) {
            // Store each violation in database
            for (const violation of analysis.violations) {
              await storage.createProctoringViolation({
                submissionId: submissionId,
                type: violation.severity as 'critical' | 'major' | 'minor',
                category: videoPath.includes('screen_') ? 'screen_activity' : 'camera_monitoring',
                description: violation.description,
                evidence: {
                  videoPath: videoPath,
                  confidence: violation.confidence,
                  recommendations: violation.recommendations,
                  suspiciousActivities: violation.suspiciousActivities,
                  analysisMethod: videoPath.includes('screen_') ? 'screen_metadata_analysis' : 'ai_video_analysis',
                  overallSuspicion: analysis.overallSuspicion,
                  timeline: analysis.timeline
                }
              });
            }
            console.log(`Stored ${analysis.violations.length} violations for submission ${submissionId} in database`);
          }
        } catch (dbError) {
          console.error('Failed to store analysis in database:', dbError);
          // Continue anyway - analysis still successful
        }
      }
      
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to analyze video recording", error: (error as Error).message });
    }
  });

  app.post("/api/analyze/generate-report", async (req, res) => {
    try {
      const { submissionId } = req.body;
      if (!submissionId) {
        return res.status(400).json({ message: "Submission ID required" });
      }
      
      // Get violations for this submission
      const violations = await storage.getViolationsBySubmission(submissionId);
      const submission = await storage.getSubmission(submissionId);
      
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      const examInfo = {
        title: "Exam", // In real app, get from exam table
        duration: 60,
        studentName: submission.studentName
      };
      
      const report = await generateViolationReport(violations, examInfo);
      res.json({ report });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate violation report", error: (error as Error).message });
    }
  });

  app.post("/api/analyze/arabic-audio", async (req, res) => {
    try {
      const { audioData } = req.body;
      if (!audioData) {
        return res.status(400).json({ message: "Audio data required" });
      }
      
      const analysis = await analyzeArabicAudioTranscription(audioData);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to analyze Arabic audio", error: (error as Error).message });
    }
  });

  app.get("/api/violations/:submissionId", async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const violations = await storage.getViolationsBySubmission(submissionId);
      res.json(violations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch violations", error: (error as Error).message });
    }
  });

  // Video serving routes
  app.get("/api/videos/proctoring/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join('uploads/proctoring', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: "Error serving video", error: (error as Error).message });
    }
  });

  app.get("/api/videos/answers/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join('uploads/videos', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: "Error serving video", error: (error as Error).message });
    }
  });

  // List recorded videos for a submission
  app.get("/api/videos/submission/:submissionId", async (req, res) => {
    try {
      const submissionId = req.params.submissionId;
      const proctoringDir = 'uploads/proctoring';
      const videosDir = 'uploads/videos';
      
      // Get submission details to find associated exam
      const submission = await storage.getSubmission(parseInt(submissionId));
      const examId = submission?.examId;
      
      const proctoringVideos = fs.existsSync(proctoringDir) ? 
        fs.readdirSync(proctoringDir)
          .filter((file: string) => {
            // Only match videos specifically for this submission
            return file.includes(`_${submissionId}_`);
          })
          .map((file: string) => ({
            filename: file,
            url: `/api/videos/proctoring/${file}`,
            type: file.startsWith('camera_') ? 'camera' : file.startsWith('screen_') ? 'screen' : 'proctoring',
            size: fs.statSync(path.join(proctoringDir, file)).size,
            timestamp: fs.statSync(path.join(proctoringDir, file)).mtime
          }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];
      
      const answerVideos = fs.existsSync(videosDir) ? 
        fs.readdirSync(videosDir)
          .filter((file: string) => file.includes(`_${submissionId}_`))
          .map((file: string) => ({
            filename: file,
            url: `/api/videos/answers/${file}`,
            type: 'answer',
            size: fs.statSync(path.join(videosDir, file)).size,
            timestamp: fs.statSync(path.join(videosDir, file)).mtime
          })) : [];
      
      console.log(`Found ${proctoringVideos.length} proctoring videos for submission ${submissionId} (exam ${examId})`);
      
      res.json({ 
        proctoringVideos,
        answerVideos,
        totalVideos: proctoringVideos.length + answerVideos.length
      });
    } catch (error) {
      console.error('Error listing videos:', error);
      res.status(500).json({ message: "Error listing videos", error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
